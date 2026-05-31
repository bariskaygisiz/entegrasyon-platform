import { Router, Request, Response } from 'express';
import db from '../db/database';
import { ProductRow, rowToProduct } from '../types';
import { log } from '../lib/log';
import { runImageSync } from './shopify';

const router = Router();

// ── CSV Helpers ───────────────────────────────────────────────────────────────
function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim().replace(/^"|"$/g, ''); });
    return obj;
  });
}

// ── List products ─────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, search, limit = '250', offset = '0' } = req.query as Record<string, string>;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: unknown[] = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?'; params.push(status);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR sku LIKE ? OR category LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = db.prepare(sql).all(...params) as ProductRow[];
    const total = (db.prepare('SELECT COUNT(*) as c FROM products WHERE 1=1' +
      (status && status !== 'all' ? ' AND status = ?' : '')).get(...(status && status !== 'all' ? [status] : [])) as { c: number }).c;

    res.json({ products: rows.map(rowToProduct), total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ürünler yüklenemedi.' });
  }
});

// ── Get single product ────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow | undefined;
    if (!row) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    res.json(rowToProduct(row));
  } catch (err) {
    res.status(500).json({ error: 'Ürün yüklenemedi.' });
  }
});

// ── Create product ────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const id = 'new_' + Date.now();
    const {
      name = 'Yeni Ürün', description = '', price = 0, discounted_price = null,
      cost = 0, sku = '', barcode = '', stock = 0, weight = 0,
      status = 'draft', category = [], channels = [], tags = [], media = [],
      has_variants = false, variant_options = [], variant_data = {}, emoji = '📦',
      vat_rate = 20, vat_included = true,
      b2b_price = null, b2b_discounted_price = null,
    } = req.body;

    db.prepare(`
      INSERT INTO products (id, name, description, price, discounted_price, cost, sku, barcode,
        stock, weight, status, category, channels, tags, media, has_variants, variant_options,
        variant_data, emoji, vat_rate, vat_included, b2b_price, b2b_discounted_price, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, description, price, discounted_price, cost, sku, barcode,
      stock, weight, status, JSON.stringify(Array.isArray(category) ? category : (category ? [category] : [])),
      JSON.stringify(channels), JSON.stringify(tags), JSON.stringify(media),
      has_variants ? 1 : 0, JSON.stringify(variant_options), JSON.stringify(variant_data),
      emoji, vat_rate, vat_included ? 1 : 0, b2b_price, b2b_discounted_price, now, now
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow;
    const product = rowToProduct(row);
    log({
      channel: 'product', action: 'create', status: 'success',
      productId: id, productName: product.name,
      message: 'Ürün oluşturuldu.',
      detail: [
        product.price ? `Fiyat: ${product.price}₺` : '',
        product.stock != null ? `Stok: ${product.stock}` : '',
        product.sku ? `SKU: ${product.sku}` : '',
      ].filter(Boolean).join(' · '),
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ürün oluşturulamadı.' });
  }
});

// ── CSV Import ────────────────────────────────────────────────────────────────
router.post('/import-csv', (req: Request, res: Response) => {
  try {
    const csvText: string = req.body?.csv;
    if (!csvText?.trim()) return res.status(400).json({ error: 'CSV verisi boş.' });

    const rows = parseCSV(csvText);
    if (rows.length === 0) return res.status(400).json({ error: 'CSV başlık satırı eksik veya dosya boş.' });

    let created = 0, updated = 0;
    const errors: { row: number; message: string }[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name    = row.name?.trim() || 'İsimsiz Ürün';
        const status  = (['active','draft','archived'] as const).includes(row.status as any) ? row.status as 'active'|'draft'|'archived' : 'draft';
        const price           = parseFloat(row.price)            || 0;
        const discountedPrice = row.discounted_price?.trim()      ? (parseFloat(row.discounted_price) || null) : null;
        const cost            = parseFloat(row.cost)             || 0;
        const sku             = row.sku?.trim()                  || '';
        const barcode         = row.barcode?.trim()              || '';
        const stock           = parseInt(row.stock)              || 0;
        const weight          = parseFloat(row.weight)           || 0;
        const category        = row.category
          ? row.category.split(';').map((c: string) => c.trim()).filter(Boolean)
          : [];
        const vatRate         = parseInt(row.vat_rate)           || 20;
        const tags            = row.tags ? row.tags.split(';').map((t: string) => t.trim()).filter(Boolean) : [];

        // SKU ile mevcut ürünü bul — varsa güncelle, yoksa oluştur
        const existingRow = sku
          ? db.prepare('SELECT * FROM products WHERE sku = ?').get(sku) as ProductRow | undefined
          : undefined;

        if (existingRow) {
          db.prepare(`
            UPDATE products SET
              name=?, status=?, category=?, price=?, discounted_price=?,
              cost=?, barcode=?, stock=?, weight=?, tags=?, vat_rate=?, updated_at=?
            WHERE id=?
          `).run(name, status, JSON.stringify(category), price, discountedPrice, cost, barcode, stock, weight,
                 JSON.stringify(tags), vatRate, now, existingRow.id);
          updated++;
        } else {
          const id = 'csv_' + Date.now() + '_' + i;
          db.prepare(`
            INSERT INTO products
              (id, name, description, price, discounted_price, cost, sku, barcode,
               stock, weight, status, category, channels, tags, media,
               has_variants, variant_options, variant_data, emoji, vat_rate, vat_included, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(id, name, '', price, discountedPrice, cost, sku, barcode,
                 stock, weight, status, JSON.stringify(category),
                 JSON.stringify([]), JSON.stringify(tags), JSON.stringify([]),
                 0, JSON.stringify([]), JSON.stringify({}), '📦', vatRate, 1, now, now);
          created++;
        }
      } catch (rowErr: any) {
        errors.push({ row: i + 2, message: rowErr.message });
      }
    }

    log({
      channel: 'product', action: 'create', status: errors.length === 0 ? 'success' : 'error',
      message: `CSV aktarımı: ${created} oluşturuldu, ${updated} güncellendi${errors.length ? `, ${errors.length} hata` : ''}.`,
      detail: `Toplam satır: ${rows.length}`,
    });

    res.json({ created, updated, total: rows.length, errors });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'CSV aktarımı başarısız: ' + err.message });
  }
});

