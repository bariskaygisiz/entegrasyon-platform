/**
 * Customers
 * - Sipariş istatistikleri → orders tablosundan türetilir (her zaman güncel)
 * - Profil bilgileri (fatura türü, TC/vergi no vb.) → customers tablosunda saklanır
 */
import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// ── Müşteri anahtarı ifadesi (e-posta varsa e-posta, yoksa isim) ──────────────
const KEY_EXPR = "COALESCE(NULLIF(TRIM(email),''), TRIM(customer))";

// ── Siparişlerden türetilen sütunlar ──────────────────────────────────────────
const ORDER_DERIVED_COLS = `
  ${KEY_EXPR}                                          AS customer_key,
  MAX(TRIM(customer))                                  AS ord_name,
  COALESCE(NULLIF(TRIM(email),''),'')                  AS ord_email,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(phone),'')),''),'')  AS ord_phone,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(city),'')),''),'')   AS ord_city,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(district),'')),''),'') AS ord_district,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(address),'')),''),'') AS ord_address,
  COUNT(*)                                             AS order_count,
  ROUND(SUM(amount),2)                                 AS total_spent,
  MAX(date_str)                                        AS last_order_date,
  MIN(date_str)                                        AS first_order_date,
  MAX(created_at)                                      AS last_order_at,
  MIN(created_at)                                      AS first_order_at,
  GROUP_CONCAT(DISTINCT channel)                       AS channels_raw
`;

// ── Profil satırını oku / yoksa siparişten otomatik oluştur ──────────────────
function getOrCreateProfile(key: string, ordDerived: any): any {
  const existing = db.prepare('SELECT * FROM customers WHERE customer_key = ?').get(key);
  if (existing) return existing;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO customers
      (customer_key, name, email, phone, city, district, address,
       invoice_type, tc_no, tax_no, tax_office, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    key,
    ordDerived.ord_name    || '',
    ordDerived.ord_email   || '',
    ordDerived.ord_phone   || '',
    ordDerived.ord_city    || '',
    ordDerived.ord_district|| '',
    ordDerived.ord_address || '',
    'individual', '', '', '', '', now, now,
  );
  return db.prepare('SELECT * FROM customers WHERE customer_key = ?').get(key);
}

function formatCustomer(ordRow: any, prof: any) {
  return {
    key:            ordRow.customer_key     || '',
    name:           (prof?.name  || ordRow.ord_name)    || '',
    email:          (prof?.email || ordRow.ord_email)   || '',
    phone:          (prof?.phone || ordRow.ord_phone)   || '',
    city:           (prof?.city  || ordRow.ord_city)    || '',
    district:       (prof?.district || ordRow.ord_district) || '',
    address:        (prof?.address  || ordRow.ord_address)  || '',
    invoiceType:    prof?.invoice_type || 'individual',
    tcNo:           prof?.tc_no     || '',
    taxNo:          prof?.tax_no    || '',
    taxOffice:      prof?.tax_office|| '',
    notes:          prof?.notes     || '',
    orderCount:     Number(ordRow.order_count) || 0,
    totalSpent:     Number(ordRow.total_spent) || 0,
    lastOrderDate:  ordRow.last_order_date  || '',
    firstOrderDate: ordRow.first_order_date || '',
    lastOrderAt:    ordRow.last_order_at    || '',
    firstOrderAt:   ordRow.first_order_at   || '',
    channels:       ordRow.channels_raw
      ? [...new Set((ordRow.channels_raw as string).split(','))] : [],
  };
}

// ── GET /customers ─────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const { search, limit, offset = '0' } = req.query as Record<string, string>;

  // Siparişlerden türet, müşteri profilini LEFT JOIN ile ekle
  const rows = db.prepare(`
    SELECT
      ${ORDER_DERIVED_COLS},
      cp.invoice_type,
      cp.tc_no, cp.tax_no, cp.tax_office
    FROM orders o
    LEFT JOIN customers cp ON cp.customer_key = ${KEY_EXPR}
    WHERE TRIM(o.customer) != '' OR TRIM(o.email) != ''
    GROUP BY ${KEY_EXPR}
    ORDER BY MAX(o.created_at) DESC
  `).all() as any[];

  let customers = rows.map(r => formatCustomer(r, {
    name: r.ord_name, email: r.ord_email, phone: r.ord_phone,
    city: r.ord_city, district: r.ord_district, address: r.ord_address,
    invoice_type: r.invoice_type, tc_no: r.tc_no, tax_no: r.tax_no,
    tax_office: r.tax_office, notes: '',
  }));

  if (search) {
    const q = search.toLowerCase().trim();
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(q)  ||
      c.email.toLowerCase().includes(q) ||
      c.phone.replace(/\s/g,'').includes(q.replace(/\s/g,'')) ||
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

  const ordRow = db.prepare(`
    SELECT ${ORDER_DERIVED_COLS}
    FROM orders
    WHERE TRIM(customer) != '' OR TRIM(email) != ''
    GROUP BY ${KEY_EXPR}
    HAVING ${KEY_EXPR} = ?
  `).get(key) as any;

  if (!ordRow) return res.status(404).json({ error: 'Müşteri bulunamadı.' });

  // Profil oku / otomatik oluştur
  const profile = getOrCreateProfile(key, ordRow);
  const customer = formatCustomer(ordRow, profile);

  // Sipariş geçmişi
  const orderRows = db.prepare(`
    SELECT id, order_name, channel, status,
           product_name, product_emoji, product_category,
           qty, amount, date_str, created_at,
           cargo_code, cargo_company, payment_method, note
    FROM orders
    WHERE ${KEY_EXPR} = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(key) as any[];

  const orders = orderRows.map((o: any) => ({
    id:             o.id,
    orderName:      o.order_name || `#${o.id}`,
    channel:        o.channel,
    status:         o.status,
    productName:    o.product_name,
    productEmoji:   o.product_emoji,
    productCategory:o.product_category,
    qty:            o.qty,
    amount:         o.amount,
    dateStr:        o.date_str,
    cargoCode:      o.cargo_code,
    cargoCompany:   o.cargo_company,
    paymentMethod:  o.payment_method,
    note:           o.note,
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

  const now = new Date().toISOString();
  const existing = db.prepare('SELECT customer_key FROM customers WHERE customer_key = ?').get(key);

  if (existing) {
    db.prepare(`
      UPDATE customers SET
        name=?, email=?, phone=?, city=?, district=?, address=?,
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
    name: updated.name, email: updated.email, phone: updated.phone,
    city: updated.city, district: updated.district, address: updated.address,
    invoiceType: updated.invoice_type, tcNo: updated.tc_no,
    taxNo: updated.tax_no, taxOffice: updated.tax_office, notes: updated.notes,
  });
});

export default router;
