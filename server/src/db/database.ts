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
`);

export default db;
