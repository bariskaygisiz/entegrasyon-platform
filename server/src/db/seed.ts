/**
 * Seed the database with mock products.
 * Run once: npm run seed --workspace=server
 */
import db from './database';

const PRODUCTS = [
  { name: 'Samsung Galaxy S24 Ultra', price: 44999, emoji: '📱', sku: 'SGS24U-BLK', category: 'Telefon' },
  { name: 'iPhone 15 Pro 256GB',      price: 64999, emoji: '📱', sku: 'IPH15P-256', category: 'Telefon' },
  { name: 'Samsung Galaxy A55',        price: 12499, emoji: '📱', sku: 'SGSA55-BLK', category: 'Telefon' },
  { name: 'Xiaomi 14 Ultra',           price: 38999, emoji: '📱', sku: 'XI14U-BLK',  category: 'Telefon' },
  { name: 'iPhone 14 128GB',           price: 42999, emoji: '📱', sku: 'IPH14-128',  category: 'Telefon' },
  { name: 'MacBook Air 15" M3',        price: 54999, emoji: '💻', sku: 'MBA15-M3-SLV', category: 'Bilgisayar' },
  { name: 'MacBook Pro 14" M3 Pro',    price: 84999, emoji: '💻', sku: 'MBP14-M3P',  category: 'Bilgisayar' },
  { name: 'Dell XPS 15 OLED',          price: 76999, emoji: '💻', sku: 'DXPS15-OLED', category: 'Bilgisayar' },
  { name: 'Lenovo ThinkPad X1 Carbon', price: 62999, emoji: '💻', sku: 'LTPX1C-G12', category: 'Bilgisayar' },
  { name: 'Sony WH-1000XM5',           price: 8299,  emoji: '🎧', sku: 'SONYWH-XM5', category: 'Ses Sistemleri' },
  { name: 'AirPods Pro (2. Nesil)',     price: 9499,  emoji: '🎧', sku: 'APP2-WHT',   category: 'Aksesuar' },
  { name: 'Samsung 65" QLED 4K TV',    price: 34999, emoji: '📺', sku: 'SQLED65-4K', category: 'Televizyon' },
  { name: 'LG 27" 4K IPS Monitor',     price: 9399,  emoji: '🖥️', sku: 'LG27-4K',   category: 'Monitör' },
  { name: 'Logitech MX Keys Klavye',   price: 2499,  emoji: '⌨️', sku: 'LMXKEYS',   category: 'Aksesuar' },
  { name: 'Apple Watch Series 9',      price: 18999, emoji: '⌚', sku: 'AW9-45MM',   category: 'Aksesuar' },
  { name: 'Samsung Galaxy Watch 6',    price: 9999,  emoji: '⌚', sku: 'SGW6-44MM',  category: 'Aksesuar' },
  { name: 'iPad Pro 12.9" M2',         price: 39999, emoji: '📱', sku: 'IPPR129-M2', category: 'Tablet' },
  { name: 'Samsung Galaxy Tab S9+',    price: 24999, emoji: '📱', sku: 'SGTS9P',     category: 'Tablet' },
  { name: 'Dyson V15 Detect',          price: 14999, emoji: '🧹', sku: 'DYV15-D',    category: 'Ev Elektroniği' },
  { name: 'Nikon Z50 II Kit',          price: 34999, emoji: '📷', sku: 'NIKZ50-II',  category: 'Fotoğraf' },
];

const CHANNEL_SETS = [
  ['trendyol'], ['trendyol', 'ikas'], ['trendyol', 'hepsi'],
  ['trendyol', 'hepsi', 'n11', 'ikas'], ['hepsi', 'ikas'], ['ikas'],
  ['trendyol', 'n11'], ['hepsi', 'n11'], ['trendyol', 'shopify'],
  ['shopify'], ['trendyol', 'hepsi', 'ticimax'], ['ticimax'],
];

const VARIANTS_D = ['', ' - Siyah', ' - Beyaz', ' - Gümüş', ' - Uzay Grisi', ' - Altın', ' - Mavi', ' - Kırmızı', ' - Yeşil', ' - Mor'];
const STATUSES = ['active', 'active', 'active', 'active', 'active', 'active', 'active', 'draft', 'draft', 'archived'];

function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}
function rInt(seed: number, n: number, max: number) {
  return Math.floor(seededRand(seed * 37 + n * 13) * max);
}

function nowISO() {
  return new Date().toISOString();
}

const existing = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number };
if (existing.c > 0) {
  console.log(`Database already seeded (${existing.c} products). Skipping.`);
  process.exit(0);
}

const insert = db.prepare(`
  INSERT INTO products (id, name, description, price, discounted_price, cost, sku, barcode, stock,
    weight, status, category, channels, tags, media, has_variants, variant_options, variant_data,
    emoji, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', '{}', ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  let id = 1;
  for (let variantIdx = 0; variantIdx < VARIANTS_D.length; variantIdx++) {
    for (const base of PRODUCTS) {
      const s = id;
      const variant = VARIANTS_D[variantIdx];
      const priceAdj = 1 + (rInt(s, 24, 21) - 10) / 100;
      const price = Math.round(base.price * priceAdj / 100) * 100 || base.price;
      const cost  = Math.round(price * (0.72 + rInt(s, 25, 16) / 100) / 100) * 100;
      const stockRaw = rInt(s, 22, 10);
      let stock: number;
      if      (stockRaw === 0) stock = 0;
      else if (stockRaw <= 2)  stock = rInt(s, 23, 40) + 5;
      else if (stockRaw <= 3)  stock = rInt(s, 23, 3) + 1;
      else                     stock = rInt(s, 23, 80) + 10;

      const status = STATUSES[rInt(s, 29, STATUSES.length)];
      const channels = CHANNEL_SETS[rInt(s, 26, CHANNEL_SETS.length)];
      const weight = (0.1 + rInt(s, 28, 50) / 10).toFixed(1);
      const daysAgo = rInt(s, 40, 365);
      const created = new Date(2026, 4, 22);
      created.setDate(created.getDate() - daysAgo);

      const discountRates = [0, 0, 0, 5, 10, 10, 15, 20, 25, 30];
      const discountRate = discountRates[rInt(s, 27, discountRates.length)];
      const discountedPrice = discountRate > 0 ? Math.round(price * (1 - discountRate / 100) / 100) * 100 : null;

      insert.run(
        String(id),
        base.name + variant,
        `${base.name}${variant} — ${base.category.toLowerCase()} kategorisinde öne çıkan ürün.`,
        price,
        discountedPrice,
        cost,
        base.sku + (variant ? '-' + (variantIdx + 1) : ''),
        '868' + String(s).padStart(10, '0'),
        stock,
        parseFloat(weight),
        status,
        base.category,
        JSON.stringify(channels),
        JSON.stringify([base.category, base.name.split(' ')[0]]),
        '[]',
        base.emoji,
        created.toISOString(),
        nowISO()
      );
      id++;
      if (id > 200) break;  // seed 200 products
    }
    if (id > 200) break;
  }
});

insertMany();

const count = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
console.log(`✅ Seeded ${count} products.`);
