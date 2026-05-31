import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { log } from '../lib/log';
import type { Category } from '../types';

const router = Router();

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all() as Category[];
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kategoriler yüklenemedi.' });
  }
});

// ── All unique names (categories table + products) ────────────────────────────
router.get('/names', (_req: Request, res: Response) => {
  try {
    const names = new Set<string>();

    // 1. categories tablosundaki isimler
    const catRows = db.prepare('SELECT name FROM categories').all() as { name: string }[];
    catRows.forEach(r => names.add(r.name));

    // 2. products tablosundaki category alanından isimler
    const prodRows = db.prepare("SELECT category FROM products WHERE category != '' AND category != '[]'").all() as { category: string }[];
    prodRows.forEach(r => {
      try {
        const parsed = JSON.parse(r.category);
        if (Array.isArray(parsed)) parsed.forEach((n: string) => n && names.add(n));
        else if (typeof parsed === 'string' && parsed) names.add(parsed);
      } catch {
        if (r.category) names.add(r.category); // eski düz string format
      }
    });

    res.json([...names].sort((a, b) => a.localeCompare(b, 'tr')));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kategori isimleri yüklenemedi.' });
  }
});

// ── Get single ────────────────────────────────────────────────────────────────
router.get('/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as Category | undefined;
    if (!row) return res.status(404).json({ error: 'Kategori bulunamadı.' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kategori yüklenemedi.' });
  }
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const id  = 'cat_' + Date.now();
    const { name = '', description = '', image = '' } = req.body;

    if (!name.trim()) return res.status(400).json({ error: 'Kategori adı zorunludur.' });

    // Aynı isimde kategori var mı?
    const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name.trim());
    if (existing) return res.status(409).json({ error: 'Bu isimde bir kategori zaten mevcut.' });

    db.prepare(`
      INSERT INTO categories (id, name, description, image, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), description, image, now, now);

    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category;
    log({ channel: 'category', action: 'create', productId: cat.id, productName: cat.name, message: `"${cat.name}" kategorisi oluşturuldu.` });
    res.status(201).json(cat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kategori oluşturulamadı.' });
  }
});

// ── Update ────────────────────────────────────────────────────────────────────
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as Category | undefined;
    if (!existing) return res.status(404).json({ error: 'Kategori bulunamadı.' });

    const now = new Date().toISOString();
    const { name, description, image } = req.body;
    const newName = (name ?? existing.name).trim();

    if (!newName) return res.status(400).json({ error: 'Kategori adı zorunludur.' });

    // Aynı isimde başka bir kategori var mı?
    if (newName !== existing.name) {
      const dup = db.prepare('SELECT id FROM categories WHERE name = ? AND id != ?').get(newName, req.params.id);
      if (dup) return res.status(409).json({ error: 'Bu isimde bir kategori zaten mevcut.' });

      // Ürünlerdeki kategori etiketini de güncelle
      const products = db.prepare(`SELECT id, category FROM products WHERE category LIKE ?`).all(`%${existing.name}%`) as { id: string; category: string }[];
      for (const p of products) {
        try {
          const cats: string[] = JSON.parse(p.category || '[]');
          const idx = cats.indexOf(existing.name);
          if (idx !== -1) {
            cats[idx] = newName;
            db.prepare('UPDATE products SET category = ?, updated_at = ? WHERE id = ?')
              .run(JSON.stringify(cats), now, p.id);
          }
        } catch { /* parse hatası, atla */ }
      }
    }

    db.prepare(`
      UPDATE categories SET name = ?, description = ?, image = ?, updated_at = ? WHERE id = ?
    `).run(
      newName,
      description ?? existing.description,
      image ?? existing.image,
      now,
      req.params.id,
    );

    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as Category;
    const detail = newName !== existing.name ? `"${existing.name}" → "${newName}"` : '';
    log({ channel: 'category', action: 'update', productId: cat.id, productName: cat.name, message: `"${cat.name}" kategorisi güncellendi.`, detail });
    res.json(cat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kategori güncellenemedi.' });
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as Category | undefined;
    if (!existing) return res.status(404).json({ error: 'Kategori bulunamadı.' });

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    log({ channel: 'category', action: 'delete', productId: existing.id, productName: existing.name, message: `"${existing.name}" kategorisi silindi.` });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kategori silinemedi.' });
  }
});

export default router;
