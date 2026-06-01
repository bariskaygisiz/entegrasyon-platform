import { Router, Request, Response } from 'express';
import https from 'https';
import db from '../db/database';
import {
  ShopifyMappingRow, ShopifySettingsRow, ProductRow, VariantOption,
  rowToMapping, rowToSettings, rowToProduct,
} from '../types';
import { log } from '../lib/log';
import { applyConfig } from '../lib/syncScheduler';

const router = Router();

// ─── Helper: async Shopify API request ────────────────────────────────────────
function shopifyApiRequest(
  domain: string,
  token: string,
  method: string,
  path: string,
  body?: object,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options: https.RequestOptions = {
      hostname: `${domain}.myshopify.com`,
      path,
      method,
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      proxyRes.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (proxyRes.statusCode && proxyRes.statusCode >= 400) {
            const errMsg = json.errors
              ? (typeof json.errors === 'string' ? json.errors : JSON.stringify(json.errors))
              : `HTTP ${proxyRes.statusCode}`;
            reject(new Error(errMsg));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Geçersiz API yanıtı (${proxyRes.statusCode}): ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err: Error) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Helper: delay ────────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ─── Shopify request with rate-limit retry ────────────────────────────────────
async function shopifyRequest(
  domain: string, token: string, method: string, path: string, body?: object,
  maxRetries = 4,
): Promise<any> {
  let lastErr: Error = new Error('Bilinmeyen hata');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await shopifyApiRequest(domain, token, method, path, body);
    } catch (err: any) {
      lastErr = err;
      const msg = (err.message || '').toLowerCase();
      const isRateLimit = msg.includes('429') || msg.includes('throttled') || msg.includes('rate limit') || msg.includes('exceeded');
      const isServer    = msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504');
      if ((isRateLimit || isServer) && attempt < maxRetries) {
        const waitMs = isRateLimit ? 1000 * (attempt + 1) : 500 * (attempt + 1);
        console.warn(`[shopify] ${isRateLimit ? 'Rate limit' : 'Server hata'} — ${waitMs}ms beklenip tekrar deneniyor (${attempt + 1}/${maxRetries})…`);
        await delay(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ─── Helper: variant combinations ─────────────────────────────────────────────
function getCombinations(options: VariantOption[]): string[] {
  const filled = options.filter(o => o.name && o.values.length > 0);
  if (!filled.length) return [];
  let combos: string[][] = [[]];
  for (const opt of filled) combos = combos.flatMap(c => opt.values.map(v => [...c, v]));
  return combos.map(c => c.join(' / '));
}

// ─── Inventory tracking helper ───────────────────────────────────────────────
// Shopify'da stok takibi kapalı olan varyantlarda önce takibi açar,
// ardından stok seviyesini yazar. "does not have inventory tracking enabled" hatasını önler.
async function setInventoryLevel(
  shopDomain: string,
  accessToken: string,
  sv: { id: number; inventory_item_id: number; inventory_management: string | null },
  locationId: number,
  available: number,
): Promise<void> {
  if (sv.inventory_management !== 'shopify') {
    await shopifyRequest(shopDomain, accessToken, 'PUT',
      `/admin/api/2024-01/inventory_items/${sv.inventory_item_id}.json`,
      { inventory_item: { id: sv.inventory_item_id, tracked: true } });
    await delay(200);
  }
  await shopifyRequest(shopDomain, accessToken, 'POST',
    '/admin/api/2024-01/inventory_levels/set.json',
    { location_id: locationId, inventory_item_id: sv.inventory_item_id, available });
}

// ─── Core sync logic ──────────────────────────────────────────────────────────
// changes: hangi alanların değiştiği listesi. Boşsa her şeyi sync eder.
async function performSync(
  productId: string,
  changes: string[] = [],
): Promise<{ success: boolean; message: string; detail: string }> {
  const syncAll  = changes.length === 0;
  const need     = (f: string) => syncAll || changes.includes(f);

  // 1. Load product
  const productRow = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow | undefined;
  if (!productRow) return { success: false, message: 'Ürün bulunamadı.', detail: '' };
  const product = rowToProduct(productRow);

  // 2. Load Shopify settings
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow || !settingsRow.connected)
    return { success: false, message: 'Shopify bağlantısı aktif değil.', detail: 'Ayarlar > Shopify sayfasından bağlantıyı kontrol edin.' };
  const settings = rowToSettings(settingsRow);
  const { shop_domain, access_token } = settings;

  // 3. Load mapping
  const mappingRow = db.prepare('SELECT * FROM shopify_mappings WHERE product_id = ?').get(productId) as ShopifyMappingRow | undefined;
  if (!mappingRow)
    return { success: false, message: 'Shopify eşleştirmesi bulunamadı.', detail: 'Ürünü Shopify ile eşleştirdikten sonra aktarım yapabilirsiniz.' };
  const mapping = rowToMapping(mappingRow);

  // Hangi işlemler gerekli?
  const needsProductPut  = need('productInfo') || need('pricing') || need('inventoryData') || need('media') || need('variants');
  const needsStockUpdate = need('stock') || need('variantStock');

  if (!needsProductPut && !needsStockUpdate) {
    return { success: true, message: 'Aktarılacak değişiklik yok.', detail: '' };
  }

  const done: string[] = [];

  // ── Güvenli sayısal fiyat helper ──────────────────────────────────────────
  const safePrice = (val: any): string => {
    const n = parseFloat(String(val ?? '0'));
    return isNaN(n) || n < 0 ? '0.00' : n.toFixed(2);
  };

  // ── Geçerli Shopify status helper ─────────────────────────────────────────
  const validStatus = (s: string) =>
    ['active', 'draft', 'archived'].includes(s) ? s : 'draft';

  try {
    // ── PRODUCT PUT ────────────────────────────────────────────────────────────
    if (needsProductPut) {
      const shopifyId = parseInt(mapping.shopify_id);
      if (!shopifyId || isNaN(shopifyId))
        return { success: false, message: 'Geçersiz Shopify ürün ID.', detail: '' };

      const productPayload: any = { product: { id: shopifyId } };

      if (need('productInfo')) {
        productPayload.product.title     = product.name || 'İsimsiz Ürün';
        productPayload.product.body_html = product.description || '';
        productPayload.product.status    = validStatus(product.status);
        done.push('başlık/açıklama/durum');
      }

      if (need('media')) {
        const images = (product.media || [])
          .filter(m => m.src)
          .slice(0, 10)
          .map((m, i) => {
            if (m.src!.startsWith('data:')) {
              const parts = m.src!.split(',');
              if (parts.length < 2 || !parts[1]) return null;
              return { attachment: parts[1], filename: `image-${i + 1}.jpg` };
            }
            // Harici URL — Shopify CDN URL'lerini atla (zaten Shopify'da var)
            if (m.src!.includes('cdn.shopify.com')) return null;
            return { src: m.src! };
          })
          .filter(Boolean);
        if (images.length > 0) {
          productPayload.product.images = images;
          done.push(`${images.length} görsel`);
        }
      }

      if (need('pricing') || need('inventoryData') || need('variants')) {
        let variants: object[] = [];
        const useWholesale = settings.price_type === 'wholesale';

        if (product.has_variants && mapping.is_variant) {
          const combos = getCombinations(product.variant_options);
          variants = combos
            .filter(combo => {
              const vm = mapping.variant_mappings[combo];
              return vm?.shopifyVariantId && !isNaN(parseInt(vm.shopifyVariantId));
            })
            .map(combo => {
              const vd = product.variant_data[combo] || {};
              const vm = mapping.variant_mappings[combo];
              let rawPrice: string, rawCompare: string | null;
              if (useWholesale) {
                rawPrice   = vd.b2b_disc && parseFloat(vd.b2b_disc) > 0 ? vd.b2b_disc : (vd.b2b_price || vd.disc || vd.price || String(product.price));
                rawCompare = vd.b2b_disc && parseFloat(vd.b2b_disc) > 0 && vd.b2b_price ? vd.b2b_price : null;
              } else {
                rawPrice   = vd.disc && parseFloat(vd.disc) > 0 ? vd.disc : (vd.price || String(product.price));
                rawCompare = vd.disc && parseFloat(vd.disc) > 0 && vd.price ? vd.price : null;
              }
              return {
                id:                  parseInt(vm.shopifyVariantId),
                price:               safePrice(rawPrice),
                compare_at_price:    rawCompare ? safePrice(rawCompare) : null,
                sku:                 vd.sku     || '',
                barcode:             vd.barcode || '',
                weight:              parseFloat(vd.weight || '0') || 0,
                weight_unit:         'kg',
                inventory_management: 'shopify',
              };
            });
        } else {
          let rawPrice: number | null, rawCompare: number | null;
          if (useWholesale) {
            rawPrice   = product.b2b_discounted_price && product.b2b_discounted_price > 0
              ? product.b2b_discounted_price : (product.b2b_price || product.price);
            rawCompare = product.b2b_discounted_price && product.b2b_discounted_price > 0 && product.b2b_price
              ? product.b2b_price : null;
          } else {
            rawPrice   = product.discounted_price && product.discounted_price > 0
              ? product.discounted_price : product.price;
            rawCompare = product.discounted_price && product.discounted_price > 0
              ? product.price : null;
          }
          variants = [{
            price:               safePrice(rawPrice),
            compare_at_price:    rawCompare ? safePrice(rawCompare) : null,
            sku:                 product.sku     || '',
            barcode:             product.barcode || '',
            weight:              product.weight  || 0,
            weight_unit:         'kg',
            inventory_management: 'shopify',
          }];
        }

        if (variants.length > 0) {
          productPayload.product.variants = variants;
          if (need('pricing'))       done.push('fiyat');
          if (need('inventoryData')) done.push('SKU/barkod/ağırlık');
          if (need('variants'))      done.push('varyantlar');
        }
      }

      // Sadece değiştirilen alan dışında başka key yoksa PUT'u atla
      const payloadKeys = Object.keys(productPayload.product).filter(k => k !== 'id');
      if (payloadKeys.length > 0) {
        await shopifyRequest(shop_domain, access_token, 'PUT',
          `/admin/api/2024-01/products/${mapping.shopify_id}.json`, productPayload);
        // Stok güncelleme öncesi kısa bekleme (rate limit)
        if (needsStockUpdate) await delay(300);
      }
    }

    // ── STOCK UPDATE ──────────────────────────────────────────────────────────
    if (needsStockUpdate) {
      try {
        const spResult = await shopifyRequest(shop_domain, access_token, 'GET',
          `/admin/api/2024-01/products/${mapping.shopify_id}.json`);
        const spVariants: any[] = spResult.product?.variants || [];
        if (spVariants.length === 0)
          throw new Error('Shopify ürününde varyant bulunamadı.');

        await delay(200);
        const locResult  = await shopifyRequest(shop_domain, access_token, 'GET', '/admin/api/2024-01/locations.json');
        const primaryLoc = (locResult.locations || []).find((l: any) => l.active !== false)
          || (locResult.locations || [])[0];
        if (!primaryLoc)
          throw new Error('Aktif depo konumu bulunamadı.');

        let inventoryUpdated = 0;
        if (product.has_variants && mapping.is_variant) {
          const combos = getCombinations(product.variant_options);
          for (const sv of spVariants) {
            if (!sv.inventory_item_id) continue;
            const combo = combos.find(c => {
              const vm = mapping.variant_mappings[c];
              return vm && parseInt(vm.shopifyVariantId) === sv.id;
            });
            if (!combo) continue;
            const stock = Math.max(0, parseInt(product.variant_data[combo]?.stock || '0') || 0);
            await setInventoryLevel(shop_domain, access_token, sv, primaryLoc.id, stock);
            inventoryUpdated++;
            if (inventoryUpdated < spVariants.length) await delay(150);
          }
        } else {
          const sv = spVariants[0];
          if (sv?.inventory_item_id) {
            const stock = Math.max(0, product.stock || 0);
            await setInventoryLevel(shop_domain, access_token, sv, primaryLoc.id, stock);
            inventoryUpdated++;
          }
        }
        if (inventoryUpdated > 0) done.push(`${inventoryUpdated} stok seviyesi`);
      } catch (invErr: any) {
        console.warn('[sync] Stok güncellenemedi:', invErr.message);
        // Stok hatası critical değil — ürün PUT başarılıysa success döndür
        if (done.length === 0)
          return { success: false, message: 'Stok güncellenemedi: ' + invErr.message, detail: '' };
        done.push('⚠ stok (hata)');
      }
    }

    const summary = done.length > 0 ? done.join(', ') + ' güncellendi.' : 'Güncellendi.';
    return { success: true, message: summary, detail: `Shopify ID: #${mapping.shopify_id}` };

  } catch (err: any) {
    return { success: false, message: 'Shopify API hatası: ' + err.message, detail: '' };
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings', (_req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!row) return res.json(null);
  res.json(rowToSettings(row));
});

router.put('/settings', (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const { shop_domain = '', access_token = '', connected = false, plan = '', shop_name = '', currency = 'TRY' } = req.body;

  const existing = db.prepare('SELECT id FROM shopify_settings WHERE id = 1').get();
  if (existing) {
    db.prepare(`
      UPDATE shopify_settings SET shop_domain=?, access_token=?, connected=?, plan=?, shop_name=?, currency=?, updated_at=?
      WHERE id=1
    `).run(shop_domain, access_token, connected ? 1 : 0, plan, shop_name, currency, now);
  } else {
    db.prepare(`
      INSERT INTO shopify_settings (id, shop_domain, access_token, connected, plan, shop_name, currency, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(shop_domain, access_token, connected ? 1 : 0, plan, shop_name, currency, now, now);
  }

  const row = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow;
  const updated = rowToSettings(row);
  log({
    channel: 'shopify', action: 'settings.update', status: 'success',
    message: 'Shopify bağlantı ayarları güncellendi.',
    detail: updated.shop_domain ? `Mağaza: ${updated.shop_domain}.myshopify.com` : '',
  });
  // Bağlantı ayarları değiştiğinde scheduler'ı yeniden yükle
  loadAndApplySyncConfig();
  res.json(updated);
});

router.delete('/settings', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM shopify_settings WHERE id = 1').run();
  log({ channel: 'shopify', action: 'settings.delete', status: 'success', message: 'Shopify bağlantısı kaldırıldı.' });
  res.json({ ok: true });
});

// ─── Price type (retail / wholesale) ─────────────────────────────────────────
router.put('/price-type', (req: Request, res: Response) => {
  const { price_type } = req.body;
  if (price_type !== 'retail' && price_type !== 'wholesale')
    return res.status(400).json({ error: 'Geçersiz price_type. retail veya wholesale olmalı.' });

  const existing = db.prepare('SELECT id FROM shopify_settings WHERE id = 1').get();
  if (!existing) return res.status(404).json({ error: 'Shopify ayarları bulunamadı.' });

  db.prepare('UPDATE shopify_settings SET price_type = ?, updated_at = ? WHERE id = 1')
    .run(price_type, new Date().toISOString());

  log({
    channel: 'shopify', action: 'settings.update', status: 'success',
    message: `Fiyat tipi güncellendi: ${price_type === 'retail' ? 'Perakende' : 'Toptan'}`,
  });
  res.json({ ok: true, price_type });
});

// ─── Mappings ─────────────────────────────────────────────────────────────────
router.get('/mappings', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM shopify_mappings').all() as ShopifyMappingRow[];
  const result: Record<string, ReturnType<typeof rowToMapping>> = {};
  rows.forEach(r => { result[r.product_id] = rowToMapping(r); });
  res.json(result);
});

router.get('/mappings/:productId', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM shopify_mappings WHERE product_id = ?').get(req.params.productId) as ShopifyMappingRow | undefined;
  if (!row) return res.json(null);
  res.json(rowToMapping(row));
});

router.put('/mappings/:productId', (req: Request, res: Response) => {
  const now = new Date().toLocaleDateString('tr-TR');
  const { shopify_id, shopify_title = '', handle = '', sku = '', price = 0, type = 'mapped', is_variant = false, variant_mappings = {} } = req.body;

  if (!shopify_id) return res.status(400).json({ error: 'shopify_id zorunlu.' });

  const existing = db.prepare('SELECT product_id FROM shopify_mappings WHERE product_id = ?').get(req.params.productId);
  if (existing) {
    db.prepare(`
      UPDATE shopify_mappings SET shopify_id=?, shopify_title=?, handle=?, sku=?, price=?, mapped_at=?, type=?, is_variant=?, variant_mappings=?
      WHERE product_id=?
    `).run(shopify_id, shopify_title, handle, sku, price, now, type, is_variant ? 1 : 0, JSON.stringify(variant_mappings), req.params.productId);
  } else {
    db.prepare(`
      INSERT INTO shopify_mappings (product_id, shopify_id, shopify_title, handle, sku, price, mapped_at, type, is_variant, variant_mappings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.productId, shopify_id, shopify_title, handle, sku, price, now, type, is_variant ? 1 : 0, JSON.stringify(variant_mappings));
  }

  const row = db.prepare('SELECT * FROM shopify_mappings WHERE product_id = ?').get(req.params.productId) as ShopifyMappingRow;
  const mapping = rowToMapping(row);
  const productRow = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.productId) as { name: string } | undefined;
  log({
    channel: 'shopify', action: 'mapping.create', status: 'success',
    productId: req.params.productId, productName: productRow?.name || '',
    message: "Shopify'a eşleştirildi.",
    detail: `Shopify ID: #${mapping.shopify_id} · ${mapping.shopify_title}`,
  });
  res.json(mapping);
});

router.delete('/mappings/:productId', (req: Request, res: Response) => {
  const productRow = db.prepare('SELECT name FROM products WHERE id = ?').get(req.params.productId) as { name: string } | undefined;
  db.prepare('DELETE FROM shopify_mappings WHERE product_id = ?').run(req.params.productId);
  log({
    channel: 'shopify', action: 'mapping.delete', status: 'success',
    productId: req.params.productId, productName: productRow?.name || '',
    message: 'Shopify eşleştirmesi kaldırıldı.',
  });
  res.json({ ok: true });
});

// ─── Sync state helpers ───────────────────────────────────────────────────────
function getSyncState(key: string): Record<string, any> {
  const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as { value: string } | undefined;
  try { return row ? JSON.parse(row.value) : {}; } catch { return {}; }
}
function setSyncState(key: string, value: Record<string, any>): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), now);
}

// ─── Toplu sync için log helper ────────────────────────────────────────────
function logBatch(action: string, message: string, detail = '', status: 'success' | 'error' = 'success') {
  log({ channel: 'shopify', action, status, productId: '', productName: 'Toplu Senkronizasyon', message, detail });
}

// ─── Ortak: settings + konum yükle ───────────────────────────────────────────
async function loadSettingsAndLocation(): Promise<{
  shopDomain: string; accessToken: string; primaryLocId: number; mappingRows: ShopifyMappingRow[];
} | null> {
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow?.connected) return null;
  const s = rowToSettings(settingsRow);

  const mappingRows = db.prepare('SELECT * FROM shopify_mappings').all() as ShopifyMappingRow[];
  if (mappingRows.length === 0) return null;

  const locResult = await shopifyRequest(s.shop_domain, s.access_token, 'GET', '/admin/api/2024-01/locations.json');
  const loc = (locResult.locations || []).find((l: any) => l.active !== false) || (locResult.locations || [])[0];
  if (!loc) return null;

  return { shopDomain: s.shop_domain, accessToken: s.access_token, primaryLocId: loc.id, mappingRows };
}

