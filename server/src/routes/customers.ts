/**
 * Customers — derived from the `orders` table.
 * No separate table; always up-to-date with latest order data.
 */
import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

// ── SQL parçaları ─────────────────────────────────────────────────────────────
// Müşteri anahtarı: e-posta varsa e-posta, yoksa isim
const KEY_EXPR = "COALESCE(NULLIF(TRIM(email),''), TRIM(customer))";

const CUSTOMER_COLS = `
  ${KEY_EXPR}                                         AS customer_key,
  MAX(TRIM(customer))                                  AS name,
  COALESCE(NULLIF(TRIM(email),''),'')                  AS email,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(phone),'')),''),'')  AS phone,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(city),'')),''),'')   AS city,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(district),'')),''),'') AS district,
  COALESCE(NULLIF(MAX(NULLIF(TRIM(address),'')),''),'') AS address,
  COUNT(*)                                             AS order_count,
  ROUND(SUM(amount),2)                                 AS total_spent,
  MAX(date_str)                                        AS last_order_date,
  MIN(date_str)                                        AS first_order_date,
  MAX(created_at)                                      AS last_order_at,
  MIN(created_at)                                      AS first_order_at,
  GROUP_CONCAT(DISTINCT channel)                       AS channels_raw
`;

function formatCustomer(row: any) {
  return {
    key:            row.customer_key  || '',
    name:           row.name          || '',
    email:          row.email         || '',
    phone:          row.phone         || '',
    city:           row.city          || '',
    district:       row.district      || '',
    address:        row.address       || '',
    orderCount:     Number(row.order_count)  || 0,
    totalSpent:     Number(row.total_spent)  || 0,
    lastOrderDate:  row.last_order_date  || '',
    firstOrderDate: row.first_order_date || '',
    lastOrderAt:    row.last_order_at    || '',
    firstOrderAt:   row.first_order_at   || '',
    channels:       row.channels_raw ? [...new Set((row.channels_raw as string).split(','))] : [],
  };
}

// ── GET /customers ─────────────────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const { search, limit, offset = '0' } = req.query as Record<string, string>;

  // Tüm müşterileri sipariş tablosundan türet
  let customers = (db.prepare(`
    SELECT ${CUSTOMER_COLS}
    FROM orders
    WHERE TRIM(customer) != '' OR TRIM(email) != ''
    GROUP BY ${KEY_EXPR}
    ORDER BY MAX(created_at) DESC
  `).all() as any[]).map(formatCustomer);

  // Arama filtresi (client-side — veri seti küçük)
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
  const key = req.params.key; // Express URL-decode eder

  const row = (db.prepare(`
    SELECT ${CUSTOMER_COLS}
    FROM orders
    WHERE TRIM(customer) != '' OR TRIM(email) != ''
    GROUP BY ${KEY_EXPR}
    HAVING ${KEY_EXPR} = ?
  `).get(key) as any);

  if (!row) return res.status(404).json({ error: 'Müşteri bulunamadı.' });

  const customer = formatCustomer(row);

  // Müşteriye ait siparişler
  const orderRows = db.prepare(`
    SELECT id, shopify_order_id, order_name, channel, status,
           product_name, product_emoji, product_category,
           qty, amount, date_str, created_at,
           cargo_code, cargo_company, payment_method, note
    FROM orders
    WHERE ${KEY_EXPR} = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(key) as any[];

  const orders = orderRows.map(o => ({
    id:           o.id,
    orderName:    o.order_name  || `#${o.id}`,
    channel:      o.channel,
    status:       o.status,
    productName:  o.product_name,
    productEmoji: o.product_emoji,
    productCategory: o.product_category,
    qty:          o.qty,
    amount:       o.amount,
    dateStr:      o.date_str,
    cargoCode:    o.cargo_code,
    cargoCompany: o.cargo_company,
    paymentMethod: o.payment_method,
    note:         o.note,
  }));

  res.json({ ...customer, orders });
});

export default router;
