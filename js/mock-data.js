/* ===================================
   MOCK DATA — SHARED ACROSS PAGES
   =================================== */

const PRODUCTS = [
  { name: 'Samsung Galaxy S24 Ultra', price: 44999, emoji: '📱', sku: 'SGS24U-BLK', category: 'Telefon' },
  { name: 'iPhone 15 Pro 256GB', price: 64999, emoji: '📱', sku: 'IPH15P-256', category: 'Telefon' },
  { name: 'Samsung Galaxy A55', price: 12499, emoji: '📱', sku: 'SGSA55-BLK', category: 'Telefon' },
  { name: 'Xiaomi 14 Ultra', price: 38999, emoji: '📱', sku: 'XI14U-BLK', category: 'Telefon' },
  { name: 'iPhone 14 128GB', price: 42999, emoji: '📱', sku: 'IPH14-128', category: 'Telefon' },
  { name: 'MacBook Air 15" M3', price: 54999, emoji: '💻', sku: 'MBA15-M3-SLV', category: 'Bilgisayar' },
  { name: 'MacBook Pro 14" M3 Pro', price: 84999, emoji: '💻', sku: 'MBP14-M3P', category: 'Bilgisayar' },
  { name: 'Dell XPS 15 OLED', price: 76999, emoji: '💻', sku: 'DXPS15-OLED', category: 'Bilgisayar' },
  { name: 'Lenovo ThinkPad X1 Carbon', price: 62999, emoji: '💻', sku: 'LTPX1C-G12', category: 'Bilgisayar' },
  { name: 'Sony WH-1000XM5', price: 8299, emoji: '🎧', sku: 'SONYWH-XM5', category: 'Ses Sistemleri' },
  { name: 'AirPods Pro (2. Nesil)', price: 9499, emoji: '🎧', sku: 'APP2-WHT', category: 'Aksesuar' },
  { name: 'Samsung 65" QLED 4K TV', price: 34999, emoji: '📺', sku: 'SQLED65-4K', category: 'Televizyon' },
  { name: 'LG 27" 4K IPS Monitor', price: 9399, emoji: '🖥️', sku: 'LG27-4K', category: 'Monitör' },
  { name: 'Logitech MX Keys Klavye', price: 2499, emoji: '⌨️', sku: 'LMXKEYS', category: 'Aksesuar' },
  { name: 'Apple Watch Series 9', price: 18999, emoji: '⌚', sku: 'AW9-45MM', category: 'Aksesuar' },
  { name: 'Samsung Galaxy Watch 6', price: 9999, emoji: '⌚', sku: 'SGW6-44MM', category: 'Aksesuar' },
  { name: 'iPad Pro 12.9" M2', price: 39999, emoji: '📱', sku: 'IPPR129-M2', category: 'Tablet' },
  { name: 'Samsung Galaxy Tab S9+', price: 24999, emoji: '📱', sku: 'SGTS9P', category: 'Tablet' },
  { name: 'Dyson V15 Detect', price: 14999, emoji: '🧹', sku: 'DYV15-D', category: 'Ev Elektroniği' },
  { name: 'Nikon Z50 II Kit', price: 34999, emoji: '📷', sku: 'NIKZ50-II', category: 'Fotoğraf' },
];

const CUSTOMERS = [
  { name: 'Ahmet Yılmaz',    email: 'ahmet.yilmaz@email.com',    phone: '0532 111 22 33', city: 'İstanbul', district: 'Kadıköy',     address: 'Moda Cad. No:12 D:5' },
  { name: 'Fatma Kaya',      email: 'fatma.kaya@email.com',       phone: '0533 222 33 44', city: 'Ankara',   district: 'Çankaya',     address: 'Tunalı Hilmi Cad. No:48' },
  { name: 'Mehmet Demir',    email: 'mehmet.demir@email.com',     phone: '0534 333 44 55', city: 'İzmir',    district: 'Konak',       address: 'Kordon Boyu No:7' },
  { name: 'Ayşe Çelik',      email: 'ayse.celik@email.com',       phone: '0535 444 55 66', city: 'İstanbul', district: 'Beşiktaş',    address: 'Barbaros Bulvarı No:22' },
  { name: 'Mustafa Şahin',   email: 'mustafa.sahin@email.com',    phone: '0536 555 66 77', city: 'Bursa',    district: 'Osmangazi',   address: 'Atatürk Cad. No:33' },
  { name: 'Zeynep Arslan',   email: 'zeynep.arslan@email.com',    phone: '0537 666 77 88', city: 'Antalya',  district: 'Muratpaşa',   address: 'Cumhuriyet Cad. No:14' },
  { name: 'Ali Öztürk',      email: 'ali.ozturk@email.com',       phone: '0538 777 88 99', city: 'İstanbul', district: 'Üsküdar',     address: 'Bağlarbaşı Sok. No:9' },
  { name: 'Elif Aydın',      email: 'elif.aydin@email.com',       phone: '0539 888 99 00', city: 'Konya',    district: 'Selçuklu',    address: 'Mevlana Cad. No:56' },
  { name: 'Can Yıldız',      email: 'can.yildiz@email.com',       phone: '0530 999 00 11', city: 'Adana',    district: 'Seyhan',      address: 'Ziyapaşa Bulvarı No:18' },
  { name: 'Selin Güler',     email: 'selin.guler@email.com',      phone: '0531 000 11 22', city: 'İstanbul', district: 'Şişli',       address: 'Halaskargazi Cad. No:71' },
  { name: 'Burak Koç',       email: 'burak.koc@email.com',        phone: '0532 123 45 67', city: 'Kayseri',  district: 'Melikgazi',   address: 'Gevher Nesibe Cad. No:30' },
  { name: 'Deniz Polat',     email: 'deniz.polat@email.com',      phone: '0533 234 56 78', city: 'İstanbul', district: 'Maltepe',     address: 'Bağdat Cad. No:210' },
  { name: 'Gizem Aslan',     email: 'gizem.aslan@email.com',      phone: '0534 345 67 89', city: 'Mersin',   district: 'Mezitli',     address: 'Üniversite Blv. No:8' },
  { name: 'Serkan Doğan',    email: 'serkan.dogan@email.com',     phone: '0535 456 78 90', city: 'Gaziantep',district: 'Şahinbey',    address: 'İnönü Cad. No:42' },
  { name: 'Merve Aksoy',     email: 'merve.aksoy@email.com',      phone: '0536 567 89 01', city: 'Trabzon',  district: 'Ortahisar',   address: 'Uzun Sok. No:15' },
  { name: 'Kemal Kaplan',    email: 'kemal.kaplan@email.com',     phone: '0537 678 90 12', city: 'İstanbul', district: 'Pendik',      address: 'Kurtköy Cad. No:55' },
  { name: 'Neslihan Tekin',  email: 'neslihan.tekin@email.com',   phone: '0538 789 01 23', city: 'Samsun',   district: 'Atakum',      address: 'Atatürk Bulvarı No:90' },
  { name: 'Tolga Ateş',      email: 'tolga.ates@email.com',       phone: '0539 890 12 34', city: 'Ankara',   district: 'Keçiören',    address: 'Plevne Cad. No:28' },
  { name: 'İrem Kılıç',      email: 'irem.kilic@email.com',       phone: '0530 901 23 45', city: 'İzmir',    district: 'Bornova',     address: 'Kazımdirik Mah. No:17' },
  { name: 'Oğuz Erdoğan',    email: 'oguz.erdogan@email.com',     phone: '0531 012 34 56', city: 'Eskişehir',district: 'Tepebaşı',    address: 'Hoşnudiye Mah. No:44' },
];