// ════════════════════════════════════════════════════════════════════════════
// ── STOK SYNC (change-detection ile) ────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
export async function runStockSync(): Promise<void> {
  const ctx = await loadSettingsAndLocation().catch(() => null);
  if (!ctx) return;
  const { shopDomain, accessToken, primaryLocId, mappingRows } = ctx;

  // Mevcut stok anlık görüntüsünü oluştur
  const current: Record<string, number> = {};
  const productMap = new Map<string, ReturnType<typeof rowToProduct>>();
  const mappingMap = new Map<string, ReturnType<typeof rowToMapping>>();

  for (const mr of mappingRows) {
    const pr = db.prepare('SELECT * FROM products WHERE id = ?').get(mr.product_id) as ProductRow | undefined;
    if (!pr) continue;
    const p = rowToProduct(pr);
    const m = rowToMapping(mr);
    productMap.set(mr.product_id, p);
    mappingMap.set(mr.product_id, m);

    if (p.has_variants && m.is_variant) {
      for (const combo of getCombinations(p.variant_options)) {
        current[`${mr.product_id}:${combo}`] = Math.max(0, parseInt(p.variant_data[combo]?.stock || '0') || 0);
      }
    } else {
      current[mr.product_id] = Math.max(0, p.stock || 0);
    }
  }

  const last = getSyncState('stock');

  // Değişen ürünleri bul
  const changedIds = new Set<string>();
  for (const [key, stock] of Object.entries(current)) {
    if (last[key] !== stock) changedIds.add(key.includes(':') ? key.split(':')[0] : key);
  }

  if (changedIds.size === 0) {
    console.log('[stock-sync] Stok değişikliği yok — atlandı.');
    return; // Değişiklik yoksa işlem kaydı da yazma
  }

  console.log(`[stock-sync] ${changedIds.size} üründe değişiklik — güncelleniyor…`);
  let totalUpdated = 0;
  const errors: string[] = [];
  const updatedSnapshot: Record<string, number> = { ...last };

  for (const productId of changedIds) {
    const product = productMap.get(productId);
    const mapping = mappingMap.get(productId);
    if (!product || !mapping) continue;

    try {
      const spResult = await shopifyRequest(shopDomain, accessToken, 'GET',
        `/admin/api/2024-01/products/${mapping.shopify_id}.json`);
      const spVariants: any[] = spResult.product?.variants || [];
      await delay(200);

      if (product.has_variants && mapping.is_variant) {
        const combos = getCombinations(product.variant_options);
        for (const sv of spVariants) {
          if (!sv.inventory_item_id) continue;
          const combo = combos.find(c => {
            const vm = mapping.variant_mappings[c];
            return vm && parseInt(vm.shopifyVariantId) === sv.id;
          });
          if (!combo) continue;
          const key = `${productId}:${combo}`;
          if (last[key] === current[key]) continue; // Bu varyant değişmemiş
          await setInventoryLevel(shopDomain, accessToken, sv, primaryLocId, current[key]);
          updatedSnapshot[key] = current[key];
          totalUpdated++;
          await delay(150);
        }
      } else {
        const sv = spVariants[0];
        if (sv?.inventory_item_id) {
          await setInventoryLevel(shopDomain, accessToken, sv, primaryLocId, current[productId]);
          updatedSnapshot[productId] = current[productId];
          totalUpdated++;
        }
      }
      await delay(200);
    } catch (e: any) {
      errors.push(`${product.name}: ${e.message}`);
    }
  }

  setSyncState('stock', updatedSnapshot);

  if (errors.length === 0) {
    logBatch('auto-stock',
      `${changedIds.size} üründe değişiklik, ${totalUpdated} stok seviyesi güncellendi.`,
      `Toplam eşleştirilen: ${mappingRows.length} ürün`);
  } else {
    logBatch('auto-stock',
      `${totalUpdated} güncellendi, ${errors.length} hata.`,
      errors.slice(0, 3).join(' | '), 'error');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ── ÜRÜN BİLGİSİ SYNC (başlık, açıklama, durum) ─────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
export async function runProductInfoSync(): Promise<void> {
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow?.connected) return;
  const { shop_domain, access_token } = rowToSettings(settingsRow);

  const mappingRows = db.prepare('SELECT * FROM shopify_mappings').all() as ShopifyMappingRow[];
  if (mappingRows.length === 0) return;

  // Snapshot: productId → "name|description|status"
  const last = getSyncState('product_info');
  const newSnap: Record<string, string> = { ...last };
  let updated = 0;
  const errors: string[] = [];

  for (const mr of mappingRows) {
    const pr = db.prepare('SELECT * FROM products WHERE id = ?').get(mr.product_id) as ProductRow | undefined;
    if (!pr) continue;
    const p = rowToProduct(pr);
    const fingerprint = `${p.name}|${(p.description || '').slice(0, 100)}|${p.status}`;
    if (last[mr.product_id] === fingerprint) continue; // Değişmemiş

    try {
      await shopifyRequest(shop_domain, access_token, 'PUT',
        `/admin/api/2024-01/products/${mr.shopify_id}.json`,
        { product: {
          id: parseInt(mr.shopify_id),
          title:     p.name || 'İsimsiz Ürün',
          body_html: p.description || '',
          status:    ['active','draft','archived'].includes(p.status) ? p.status : 'draft',
        }});
      newSnap[mr.product_id] = fingerprint;
      updated++;
      await delay(300);
    } catch (e: any) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }

  setSyncState('product_info', newSnap);
  if (updated === 0 && errors.length === 0) { console.log('[product-sync] Değişiklik yok.'); return; }

  logBatch('auto-product',
    errors.length === 0
      ? `${updated} ürün bilgisi güncellendi.`
      : `${updated} güncellendi, ${errors.length} hata.`,
    errors.length ? errors.slice(0, 3).join(' | ') : `Toplam kontrol: ${mappingRows.length} ürün`,
    errors.length > 0 ? 'error' : 'success');
}

// ════════════════════════════════════════════════════════════════════════════
// ── FİYAT SYNC ───────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
export async function runPriceSync(): Promise<void> {
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow?.connected) return;
  const settings = rowToSettings(settingsRow);
  const { shop_domain, access_token } = settings;
  const useWholesale = settings.price_type === 'wholesale';

  const mappingRows = db.prepare('SELECT * FROM shopify_mappings').all() as ShopifyMappingRow[];
  if (mappingRows.length === 0) return;

  const safePrice = (v: any) => { const n = parseFloat(String(v ?? '0')); return (isNaN(n) || n < 0 ? 0 : n).toFixed(2); };
  const last = getSyncState('prices');
  const newSnap: Record<string, string> = { ...last };
  let updated = 0;
  const errors: string[] = [];

  for (const mr of mappingRows) {
    const pr = db.prepare('SELECT * FROM products WHERE id = ?').get(mr.product_id) as ProductRow | undefined;
    if (!pr) continue;
    const p = rowToProduct(pr);
    const mapping = rowToMapping(mr);

    let fingerprint: string;
    let variants: object[];

    if (p.has_variants && mapping.is_variant) {
      const combos = getCombinations(p.variant_options);
      variants = combos
        .filter(c => mapping.variant_mappings[c]?.shopifyVariantId)
        .map(c => {
          const vd = p.variant_data[c] || {};
          let selling: string, compare: string | null;
          if (useWholesale) {
            selling = vd.b2b_disc && parseFloat(vd.b2b_disc) > 0 ? vd.b2b_disc : (vd.b2b_price || vd.disc || vd.price || String(p.price));
            compare = vd.b2b_disc && parseFloat(vd.b2b_disc) > 0 && vd.b2b_price ? vd.b2b_price : null;
          } else {
            selling = vd.disc && parseFloat(vd.disc) > 0 ? vd.disc : (vd.price || String(p.price));
            compare = vd.disc && parseFloat(vd.disc) > 0 && vd.price ? vd.price : null;
          }
          return { id: parseInt(mapping.variant_mappings[c].shopifyVariantId), price: safePrice(selling), compare_at_price: compare ? safePrice(compare) : null };
        });
      fingerprint = JSON.stringify(variants.map((v: any) => `${v.id}:${v.price}:${v.compare_at_price}`));
    } else {
      let selling: number | null, compare: number | null;
      if (useWholesale) {
        selling = p.b2b_discounted_price && p.b2b_discounted_price > 0 ? p.b2b_discounted_price : (p.b2b_price || p.price);
        compare = p.b2b_discounted_price && p.b2b_discounted_price > 0 && p.b2b_price ? p.b2b_price : null;
      } else {
        selling = p.discounted_price && p.discounted_price > 0 ? p.discounted_price : p.price;
        compare = p.discounted_price && p.discounted_price > 0 ? p.price : null;
      }
      variants = [{ price: safePrice(selling), compare_at_price: compare ? safePrice(compare) : null }];
      fingerprint = `${selling}:${compare}`;
    }

    if (last[mr.product_id] === fingerprint) continue;

    try {
      await shopifyRequest(shop_domain, access_token, 'PUT',
        `/admin/api/2024-01/products/${mr.shopify_id}.json`,
        { product: { id: parseInt(mr.shopify_id), variants } });
      newSnap[mr.product_id] = fingerprint;
      updated++;
      await delay(300);
    } catch (e: any) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }

  setSyncState('prices', newSnap);
  if (updated === 0 && errors.length === 0) { console.log('[price-sync] Fiyat değişikliği yok.'); return; }

  logBatch('auto-price',
    errors.length === 0 ? `${updated} ürün fiyatı güncellendi.` : `${updated} güncellendi, ${errors.length} hata.`,
    errors.length ? errors.slice(0, 3).join(' | ') : `Toplam kontrol: ${mappingRows.length} ürün`,
    errors.length > 0 ? 'error' : 'success');
}

