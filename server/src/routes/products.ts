import { Router, Request, Response } from 'express';
import db from '../db/database';
import { ProductRow, rowToProduct } from '../types';

const router = Router();

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
      status = 'draft', category = '', channels = [], tags = [], media = [],
      has_variants = false, variant_options = [], variant_data = {}, emoji = '📦',
    } = req.body;

    db.prepare(`
      INSERT INTO products (id, name, description, price, discounted_price, cost, sku, barcode,
        stock, weight, status, category, channels, tags, media, has_variants, variant_options,
        variant_data, emoji, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, description, price, discounted_price, cost, sku, barcode,
      stock, weight, status, category,
      JSON.stringify(channels), JSON.stringify(tags), JSON.stringify(media),
      has_variants ? 1 : 0, JSON.stringify(variant_options), JSON.stringify(variant_data),
      emoji, now, now
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow;
    res.status(201).json(rowToProduct(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ürün oluşturulamadı.' });
  }
});

// ── Update product ────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ürün bulunamadı.' });

    const now = new Date().toISOString();
    const {
      name, description, price, discounted_price, cost, sku, barcode, stock,
      weight, status, category, channels, tags, media, has_variants,
      variant_options, variant_data, emoji,
    } = req.body;

    db.prepare(`
      UPDATE products SET
        name = ?, description = ?, price = ?, discounted_price = ?, cost = ?,
        sku = ?, barcode = ?, stock = ?, weight = ?, status = ?, category = ?,
        channels = ?, tags = ?, media = ?, has_variants = ?, variant_options = ?,
        variant_data = ?, emoji = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name, description, price, discounted_price ?? null, cost,
      sku, barcode, stock, weight, status, category,
      JSON.stringify(channels ?? []), JSON.stringify(tags ?? []), JSON.stringify(media ?? []),
      has_variants ? 1 : 0, JSON.stringify(variant_options ?? []), JSON.stringify(variant_data ?? {}),
      emoji ?? '📦', now,
      req.params.id
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as ProductRow;
    res.json(rowToProduct(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ürün güncellenemedi.' });
  }
});

// ── Delete product ────────────────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ürün bulunamadı.' });
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM shopify_mappings WHERE product_id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ürün silinemedi.' });
  }
});

export default router;