const CARGO_COMPANIES = ['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'PTT Kargo', 'Sürat Kargo'];
const CHANNELS = ['trendyol', 'trendyol', 'trendyol', 'trendyol', 'site', 'site', 'hepsi', 'hepsi', 'n11'];
const STATUSES = ['new', 'new', 'preparing', 'preparing', 'preparing', 'shipped', 'shipped', 'shipped', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'cancelled'];

function seededRand(seed) {
  let x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function rInt(seed, n, max) {
  return Math.floor(seededRand(seed * 37 + n * 13) * max);
}

function generateOrders(count) {
  const orders = [];
  const baseDate = new Date(2026, 4, 22); // May 22 2026

  for (let i = 0; i < count; i++) {
    const s = i + 1;
    const product   = PRODUCTS[rInt(s, 1, PRODUCTS.length)];
    const customer  = CUSTOMERS[rInt(s, 2, CUSTOMERS.length)];
    const status    = STATUSES[rInt(s, 3, STATUSES.length)];
    const channel   = CHANNELS[rInt(s, 4, CHANNELS.length)];
    const qty       = rInt(s, 5, 3) + 1;
    const cargoComp = CARGO_COMPANIES[rInt(s, 6, CARGO_COMPANIES.length)];

    const daysAgo   = rInt(s, 7, 30);
    const hoursAgo  = rInt(s, 8, 24);
    const minsAgo   = rInt(s, 9, 60);
    const d = new Date(baseDate);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(9 + hoursAgo % 12, minsAgo, 0, 0);

    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${pad(d.getDate())} ${['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    orders.push({
      id: 45231 - i,
      customer:      customer.name,
      email:         customer.email,
      phone:         customer.phone,
      city:          customer.city,
      district:      customer.district,
      address:       customer.address,
      productName:   product.name,
      productSku:    product.sku,
      productEmoji:  product.emoji,
      productPrice:  product.price,
      productCategory: product.category,
      qty,
      channel,
      dateStr,
      dateObj:       d,
      amount:        product.price * qty,
      status,
      cargoCode:     (status === 'shipped' || status === 'delivered') ? 'TK' + (9284700 + i) : null,
      cargoCompany:  cargoComp,
      paymentMethod: rInt(s, 10, 3) === 0 ? 'Havale/EFT' : (rInt(s, 10, 3) === 1 ? 'Kapıda Ödeme' : `Kredi Kartı (${rInt(s,11,3)+1} Taksit)`),
      note:          rInt(s, 12, 5) === 0 ? 'Lütfen hediye paketi yapınız.' : null,
    });
  }
  return orders;
}

const STATUS_LABELS = {
  new:        { label: 'Yeni',           cls: 'badge-info',    dot: 'var(--info)' },
  preparing:  { label: 'Hazırlanıyor',   cls: 'badge-warning', dot: 'var(--warning)' },
  shipped:    { label: 'Kargoda',        cls: 'badge-primary', dot: 'var(--primary)' },
  delivered:  { label: 'Teslim Edildi',  cls: 'badge-success', dot: 'var(--success)' },
  cancelled:  { label: 'İptal',          cls: 'badge-gray',    dot: 'var(--text-muted)' },
};

const CHANNEL_LABELS = {
  trendyol: { label: 'Trendyol', short: 'T', cls: 'trendyol' },
  site:     { label: 'Site',     short: 'S', cls: 'site' },
  hepsi:    { label: 'Hepsiburada', short: 'H', cls: 'hepsi' },
  n11:      { label: 'N11',      short: 'N', cls: 'n11' },
};

function formatMoney(n) {
  return '₺' + n.toLocaleString('tr-TR');
}

window.ORDERS_DATA = generateOrders(150);