// ════════════════════════════════════════════════════════════════════════════
// ── GÖRSEL SYNC (ürün düzenlendiğinde tetiklenir, periyodik değil) ────────────
// ════════════════════════════════════════════════════════════════════════════
export async function runImageSync(productId: string): Promise<void> {
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow?.connected) return;
  const { shop_domain, access_token } = rowToSettings(settingsRow);

  const mr = db.prepare('SELECT * FROM shopify_mappings WHERE product_id = ?').get(productId) as ShopifyMappingRow | undefined;
  if (!mr) return; // Shopify'a eşleştirilmemiş ürün — atla

  const pr = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow | undefined;
  if (!pr) return;
  const p = rowToProduct(pr);

  const media = (p.media || []).filter(m => m.src);
  const fingerprint = media.map(m => (m.src || '').slice(0, 80)).join('|');

  // Snapshot ile karşılaştır — değişmemişse işlem yapma
  const last = getSyncState('images');
  if (last[productId] === fingerprint) {
    console.log(`[image-sync] ${p.name}: görsel değişikliği yok — atlandı.`);
    return;
  }

  const images = media.slice(0, 10)
    .map((m, i) => {
      if ((m.src || '').startsWith('data:')) {
        const parts = (m.src || '').split(',');
        return parts[1] ? { attachment: parts[1], filename: `image-${i + 1}.jpg` } : null;
      }
      if ((m.src || '').includes('cdn.shopify.com')) return null;
      return { src: m.src! };
    })
    .filter(Boolean);

  if (images.length === 0) {
    console.log(`[image-sync] ${p.name}: gönderilebilir görsel yok — atlandı.`);
    return;
  }

  try {
    await shopifyRequest(shop_domain, access_token, 'PUT',
      `/admin/api/2024-01/products/${mr.shopify_id}.json`,
      { product: { id: parseInt(mr.shopify_id), images } });

    setSyncState('images', { ...last, [productId]: fingerprint });

    logBatch('image-sync',
      `${p.name} görselleri Shopify'a aktarıldı.`,
      `${images.length} görsel`,
      'success');
  } catch (e: any) {
    logBatch('image-sync',
      `${p.name} görsel sync hatası.`,
      e.message,
      'error');
  }
}

