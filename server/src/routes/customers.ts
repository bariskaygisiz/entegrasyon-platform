/**
 * Customers
 * - Sipariş istatistikleri → orders tablosundan türetilir (her zaman güncel)
 * - Profil bilgileri (fatura türü, TC/vergi no vb.) → customers tablosunda saklanır
 *
 * NOT: orders ve customers tablolarının ikisinde de `email` sütunu var;
 * JOIN'de ambiguous column hatasını önlemek için subquery kullanılıyor.
 */
import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// ── Siparişlerden türetilen subquery ──────────────────────────────────────────
// Yalnızca `orders` tablosuna dokunur, JOIN olmaz → ambiguity yok
const ORDER_DERIVED_SUBQUERY = `
  SELECT
    COALESCE(NULLIF(TRIM(email), ''), TRIM(customer)) AS customer_key,
    MAX(TRIM(customer))                                AS ord_name,
    COALESCE(NULLIF(TRIM(email), ''), '')              AS ord_email,
    COALESCE(NULLIF(MAX(NULLIF(TRIM(phone), '')), ''), '')    AS ord_phone,
    COALESCE(NULLIF(MAX(NULLIF(TRIM(city), '')), ''), '')     AS ord_city,
    COALESCE(NULLIF(MAX(NULLIF(TRIM(district), '')), ''), '') AS ord_district,
    COALESCE(NULLIF(MAX(NULLIF(TRIM(address), '')), ''), '')  AS ord_address,
    COUNT(*)              AS order_count,
    ROUND(SUM(amount), 2) AS total_spent,
    MAX(date_str)         AS last_order_date,
    MIN(date_str)         AS first_order_date,
    MAX(created_at)       AS last_order_at,
    MIN(created_at)       AS first_order_at,
    GROUP_CONCAT(DISTINCT channel) AS channels_raw
  FROM orders
  WHERE TRIM(customer) != '' OR TRIM(email) != ''
  GROUP BY COALESCE(NULLIF(TRIM(email), ''), TRIM(customer))
`;

function formatCustomer(d: any, cp: any) {
  return {
    key:            d.customer_key || '',
    name:           (cp?.name     || d.ord_name)     || '',
    email:          (cp?.email    || d.ord_email)    || '',
    phone:          (cp?.phone    || d.ord_phone)    || '',
    city:           (cp?.city     || d.ord_city)     || '',
    district:       (cp?.district || d.ord_district) || '',
    address:        (cp?.address  || d.ord_address)  || '',
    invoiceType:    cp?.invoice_type || 'individual',
    tcNo:           cp?.tc_no      || '',
    taxNo:          cp?.tax_no     || '',
    taxOffice:      cp?.tax_office || '',
    notes:          cp?.notes      || '',
    orderCount:     Number(d.order_count) || 0,
    totalSpent:     Number(d.total_spent) || 0,
    lastOrderDate:  d.last_order_date  || '',
    firstOrderDate: d.first_order_date || '',
    lastOrderAt:    d.last_order_at    || '',
    firstOrderAt:   d.first_order_at   || '',
    channels:       d.channels_raw
      ? [...new Set((d.channels_raw as string).split(','))]
      : [],
  };
}

