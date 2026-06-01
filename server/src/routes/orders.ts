/**
 * Orders — reads from the `orders` SQLite table.
 * Orders are synced from Shopify via POST /api/shopify/sync-orders.
 */
import { Router, Request, Response } from 'express';
import db from '../db/database';

const router = Router();

interface OrderRow {
  id: number;
  shopify_order_id: string | null;
  order_name: string;
  channel: string;
  status: string;
  customer: string;
  email: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  postal_code: string;
  tc_no: string;
  shipping_method: string;
  billing_name: string;
  billing_address: string;
  billing_district: string;
  billing_city: string;
  billing_postal: string;
  product_name: string;
  product_sku: string;
  product_emoji: string;
  product_image: string;
  product_price: number;
  product_category: string;
  qty: number;
  amount: number;
  cargo_code: string | null;
  cargo_company: string;
  payment_method: string;
  note: string | null;
  line_items: string;
  date_str: string;
  shopify_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToOrder(row: OrderRow) {
  let lineItems: any[] = [];
  try { lineItems = JSON.parse(row.line_items || '[]'); } catch { /* ignore */ }

  return {
    id:              row.id,
    shopifyOrderId:  row.shopify_order_id || null,
    orderName:       row.order_name || `#${row.id}`,
    customer:        row.customer,
    email:           row.email,
    phone:           row.phone,
    city:            row.city,
    district:        row.district,
    address:         row.address,
    postalCode:      row.postal_code      || '',
    tcNo:            row.tc_no            || '',
    shippingMethod:  row.shipping_method  || '',
    billingName:     row.billing_name     || '',
    billingAddress:  row.billing_address  || '',
    billingDistrict: row.billing_district || '',
    billingCity:     row.billing_city     || '',
    billingPostal:   row.billing_postal   || '',
    productName:     row.product_name,
    productSku:      row.product_sku,
    productEmoji:    row.product_emoji,
    productImage:    row.product_image || '',
    productPrice:    row.product_price,
    productCategory: row.product_category,
    qty:             row.qty,
    channel:         row.channel,
    dateStr:         row.date_str,
    amount:          row.amount,
    status:          row.status,
    cargoCode:       row.cargo_code,
    cargoCompany:    row.cargo_company,
    paymentMethod:   row.payment_method,
    note:            row.note,
    lineItems,
  };
}

router.get('/', (req: Request, res: Response) => {
  const { status, search, limit, offset = '0' } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: any[] = [];

  if (status && status !== 'all') {
    if (status === 'approved') {
      conditions.push("(status = 'approved' OR status = 'new')");
    } else {
      conditions.push('status = ?');
      params.push(status);
    }
  }

  if (search) {
    const q = `%${search.toLowerCase()}%`;
    conditions.push(
      '(LOWER(customer) LIKE ? OR LOWER(product_name) LIKE ? OR CAST(id AS TEXT) LIKE ? OR LOWER(order_name) LIKE ?)',
    );
    params.push(q, q, q, q);
  }

  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const baseQuery = `SELECT * FROM orders${where}`;
  const countQuery = `SELECT COUNT(*) as cnt FROM orders${where}`;

  const countRow = (db.prepare(countQuery) as any).get(...params) as { cnt: number };
  const total = countRow.cnt;

  const orderBy = ' ORDER BY id DESC';
  let dataQuery = baseQuery + orderBy;
  const dataParams = [...params];

  if (limit) {
    dataQuery += ' LIMIT ? OFFSET ?';
    dataParams.push(parseInt(limit), parseInt(offset));
  }

  const rows = (db.prepare(dataQuery) as any).all(...dataParams) as OrderRow[];
  res.json({ orders: rows.map(rowToOrder), total });
});

router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(parseInt(req.params.id)) as OrderRow | undefined;
  if (!row) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  res.json(rowToOrder(row));
});

const VALID_STATUSES = ['approved', 'preparing', 'shipped', 'delivered', 'cancelled'];

router.patch('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(parseInt(req.params.id)) as OrderRow | undefined;
  if (!row) return res.status(404).json({ error: 'Sipariş bulunamadı.' });

  const { status } = req.body;
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Geçersiz durum.' });
    db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), row.id);
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(row.id) as OrderRow;
  res.json(rowToOrder(updated));
});

export default router;