// ── Update product ────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existingRow = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow | undefined;
    if (!existingRow) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    const existing = rowToProduct(existingRow);

    const now = new Date().toISOString();
    const {
      name, description, price, discounted_price, cost, sku, barcode, stock,
      weight, status, category, channels, tags, media, has_variants,
      variant_options, variant_data, emoji,
      vat_rate, vat_included,
      b2b_price, b2b_discounted_price,
    } = req.body;

    db.prepare(`
      UPDATE products SET
        name = ?, description = ?, price = ?, discounted_price = ?, cost = ?,
        sku = ?, barcode = ?, stock = ?, weight = ?, status = ?, category = ?,
        channels = ?, tags = ?, media = ?, has_variants = ?, variant_options = ?,
        variant_data = ?, emoji = ?, vat_rate = ?, vat_included = ?,
        b2b_price = ?, b2b_discounted_price = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name, description, price, discounted_price ?? null, cost,
      sku, barcode, stock, weight, status,
      JSON.stringify(Array.isArray(category) ? category : (category ? [category] : [])),
      JSON.stringify(channels ?? []), JSON.stringify(tags ?? []), JSON.stringify(media ?? []),
      has_variants ? 1 : 0, JSON.stringify(variant_options ?? []), JSON.stringify(variant_data ?? {}),
      emoji ?? '📦',
      vat_rate ?? existing.vat_rate ?? 20,
      (vat_included !== undefined ? (vat_included ? 1 : 0) : (existing.vat_included ? 1 : 0)),
      b2b_price !== undefined ? (b2b_price || null) : existing.b2b_price,
      b2b_discounted_price !== undefined ? (b2b_discounted_price || null) : existing.b2b_discounted_price,
      now,
      req.params.id
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow;
    const product = rowToProduct(row);

    // ── Değişiklik analizi ────────────────────────────────────────────────────
    const changedFields: string[] = [];
    const changeDetails: string[] = [];
    const sLabels: Record<string, string> = { active: 'Aktif', draft: 'Taslak', archived: 'Arşiv' };

    if (name !== existing.name) changedFields.push('ürün adı');
    if (description !== existing.description) changedFields.push('açıklama');
    if (JSON.stringify(category) !== JSON.stringify(existing.category)) changedFields.push('kategori');

    if (status !== existing.status) {
      changedFields.push('durum');
      changeDetails.push(`Durum: ${sLabels[existing.status] || existing.status} → ${sLabels[status] || status}`);
    }

    if (!has_variants) {
      if (Number(price) !== existing.price) {
        changedFields.push('fiyat');
        changeDetails.push(`Fiyat: ${existing.price}₺ → ${price}₺`);
      }
      if ((discounted_price ?? null) !== (existing.discounted_price ?? null)) changedFields.push('indirimli fiyat');
      if (Number(stock) !== existing.stock) {
        changedFields.push('stok');
        changeDetails.push(`Stok: ${existing.stock} → ${stock}`);
      }
      if (sku !== existing.sku || barcode !== existing.barcode) changedFields.push('SKU/barkod');
      if (Number(weight) !== existing.weight) changedFields.push('ağırlık');
    } else {
      const oldVd: Record<string, any> = existing.variant_data || {};
      const newVd: Record<string, any> = variant_data || {};
      const allCombos = [...new Set([...Object.keys(oldVd), ...Object.keys(newVd)])];
      let vPriceChanged = false, vStockChanged = false, vSkuChanged = false;
      for (const combo of allCombos) {
        const o = oldVd[combo] || {};
        const n = newVd[combo] || {};
        if (o.price !== n.price || o.disc !== n.disc) vPriceChanged = true;
        if (String(o.stock || '0') !== String(n.stock || '0')) vStockChanged = true;
        if (o.sku !== n.sku || o.barcode !== n.barcode) vSkuChanged = true;
      }
      if (vPriceChanged) changedFields.push('varyant fiyatları');
      if (vStockChanged) changedFields.push('varyant stokları');
      if (vSkuChanged) changedFields.push('varyant SKU/barkod');
    }

    const mediaChanged = JSON.stringify(media ?? []) !== JSON.stringify(existing.media ?? []);
    if (mediaChanged) changedFields.push('görseller');

    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const logMessage = changedFields.length > 0
      ? changedFields.map(cap).join(', ') + ' güncellendi.'
      : 'Ürün güncellendi.';
    const logDetail = changeDetails.join(' · ');

    log({
      channel: 'product', action: 'update', status: 'success',
      productId: req.params.id, productName: product.name,
      message: logMessage,
      detail: logDetail,
    });

    // Yanıtı hemen gönder — görsel sync yanıtı asla bloke etmemeli
    res.json(product);

    // Görsel değiştiyse Shopify'a eşleştirilen ürünler için sync'i arka planda tetikle
    if (mediaChanged) {
      const productId = req.params.id;
      setImmediate(() => {
        try {
          const hasMapping = db.prepare('SELECT id FROM shopify_mappings WHERE product_id = ?').get(productId);
          if (hasMapping) {
            runImageSync(productId).catch(e =>
              console.error(`[image-sync] ${productId}: ${e.message}`)
            );
          }
        } catch (e: any) {
          console.error(`[image-sync-trigger] ${productId}: ${e.message}`);
        }
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ürün güncellenemedi.' });
  }
});

// ── Patch product (kısmi güncelleme — şu an sadece status) ───────────────────
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const existingRow = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow | undefined;
    if (!existingRow) return res.status(404).json({ error: 'Ürün bulunamadı.' });

    const now = new Date().toISOString();
    const { status, category } = req.body;

    if (status !== undefined) {
      const allowed = ['active', 'draft', 'archived'];
      if (!allowed.includes(status)) return res.status(400).json({ error: 'Geçersiz durum.' });
      db.prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?')
        .run(status, now, req.params.id);
    }

    if (category !== undefined) {
      const cats = Array.isArray(category) ? category : (category ? [category] : []);
      db.prepare('UPDATE products SET category = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(cats), now, req.params.id);
    }

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow;
    const product = rowToProduct(row);

    const sLabels: Record<string, string> = { active: 'Aktif', draft: 'Taslak', archived: 'Arşiv' };
    log({
      channel: 'product', action: 'update', status: 'success',
      productId: req.params.id, productName: product.name,
      message: status !== undefined ? `Durum: ${sLabels[status] || status}` : 'Ürün güncellendi.',
    });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ürün güncellenemedi.' });
  }
});

// ── Delete product ────────────────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id, name FROM products WHERE id = ?').get(req.params.id) as { id: string; name: string } | undefined;
    if (!existing) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM shopify_mappings WHERE product_id = ?').run(req.params.id);
    log({
      channel: 'product', action: 'delete', status: 'success',
      productId: req.params.id, productName: existing.name,
      message: 'Ürün silindi.',
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ürün silinemedi.' });
  }
});

export default router;