// ── Profil oku / yoksa orders'dan otomatik oluştur ────────────────────────────
function getOrCreateProfile(key: string, derived: any): any {
  const existing = db.prepare('SELECT * FROM customers WHERE customer_key = ?').get(key);
  if (existing) return existing;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO customers
      (customer_key, name, email, phone, city, district, address,
       invoice_type, tc_no, tax_no, tax_office, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'individual', '', '', '', '', ?, ?)
  `).run(
    key,
    derived.ord_name     || '',
    derived.ord_email    || '',
    derived.ord_phone    || '',
    derived.ord_city     || '',
    derived.ord_district || '',
    derived.ord_address  || '',
    now, now,
  );
  return db.prepare('SELECT * FROM customers WHERE customer_key = ?').get(key);
}

// ── GET /customers ─────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const { search, limit, offset = '0' } = req.query as Record<string, string>;

  // Subquery + LEFT JOIN (ambiguity yok çünkü iç sorgu tamamen çözümlendi)
  const rows = db.prepare(`
    SELECT d.*, cp.name, cp.email, cp.phone, cp.city, cp.district, cp.address,
           cp.invoice_type, cp.tc_no, cp.tax_no, cp.tax_office, cp.notes
    FROM (${ORDER_DERIVED_SUBQUERY}) d
    LEFT JOIN customers cp ON cp.customer_key = d.customer_key
    ORDER BY d.last_order_at DESC
  `).all() as any[];

  let customers = rows.map(r => formatCustomer(r, {
    name:         r.name,
    email:        r.email,
    phone:        r.phone,
    city:         r.city,
    district:     r.district,
    address:      r.address,
    invoice_type: r.invoice_type,
    tc_no:        r.tc_no,
    tax_no:       r.tax_no,
    tax_office:   r.tax_office,
    notes:        r.notes,
  }));

  if (search) {
    const q = search.toLowerCase().trim();
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(q)  ||
      c.email.toLowerCase().includes(q) ||
      c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
      c.city.toLowerCase().includes(q),
    );
  }

  const total = customers.length;
  const data  = limit
    ? customers.slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    : customers;

  res.json({ customers: data, total });
});

// ── GET /customers/:key ────────────────────────────────────────────────────────
router.get('/:key', (req: Request, res: Response) => {
  const key = req.params.key;

  const derived = db.prepare(`
    SELECT * FROM (${ORDER_DERIVED_SUBQUERY}) WHERE customer_key = ?
  `).get(key) as any;

  if (!derived) return res.status(404).json({ error: 'Müşteri bulunamadı.' });

  const profile  = getOrCreateProfile(key, derived);
  const customer = formatCustomer(derived, profile);

  // Sipariş geçmişi
  const orderRows = db.prepare(`
    SELECT id, order_name, channel, status,
           product_name, product_emoji, product_image, product_category,
           qty, amount, date_str, created_at,
           cargo_code, cargo_company, payment_method, note
    FROM orders
    WHERE COALESCE(NULLIF(TRIM(email), ''), TRIM(customer)) = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(key) as any[];

  const orders = orderRows.map((o: any) => ({
    id:              o.id,
    orderName:       o.order_name || `#${o.id}`,
    channel:         o.channel,
    status:          o.status,
    productName:     o.product_name,
    productEmoji:    o.product_emoji,
    productImage:    o.product_image || '',
    productCategory: o.product_category,
    qty:             o.qty,
    amount:          o.amount,
    dateStr:         o.date_str,
    cargoCode:       o.cargo_code,
    cargoCompany:    o.cargo_company,
    paymentMethod:   o.payment_method,
    note:            o.note,
  }));

  res.json({ ...customer, orders });
});

// ── PUT /customers/:key — profil kaydet / güncelle ────────────────────────────
router.put('/:key', (req: Request, res: Response) => {
  const key = req.params.key;
  const {
    name = '', email = '', phone = '', city = '', district = '', address = '',
    invoiceType = 'individual', tcNo = '', taxNo = '', taxOffice = '', notes = '',
  } = req.body;

  const now      = new Date().toISOString();
  const existing = db.prepare('SELECT customer_key FROM customers WHERE customer_key = ?').get(key);

  if (existing) {
    db.prepare(`
      UPDATE customers
      SET name=?, email=?, phone=?, city=?, district=?, address=?,
          invoice_type=?, tc_no=?, tax_no=?, tax_office=?, notes=?, updated_at=?
      WHERE customer_key=?
    `).run(name, email, phone, city, district, address,
           invoiceType, tcNo, taxNo, taxOffice, notes, now, key);
  } else {
    db.prepare(`
      INSERT INTO customers
        (customer_key, name, email, phone, city, district, address,
         invoice_type, tc_no, tax_no, tax_office, notes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(key, name, email, phone, city, district, address,
           invoiceType, tcNo, taxNo, taxOffice, notes, now, now);
  }

  const updated = db.prepare('SELECT * FROM customers WHERE customer_key = ?').get(key) as any;
  res.json({
    key,
    name:        updated.name,
    email:       updated.email,
    phone:       updated.phone,
    city:        updated.city,
    district:    updated.district,
    address:     updated.address,
    invoiceType: updated.invoice_type,
    tcNo:        updated.tc_no,
    taxNo:       updated.tax_no,
    taxOffice:   updated.tax_office,
    notes:       updated.notes,
  });
});

export default router;