// ─── Config yükle ve scheduler'a uygula (index.ts'den çağrılır) ──────────────
export function loadAndApplySyncConfig(): void {
  const row = db.prepare('SELECT sync_config FROM shopify_settings WHERE id = 1').get() as { sync_config: string } | undefined;
  const defaults = { products: false, inventory: true, prices: false };
  const config   = row?.sync_config ? { ...defaults, ...JSON.parse(row.sync_config) } : defaults;
  applyConfig(config);
}

// ─── Auto stock sync (backward compat — artık runStockSync kullanılıyor) ──────
export async function runAutoStockSync(): Promise<void> {
  return runStockSync();
}

// ─── Sync Config endpoints ────────────────────────────────────────────────────
const DEFAULT_SYNC_CONFIG = { products: false, inventory: true, prices: false };

router.get('/sync-config', (_req: Request, res: Response) => {
  const row = db.prepare('SELECT sync_config FROM shopify_settings WHERE id = 1').get() as { sync_config: string } | undefined;
  const saved = row?.sync_config ? JSON.parse(row.sync_config) : {};
  res.json({ ...DEFAULT_SYNC_CONFIG, ...saved });
});

router.put('/sync-config', (req: Request, res: Response) => {
  const config = req.body as Record<string, boolean>;
  const now    = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM shopify_settings WHERE id = 1').get();
  if (!existing) return res.status(404).json({ error: 'Shopify ayarları bulunamadı.' });
  db.prepare('UPDATE shopify_settings SET sync_config = ?, updated_at = ? WHERE id = 1')
    .run(JSON.stringify({ ...DEFAULT_SYNC_CONFIG, ...config }), now);
  applyConfig({ ...DEFAULT_SYNC_CONFIG, ...config });
  log({ channel: 'system', action: 'settings.update', status: 'success', message: 'Senkronizasyon ayarları güncellendi.',
    detail: Object.entries(config).filter(([,v]) => v).map(([k]) => k).join(', ') || 'Hepsi devre dışı' });
  res.json({ ok: true });
});

