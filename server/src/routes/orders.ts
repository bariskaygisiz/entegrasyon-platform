/**
 * Orders — generated deterministically from mock data.
 * In production this would be fetched from marketplace APIs.
 */
import { Router, Request, Response } from 'express';

const router = Router();

const PRODUCTS = [
  { name: 'Samsung Galaxy S24 Ultra', price: 44999, emoji: '📱', sku: 'SGS24U-BLK', category: 'Telefon' },
  { name: 'iPhone 15 Pro 256GB',      price: 64999, emoji: '📱', sku: 'IPH15P-256', category: 'Telefon' },
  { name: 'Samsung Galaxy A55',        price: 12499, emoji: '📱', sku: 'SGSA55-BLK', category: 'Telefon' },
  { name: 'Xiaomi 14 Ultra',           price: 38999, emoji: '📱', sku: 'XI14U-BLK',  category: 'Telefon' },
  { name: 'iPhone 14 128GB',           price: 42999, emoji: '📱', sku: 'IPH14-128',  category: 'Telefon' },
  { name: 'MacBook Air 15" M3',        price: 54999, emoji: '💻', sku: 'MBA15-M3-SLV', category: 'Bilgisayar' },
  { name: 'MacBook Pro 14" M3 Pro',    price: 84999, emoji: '💻', sku: 'MBP14-M3P',  category: 'Bilgisayar' },
  { name: 'Dell XPS 15 OLED',          price: 76999, emoji: '💻', sku: 'DXPS15-OLED', category: 'Bilgisayar' },
  { name: 'Sony WH-1000XM5',           price: 8299,  emoji: '🎧', sku: 'SONYWH-XM5', category: 'Ses Sistemleri' },
  { name: 'AirPods Pro (2. Nesil)',     price: 9499,  emoji: '🎧', sku: 'APP2-WHT',   category: 'Aksesuar' },
];

const CUSTOMERS = [
  { name: 'Ahmet Yılmaz',   email: 'ahmet.yilmaz@email.com',  phone: '0532 111 22 33', city: 'İstanbul', district: 'Kadıköy' },
  { name: 'Fatma Kaya',     email: 'fatma.kaya@email.com',     phone: '0533 222 33 44', city: 'Ankara',   district: 'Çankaya' },
  { name: 'Mehmet Demir',   email: 'mehmet.demir@email.com',   phone: '0534 333 44 55', city: 'İzmir',    district: 'Konak' },
  { name: 'Ayşe Çelik',     email: 'ayse.celik@email.com',     phone: '0535 444 55 66', city: 'İstanbul', district: 'Beşiktaş' },
  { name: 'Mustafa Şahin',  email: 'mustafa.sahin@email.com',  phone: '0536 555 66 77', city: 'Bursa',    district: 'Osmangazi' },
  { name: 'Zeynep Arslan',  email: 'zeynep.arslan@email.com',  phone: '0537 666 77 88', city: 'Antalya',  district: 'Muratpaşa' },
  { name: 'Ali Öztürk',     email: 'ali.ozturk@email.com',     phone: '0538 777 88 99', city: 'İstanbul', district: 'Üsküdar' },
  { name: 'Elif Aydın',     email: 'elif.aydin@email.com',     phone: '0539 888 99 00', city: 'Konya',    district: 'Selçuklu' },
  { name: 'Can Yıldız',     email: 'can.yildiz@email.com',     phone: '0530 999 00 11', city: 'Adana',    district: 'Seyhan' },
  { name: 'Selin Güler',    email: 'selin.guler@email.com',    phone: '0531 000 11 22', city: 'İstanbul', district: 'Şişli' },
];

const CARGO = ['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'PTT Kargo', 'Sürat Kargo'];
const CHANNELS = ['trendyol', 'trendyol', 'trendyol', 'trendyol', 'site', 'site', 'hepsi', 'hepsi', 'n11'];
const STATUSES = ['new', 'new', 'preparing', 'preparing', 'preparing', 'shipped', 'shipped', 'shipped', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'cancelled'];
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function seededRand(seed: number) { const x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); }
function rInt(seed: number, n: number, max: number) { return Math.floor(seededRand(seed * 37 + n * 13) * max); }
function pad(n: number) { return String(n).padStart(2, '0'); }

function generateOrders(count: number) {
  const base = new Date(2026, 4, 22);
  return Array.from({ length: count }, (_, i) => {
    const s = i + 1;
    const product  = PRODUCTS[rInt(s, 1, PRODUCTS.length)];
    const customer = CUSTOMERS[rInt(s, 2, CUSTOMERS.length)];
    const status   = STATUSES[rInt(s, 3, STATUSES.length)];
    const channel  = CHANNELS[rInt(s, 4, CHANNELS.length)];
    const qty      = rInt(s, 5, 3) + 1;
    const cargo    = CARGO[rInt(s, 6, CARGO.length)];
    const d = new Date(base);
    d.setDate(d.getDate() - rInt(s, 7, 30));
    d.setHours(9 + rInt(s, 8, 12), rInt(s, 9, 60), 0, 0);
    const payIdx = rInt(s, 10, 3);
    const installments = rInt(s, 11, 3) + 1;

    return {
      id: 45231 - i,
      customer: customer.name,
      email: customer.email,
      phone: customer.phone,
      city: customer.city,
      district: customer.district,
      address: `Örnek Mah. No:${s % 100 + 1}`,
      productName: product.name,
      productSku: product.sku,
      productEmoji: product.emoji,
      productPrice: product.price,
      productCategory: product.category,
      qty, channel, status,
      dateStr: `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      amount: product.price * qty,
      cargoCode: (status === 'shipped' || status === 'delivered') ? 'TK' + (9284700 + i) : null,
      cargoCompany: cargo,
      paymentMethod: payIdx === 0 ? 'Havale/EFT' : payIdx === 1 ? 'Kapıda Ödeme' : `Kredi Kartı (${installments} Taksit)`,
      note: rInt(s, 12, 5) === 0 ? 'Lütfen hediye paketi yapınız.' : null,
    };
  });
}

// Generate once and cache
const ALL_ORDERS = generateOrders(150);

router.get('/', (req: Request, res: Response) => {
  const { status, search, limit = '50', offset = '0' } = req.query as Record<string, string>;
  let orders = ALL_ORDERS;
  if (status && status !== 'all') orders = orders.filter(o => o.status === status);
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o =>
      o.customer.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q) ||
      String(o.id).includes(q)
    );
  }
  const total = orders.length;
  orders = orders.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  res.json({ orders, total });
});

router.get('/:id', (req: Request, res: Response) => {
  const order = ALL_ORDERS.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  res.json(order);
});

export default router;
