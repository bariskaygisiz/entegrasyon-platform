import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/entegrasyon.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(DB_PATH);

// WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL DEFAULT '',
    description   TEXT NOT NULL DEFAULT '',
    price         REAL NOT NULL DEFAULT 0,
    discounted_price REAL,
    cost          REAL NOT NULL DEFAULT 0,
    sku           TEXT NOT NULL DEFAULT '',
    barcode       TEXT NOT NULL DEFAULT '',
    stock         INTEGER NOT NULL DEFAULT 0,
    weight        REAL NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'active',
    category      TEXT NOT NULL DEFAULT '',
    channels      TEXT NOT NULL DEFAULT '[]',
    tags          TEXT NOT NULL DEFAULT '[]',
    media         TEXT NOT NULL DEFAULT '[]',
    has_variants  INTEGER NOT NULL DEFAULT 0,
    variant_options TEXT NOT NULL DEFAULT '[]',
    variant_data  TEXT NOT NULL DEFAULT '{}',
    emoji         TEXT NOT NULL DEFAULT '📦',
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shopify_settings (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    shop_domain   TEXT NOT NULL DEFAULT '',
    access_token  TEXT NOT NULL DEFAULT '',
    connected     INTEGER NOT NULL DEFAULT 0,
    plan          TEXT NOT NULL DEFAULT '',
    shop_name     TEXT NOT NULL DEFAULT '',
    currency      TEXT NOT NULL DEFAULT 'TRY',
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shopify_mappings (
    product_id    TEXT PRIMARY KEY,
    shopify_id    TEXT NOT NULL,
    shopify_title TEXT NOT NULL DEFAULT '',
    handle        TEXT NOT NULL DEFAULT '',
    sku           TEXT NOT NULL DEFAULT '',
    price         REAL NOT NULL DEFAULT 0,
    mapped_at     TEXT NOT NULL,
    type          TEXT NOT NULL DEFAULT 'mapped',
    is_variant    INTEGER NOT NULL DEFAULT 0,
    variant_mappings TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS sync_jobs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT '',
    channel      TEXT NOT NULL DEFAULT 'shopify',
    action       TEXT NOT NULL DEFAULT 'sync',
    status       TEXT NOT NULL DEFAULT 'pending',
    message      TEXT NOT NULL DEFAULT '',
    detail       TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    image       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    shopify_order_id TEXT UNIQUE,
    order_name       TEXT NOT NULL DEFAULT '',
    channel          TEXT NOT NULL DEFAULT 'shopify',
    status           TEXT NOT NULL DEFAULT 'approved',
    customer         TEXT NOT NULL DEFAULT '',
    email            TEXT NOT NULL DEFAULT '',
    phone            TEXT NOT NULL DEFAULT '',
    city             TEXT NOT NULL DEFAULT '',
    district         TEXT NOT NULL DEFAULT '',
    address          TEXT NOT NULL DEFAULT '',
    product_name     TEXT NOT NULL DEFAULT '',
    product_sku      TEXT NOT NULL DEFAULT '',
    product_emoji    TEXT NOT NULL DEFAULT '📦',
    product_price    REAL NOT NULL DEFAULT 0,
    product_category TEXT NOT NULL DEFAULT '',
    qty              INTEGER NOT NULL DEFAULT 1,
    amount           REAL NOT NULL DEFAULT 0,
    cargo_code       TEXT,
    cargo_company    TEXT NOT NULL DEFAULT '',
    payment_method   TEXT NOT NULL DEFAULT '',
    note             TEXT,
    line_items       TEXT NOT NULL DEFAULT '[]',
    date_str         TEXT NOT NULL DEFAULT '',
    shopify_synced_at TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    customer_key  TEXT PRIMARY KEY,
    name          TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL DEFAULT '',
    phone         TEXT NOT NULL DEFAULT '',
    city          TEXT NOT NULL DEFAULT '',
    district      TEXT NOT NULL DEFAULT '',
    address       TEXT NOT NULL DEFAULT '',
    invoice_type  TEXT NOT NULL DEFAULT 'individual',
    tc_no         TEXT NOT NULL DEFAULT '',
    tax_no        TEXT NOT NULL DEFAULT '',
    tax_office    TEXT NOT NULL DEFAULT '',
    notes         TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
`);

// ─── Migrations (sütunlar yoksa ekle) ────────────────────────────────────────
try { db.exec(`ALTER TABLE shopify_settings ADD COLUMN sync_config TEXT NOT NULL DEFAULT '{}'`); } catch { /* zaten var */ }
try { db.exec(`ALTER TABLE products ADD COLUMN vat_rate    INTEGER NOT NULL DEFAULT 20`); } catch { /* zaten var */ }
try { db.exec(`ALTER TABLE products ADD COLUMN vat_included INTEGER NOT NULL DEFAULT 1`);  } catch { /* zaten var */ }
try { db.exec(`ALTER TABLE products ADD COLUMN b2b_price            REAL`); } catch { /* zaten var */ }
try { db.exec(`ALTER TABLE products ADD COLUMN b2b_discounted_price REAL`); } catch { /* zaten var */ }
try { db.exec(`ALTER TABLE shopify_settings ADD COLUMN price_type TEXT NOT NULL DEFAULT 'retail'`); } catch { /* zaten var */ }

// ─── Veri düzeltme: varyantlı ürünlerde stock=0 ama variant_data'da stok var ─
try {
  db.exec(`
    UPDATE products
    SET stock = (
      SELECT COALESCE(SUM(CAST(json_extract(e.value, '$.stock') AS INTEGER)), 0)
      FROM json_each(products.variant_data) AS e
    )
    WHERE has_variants = 1
      AND stock = 0
      AND variant_data != '{}'
      AND variant_data != '[]'
  `);
} catch { /* json_each desteklenmiyorsa atla */ }

export default db;