// ─── Sync: push product to Shopify ───────────────────────────────────────────
router.post('/sync/:productId', async (req: Request, res: Response) => {
  const { productId } = req.params;
  const changes: string[] = Array.isArray(req.body?.changes) ? req.body.changes : [];
  const now = new Date().toISOString();

  const productRow = db.prepare('SELECT name FROM products WHERE id = ?').get(productId) as { name: string } | undefined;
  const productName = productRow?.name || productId;

  const jobResult = db.prepare(`
    INSERT INTO sync_jobs (product_id, product_name, channel, action, status, message, detail, created_at, updated_at)
    VALUES (?, ?, 'shopify', 'sync', 'syncing', 'Senkronizasyon başlatıldı…', '', ?, ?)
  `).run(productId, productName, now, now);
  const jobId = jobResult.lastInsertRowid;

  try {
    const result = await performSync(productId, changes);
    db.prepare(`UPDATE sync_jobs SET status=?, message=?, detail=?, updated_at=? WHERE id=?`)
      .run(result.success ? 'success' : 'error', result.message, result.detail, new Date().toISOString(), jobId);
    res.json({ ok: result.success, jobId, message: result.message, detail: result.detail });
  } catch (err: any) {
    db.prepare(`UPDATE sync_jobs SET status='error', message=?, detail='', updated_at=? WHERE id=?`)
      .run('Beklenmeyen hata: ' + err.message, new Date().toISOString(), jobId);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Jobs: list (son 3 ay) ────────────────────────────────────────────────────
router.get('/jobs', (_req: Request, res: Response) => {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const rows = db.prepare(
    'SELECT * FROM sync_jobs WHERE created_at >= ? ORDER BY created_at DESC LIMIT 500'
  ).all(cutoff.toISOString());
  res.json(rows);
});

// ─── Jobs: retry ─────────────────────────────────────────────────────────────
router.post('/jobs/:id/retry', async (req: Request, res: Response) => {
  const job = db.prepare('SELECT * FROM sync_jobs WHERE id = ?').get(req.params.id) as any | undefined;
  if (!job) return res.status(404).json({ error: 'İş bulunamadı.' });

  const now = new Date().toISOString();
  db.prepare(`UPDATE sync_jobs SET status='syncing', message='Yeniden deneniyor…', detail='', updated_at=? WHERE id=?`)
    .run(now, req.params.id);

  try {
    // Retry: orijinal action'dan changes'i çıkar (boş olursa full sync)
    const result = await performSync(job.product_id, []);
    db.prepare(`UPDATE sync_jobs SET status=?, message=?, detail=?, updated_at=? WHERE id=?`)
      .run(result.success ? 'success' : 'error', result.message, result.detail, new Date().toISOString(), req.params.id);
    res.json({ ok: result.success, message: result.message });
  } catch (err: any) {
    db.prepare(`UPDATE sync_jobs SET status='error', message=?, detail='', updated_at=? WHERE id=?`)
      .run('Beklenmeyen hata: ' + err.message, new Date().toISOString(), req.params.id);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ── SİPARİŞ SYNC ─────────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

const ORDER_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function padZ(n: number) { return String(n).padStart(2, '0'); }

function formatOrderDateStr(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return `${padZ(d.getDate())} ${ORDER_MONTHS[d.getMonth()]} ${d.getFullYear()} ${padZ(d.getHours())}:${padZ(d.getMinutes())}`;
  } catch { return isoStr; }
}

function mapShopifyOrderStatus(order: any): string {
  if (order.cancelled_at) return 'cancelled';
  const fs = (order.fulfillment_status || '').toLowerCase();
  if (fs === 'fulfilled') return 'delivered';
  if (fs === 'partial')   return 'shipped';
  return 'approved';
}

function mapPaymentGateway(order: any): string {
  const gw = (order.payment_gateway || '').toLowerCase();
  const names: string[] = order.payment_gateway_names || [];
  const combined = gw + ' ' + names.join(' ').toLowerCase();
  if (combined.includes('cash') || combined.includes('cod') || combined.includes('kapıda')) return 'Kapıda Ödeme';
  if (combined.includes('bank_transfer') || combined.includes('havale') || combined.includes('eft')) return 'Havale/EFT';
  if (combined.includes('shopify_payments') || combined.includes('stripe') || combined.includes('credit_card')) return 'Kredi Kartı';
  if (combined.includes('paypal'))  return 'PayPal';
  if (combined.includes('manual'))  return 'Manuel Ödeme';
  if (combined.includes('bogus'))   return 'Test Ödeme';
  return order.payment_gateway || 'Belirtilmemiş';
}

function mapShopifyOrderRow(order: any): {
  shopify_order_id: string; order_name: string; status: string;
  customer: string; email: string; phone: string;
  city: string; district: string; address: string;
  postal_code: string; tc_no: string; shipping_method: string;
  billing_name: string; billing_address: string; billing_district: string;
  billing_city: string; billing_postal: string;
  product_name: string; product_sku: string; product_emoji: string; product_image: string;
  product_price: number; product_category: string;
  qty: number; amount: number;
  cargo_code: string | null; cargo_company: string;
  payment_method: string; note: string | null;
  line_items: string; date_str: string;
} {
  const firstItem   = (order.line_items || [])[0] || {};
  const shipAddr    = order.shipping_address || order.billing_address || {};
  const billAddr    = order.billing_address  || order.shipping_address || {};
  const cust        = order.customer || {};
  const fulfillment = (order.fulfillments || [])[0] || null;

  // Ad Soyad: Shopify first_name + last_name (shipping_address veya customer objesinden)
  const firstName = shipAddr.first_name || cust.first_name || '';
  const lastName  = shipAddr.last_name  || cust.last_name  || '';
  const customerName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : (shipAddr.name || billAddr.name || '');

  // TC No: Shopify'da Company alanına girilir (TR e-ticaret standardı)
  const tcNo = shipAddr.company || billAddr.company || '';

  const lineItemsMapped = (order.line_items || []).map((li: any) => ({
    title:    li.title || li.name || '',
    quantity: li.quantity || 1,
    price:    li.price || '0',
    sku:      li.sku || '',
    vendor:   li.vendor || '',
  }));

  return {
    shopify_order_id: String(order.id),
    order_name:       order.name || `#${order.id}`,
    status:           mapShopifyOrderStatus(order),
    customer:         customerName,
    email:            order.email || cust.email || '',
    phone:            shipAddr.phone || cust.phone || order.phone || '',
    // Teslimat adresi
    city:             shipAddr.city       || '',
    district:         shipAddr.address2   || '',
    address:          shipAddr.address1   || '',
    postal_code:      shipAddr.zip        || '',
    tc_no:            tcNo,
    // Fatura adresi
    billing_name:     (billAddr.first_name || billAddr.last_name)
                        ? `${billAddr.first_name || ''} ${billAddr.last_name || ''}`.trim()
                        : (billAddr.name || ''),
    billing_address:  billAddr.address1   || '',
    billing_district: billAddr.address2   || '',
    billing_city:     billAddr.city       || '',
    billing_postal:   billAddr.zip        || '',
    // Ürün
    product_name:     firstItem.title || firstItem.name || '',
    product_sku:      firstItem.sku || '',
    product_emoji:    '📦',
    product_image:    firstItem.image?.src || firstItem.featured_image?.url || '',
    product_price:    parseFloat(firstItem.price || '0') || 0,
    product_category: firstItem.vendor || '',
    qty:              firstItem.quantity || 1,
    amount:           parseFloat(order.total_price || '0') || 0,
    // Kargo
    shipping_method:  (order.shipping_lines || [])[0]?.title || '',
    cargo_code:       fulfillment?.tracking_number || null,
    cargo_company:    fulfillment?.tracking_company || '',
    payment_method:   mapPaymentGateway(order),
    note:             order.note || null,
    line_items:       JSON.stringify(lineItemsMapped),
    date_str:         order.created_at ? formatOrderDateStr(order.created_at) : '',
  };
}

// ── Shared: sipariş satırlarını DB'ye upsert et ──────────────────────────────
function upsertOrderRows(orders: any[], now: string): { synced: number; updated: number } {
  const upsertStmt = db.prepare(`
    INSERT INTO orders
      (shopify_order_id, order_name, channel, status, customer, email, phone,
       city, district, address, postal_code, tc_no, shipping_method,
       billing_name, billing_address, billing_district, billing_city, billing_postal,
       product_name, product_sku, product_emoji, product_image,
       product_price, product_category, qty, amount, cargo_code, cargo_company,
       payment_method, note, line_items, date_str, shopify_synced_at, created_at, updated_at)
    VALUES (?, ?, 'shopify', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shopify_order_id) DO UPDATE SET
      status            = excluded.status,
      customer          = excluded.customer,
      email             = excluded.email,
      phone             = excluded.phone,
      city              = excluded.city,
      district          = excluded.district,
      address           = excluded.address,
      postal_code       = excluded.postal_code,
      tc_no             = excluded.tc_no,
      shipping_method   = excluded.shipping_method,
      billing_name      = excluded.billing_name,
      billing_address   = excluded.billing_address,
      billing_district  = excluded.billing_district,
      billing_city      = excluded.billing_city,
      billing_postal    = excluded.billing_postal,
      product_image     = excluded.product_image,
      cargo_code        = excluded.cargo_code,
      cargo_company     = excluded.cargo_company,
      amount            = excluded.amount,
      line_items        = excluded.line_items,
      payment_method    = excluded.payment_method,
      note              = excluded.note,
      shopify_synced_at = excluded.shopify_synced_at,
      updated_at        = excluded.updated_at
  `);

  const existingIds = new Set(
    (db.prepare('SELECT shopify_order_id FROM orders').all() as { shopify_order_id: string }[])
      .map(r => r.shopify_order_id),
  );

  let synced = 0, updated = 0;

  const syncMany = db.transaction((rows: any[]) => {
    for (const order of rows) {
      const m = mapShopifyOrderRow(order);
      const isNew = !existingIds.has(m.shopify_order_id);
      upsertStmt.run(
        m.shopify_order_id, m.order_name, m.status,
        m.customer, m.email, m.phone,
        m.city, m.district, m.address, m.postal_code, m.tc_no, m.shipping_method,
        m.billing_name, m.billing_address, m.billing_district, m.billing_city, m.billing_postal,
        m.product_name, m.product_sku, m.product_emoji, m.product_image,
        m.product_price, m.product_category,
        m.qty, m.amount,
        m.cargo_code, m.cargo_company,
        m.payment_method, m.note,
        m.line_items, m.date_str,
        now, now, now,
      );
      if (isNew) synced++; else updated++;
    }
  });

  syncMany(orders);
  return { synced, updated };
}

// ── Manuel (tam) sipariş sync — since_id pagination ─────────────────────────
router.post('/sync-orders', async (_req: Request, res: Response) => {
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow?.connected) return res.status(400).json({ error: 'Shopify bağlantısı bulunamadı.' });
  const { shop_domain, access_token } = rowToSettings(settingsRow);

  try {
    const now = new Date().toISOString();
    const allOrders: any[] = [];
    let sinceId = 0;

    while (true) {
      const url = `/admin/api/2024-01/orders.json?limit=250&status=any&order=id+asc${sinceId ? `&since_id=${sinceId}` : ''}`;
      const result = await shopifyRequest(shop_domain, access_token, 'GET', url);
      const page: any[] = result.orders || [];
      if (page.length === 0) break;
      allOrders.push(...page);
      if (page.length < 250) break;
      sinceId = page[page.length - 1].id;
      await delay(300);
    }

    const { synced, updated } = upsertOrderRows(allOrders, now);

    // Son sync zamanını güncelle
    setSyncState('orders_last_sync', { updated_at: now });

    log({
      channel: 'shopify', action: 'sync-orders', status: 'success',
      message: `${synced} yeni + ${updated} güncellenen sipariş senkronize edildi.`,
      detail: `Toplam Shopify siparişi: ${allOrders.length}`,
    });

    res.json({ synced, updated, total: allOrders.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Otomatik (artımlı) sipariş sync — her 5 dk'da çağrılır ─────────────────
export async function runOrderSync(): Promise<void> {
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow?.connected) return; // Shopify bağlı değilse sessizce atla

  const { shop_domain, access_token } = rowToSettings(settingsRow);

  // Son sync zamanını oku; yoksa 24 saat geriye git
  const stateRow = db.prepare("SELECT value FROM sync_state WHERE key = 'orders_last_sync'").get() as { value: string } | undefined;
  let lastSync: string;
  try {
    lastSync = stateRow ? (JSON.parse(stateRow.value).updated_at as string) : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  } catch {
    lastSync = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }

  const now = new Date().toISOString();

  try {
    // Son sync'ten bu yana güncellenen siparişleri çek (max 250 — 5 dk'lık pencere için yeterli)
    const url = `/admin/api/2024-01/orders.json?status=any&limit=250&order=updated_at+asc&updated_at_min=${encodeURIComponent(lastSync)}`;
    const result = await shopifyRequest(shop_domain, access_token, 'GET', url);
    const orders: any[] = result.orders || [];

    // Sync zamanını her çalışmada güncelle (sipariş olmasa bile)
    setSyncState('orders_last_sync', { updated_at: now });

    if (orders.length === 0) return;

    const { synced, updated } = upsertOrderRows(orders, now);

    if (synced > 0 || updated > 0) {
      console.log(`[order-sync] ${synced} yeni + ${updated} güncellenen sipariş.`);
      log({
        channel: 'shopify', action: 'auto-orders', status: 'success',
        message: `${synced} yeni + ${updated} güncellenen sipariş otomatik senkronize edildi.`,
        detail: `updated_at_min: ${lastSync.slice(0, 19).replace('T', ' ')}`,
      });
    }
  } catch (e: any) {
    console.error('[order-sync] Hata:', e.message);
  }
}

// ─── Proxy: list Shopify products ─────────────────────────────────────────────
router.get('/products', (req: Request, res: Response) => {
  const domain = req.headers['x-shop-domain'] as string;
  const token  = req.headers['x-shop-token'] as string;
  if (!domain || !token) return res.status(400).json({ error: 'X-Shop-Domain ve X-Shop-Token zorunlu.' });
  const limit = (req.query.limit as string) || '250';
  forwardToShopify(req, res, `/admin/api/2024-01/products.json?limit=${limit}&status=active`);
});

// ─── Proxy: create Shopify product ───────────────────────────────────────────
router.post('/products', (req: Request, res: Response) => {
  const domain = req.headers['x-shop-domain'] as string;
  const token  = req.headers['x-shop-token'] as string;
  if (!domain || !token) return res.status(400).json({ error: 'X-Shop-Domain ve X-Shop-Token zorunlu.' });
  let body = '';
  req.on('data', (chunk: Buffer) => (body += chunk.toString()));
  req.on('end', () => forwardToShopify(req, res, '/admin/api/2024-01/products.json', 'POST', body));
});

// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => res.json({ ok: true }));

// ─── Shopify → Yerel İçeri Aktar ─────────────────────────────────────────────
router.post('/import', async (req: Request, res: Response) => {
  const settingsRow = db.prepare('SELECT * FROM shopify_settings WHERE id = 1').get() as ShopifySettingsRow | undefined;
  if (!settingsRow?.connected) return res.status(400).json({ error: 'Shopify bağlantısı bulunamadı.' });
  const { shop_domain, access_token } = rowToSettings(settingsRow);

  try {
    // ── Tüm Shopify ürünlerini since_id pagination ile çek ──────────────────
    const allSp: any[] = [];
    let sinceId = 0;

    while (true) {
      const url = `/admin/api/2024-01/products.json?limit=250&order=id+asc${sinceId ? `&since_id=${sinceId}` : ''}`;
      const result = await shopifyRequest(shop_domain, access_token, 'GET', url) as any;
      const page: any[] = result.products || [];
      if (page.length === 0) break;
      allSp.push(...page);
      if (page.length < 250) break;
      sinceId = page[page.length - 1].id;
      await delay(300);
    }

    // ── Zaten eşleştirilmiş Shopify ID'lerini al ────────────────────────────
    const mapped = new Set(
      (db.prepare('SELECT shopify_id FROM shopify_mappings').all() as { shopify_id: string }[])
        .map(r => r.shopify_id)
    );

    const now = new Date().toISOString();
    let imported = 0, skipped = 0;
    const errors: string[] = [];

    for (const sp of allSp) {
      const shopifyId = String(sp.id);

      if (mapped.has(shopifyId)) { skipped++; continue; }

      try {
        const productId = `shp_${shopifyId}`;

        // ── Varyant analizi ─────────────────────────────────────────────────
        const variants: any[] = sp.variants || [];
        const isSimple = variants.length === 1 && variants[0].title === 'Default Title';

        // ── Görsel ─────────────────────────────────────────────────────────
        const media = (sp.images || []).map((img: any, i: number) => ({
          id: i + 1,
          src: img.src || null,
        }));

        // ── Etiketler ──────────────────────────────────────────────────────
        const tags: string[] = sp.tags
          ? sp.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
          : [];

        // ── Durum ──────────────────────────────────────────────────────────
        const status = ['active', 'draft', 'archived'].includes(sp.status) ? sp.status : 'draft';

        let price = 0;
        let discountedPrice: number | null = null;
        let sku = '', barcode = '', stock = 0, weight = 0;
        let hasVariants = false;
        let variantOptions: object[] = [];
        let variantData: Record<string, object> = {};
        let variantMappings: Record<string, object> = {};

        if (isSimple) {
          // ── Basit ürün ──────────────────────────────────────────────────
          const v = variants[0];
          const shopifyPrice  = parseFloat(v.price || '0') || 0;
          const compareAtPrice = parseFloat(v.compare_at_price || '0') || 0;

          if (compareAtPrice > 0 && compareAtPrice > shopifyPrice) {
            price           = compareAtPrice;
            discountedPrice = shopifyPrice;
          } else {
            price = shopifyPrice;
          }
          sku      = v.sku || '';
          barcode  = v.barcode || '';
          stock    = parseInt(v.inventory_quantity ?? '0') || 0;
          weight   = parseFloat(v.weight || '0') || 0;

        } else {
          // ── Varyantlı ürün ──────────────────────────────────────────────
          hasVariants = true;

          variantOptions = (sp.options || []).map((opt: any, i: number) => ({
            id: i + 1,
            name: opt.name,
            values: opt.values || [],
          }));

          let minPrice = Infinity;

          for (const v of variants) {
            const parts = [v.option1, v.option2, v.option3].filter(Boolean);
            const comboKey = parts.join(' / ');

            const shopifyPrice   = parseFloat(v.price || '0') || 0;
            const compareAtPrice = parseFloat(v.compare_at_price || '0') || 0;
            let vPrice = String(shopifyPrice), vDisc = '';

            if (compareAtPrice > 0 && compareAtPrice > shopifyPrice) {
              vPrice = String(compareAtPrice);
              vDisc  = String(shopifyPrice);
            }

            const effectivePrice = vDisc ? parseFloat(vDisc) : shopifyPrice;
            if (effectivePrice < minPrice) minPrice = effectivePrice;

            variantData[comboKey] = {
              price:   vPrice,
              disc:    vDisc,
              stock:   String(parseInt(v.inventory_quantity ?? '0') || 0),
              sku:     v.sku || '',
              barcode: v.barcode || '',
              weight:  String(parseFloat(v.weight || '0') || 0),
            };

            variantMappings[comboKey] = {
              shopifyVariantId:    String(v.id),
              shopifyVariantTitle: v.title || comboKey,
              shopifySku:          v.sku || '',
              shopifyPrice:        v.price || '0',
            };
          }

          price = minPrice === Infinity ? 0 : minPrice;

          // Varyant stoklarının toplamını hesapla
          stock = Object.values(variantData).reduce(
            (s, v: any) => s + (parseInt(v.stock || '0') || 0), 0
          );
        }

        // ── Ürünü kaydet ────────────────────────────────────────────────────
        db.prepare(`
          INSERT OR IGNORE INTO products
            (id, name, description, price, discounted_price, cost, sku, barcode,
             stock, weight, status, category, channels, tags, media,
             has_variants, variant_options, variant_data, emoji, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          productId,
          sp.title || 'İsimsiz Ürün',
          sp.body_html || '',
          price,
          discountedPrice,
          0,
          sku, barcode, stock, weight,
          status,
          sp.product_type || '',
          JSON.stringify(['shopify']),
          JSON.stringify(tags),
          JSON.stringify(media),
          hasVariants ? 1 : 0,
          JSON.stringify(variantOptions),
          JSON.stringify(variantData),
          '📦',
          now, now,
        );

        // ── Eşleştirme kaydı ────────────────────────────────────────────────
        db.prepare(`
          INSERT OR IGNORE INTO shopify_mappings
            (product_id, shopify_id, shopify_title, handle, sku, price, mapped_at, type, is_variant, variant_mappings)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          productId, shopifyId,
          sp.title || '', sp.handle || '',
          sku, price, now,
          'imported',
          hasVariants ? 1 : 0,
          JSON.stringify(variantMappings),
        );

        imported++;
      } catch (e: any) {
        errors.push(`${sp.title || shopifyId}: ${e.message}`);
      }
    }

    // ── İşlem kaydı ─────────────────────────────────────────────────────────
    log({
      channel: 'shopify', action: 'import',
      status:  errors.length > 0 ? 'error' : 'success',
      message: `${imported} Shopify ürünü içeri aktarıldı${skipped > 0 ? `, ${skipped} zaten eşleştirili` : ''}.`,
      detail:  errors.length > 0
        ? errors.slice(0, 3).join(' | ')
        : `Toplam kontrol edilen: ${allSp.length} ürün`,
    });

    res.json({ imported, skipped, total: allSp.length, errors: errors.slice(0, 5) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Proxy helper (stream, for listing) ──────────────────────────────────────
function forwardToShopify(
  req: Request, res: Response,
  shopifyPath: string, method = 'GET', body: string | null = null,
) {
  const domain = req.headers['x-shop-domain'] as string;
  const token  = req.headers['x-shop-token'] as string;

  const options = {
    hostname: `${domain}.myshopify.com`,
    path: shopifyPath, method,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  const proxyReq = https.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode!, { 'Content-Type': 'application/json' });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err: Error) => {
    console.error('Shopify proxy hatası:', err.message);
    res.status(502).json({ error: 'Shopify API bağlantı hatası: ' + err.message });
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
}

export default router;
