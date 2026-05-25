import { Router, Request, Response } from 'express';
import https from 'https';
import db from '../db/database';
import { ShopifyMappingRow, ShopifySettingsRow, rowToMapping, rowToSettings } from '../types';

const router = Router();

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
  res.json(rowToSettings(row));
});

router.delete('/settings', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM shopify_settings WHERE id = 1').run();
  res.json({ ok: true });
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
  res.json(rowToMapping(row));
});

router.delete('/mappings/:productId', (req: Request, res: Response) => {
  db.prepare('DELETE FROM shopify_mappings WHERE product_id = ?').run(req.params.productId);
  res.json({ ok: true });
});

// ─── Proxy: List Shopify products ─────────────────────────────────────────────
router.get('/products', (req: Request, res: Response) => {
  const domain = req.headers['x-shop-domain'] as string;
  const token  = req.headers['x-shop-token'] as string;

  if (!domain || !token) {
    return res.status(400).json({ error: 'X-Shop-Domain ve X-Shop-Token zorunlu.' });
  }

  const limit = (req.query.limit as string) || '250';
  forwardToShopify(req, res, `/admin/api/2024-01/products.json?limit=${limit}&status=active`);
});

// ─── Proxy: Create Shopify product ───────────────────────────────────────────
router.post('/products', (req: Request, res: Response) => {
  const domain = req.headers['x-shop-domain'] as string;
  const token  = req.headers['x-shop-token'] as string;

  if (!domain || !token) {
    return res.status(400).json({ error: 'X-Shop-Domain ve X-Shop-Token zorunlu.' });
  }

  let body = '';
  req.on('data', (chunk: Buffer) => (body += chunk.toString()));
  req.on('end', () => forwardToShopify(req, res, '/admin/api/2024-01/products.json', 'POST', body));
});

// ─── Health ───────────────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, version: '2.0.0' });
});

// ─── Proxy helper ─────────────────────────────────────────────────────────────
function forwardToShopify(
  req: Request, res: Response,
  shopifyPath: string, method = 'GET', body: string | null = null
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
