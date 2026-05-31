import express from 'express';
import cors from 'cors';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import shopifyRouter, { loadAndApplySyncConfig, runStockSync, runProductInfoSync, runPriceSync, runOrderSync } from './routes/shopify';
import categoriesRouter from './routes/categories';
import { registerRunner } from './lib/syncScheduler';
import { cleanupOldLogs } from './lib/log';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8080'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/products',   productsRouter);
app.use('/api/orders',    ordersRouter);
app.use('/api/shopify',   shopifyRouter);
app.use('/api/categories', categoriesRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint bulunamadı.' }));

// ── Sync scheduler: runner'ları kayıt et, DB'deki config'i yükle ─────────────
registerRunner('inventory', runStockSync);
registerRunner('products',  runProductInfoSync);
registerRunner('prices',    runPriceSync);
loadAndApplySyncConfig(); // DB'deki toggle durumuna göre interval'ları başlat

// ── Sipariş otomatik sync — her 5 dakikada bir ────────────────────────────────
const ORDER_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 dk
// Sunucu açılışından 30 saniye sonra ilk sync'i başlat
setTimeout(() => {
  runOrderSync().catch(e => console.error('[order-sync] Başlangıç hatası:', e.message));
  setInterval(() => {
    runOrderSync().catch(e => console.error('[order-sync] Hata:', e.message));
  }, ORDER_SYNC_INTERVAL_MS);
}, 30 * 1000);

// ── Günlük log temizliği (3 aydan eski kayıtları sil) ─────────────────────────
cleanupOldLogs(); // Başlangıçta bir kez çalıştır
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000); // Her 24 saatte bir

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Entegrasyon API — hazır ✅                 ║');
  console.log(`║   http://localhost:${PORT}                      ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  GET  /api/products        → ürün listesi    ║');
  console.log('║  GET  /api/orders          → sipariş listesi ║');
  console.log('║  GET  /api/shopify/...     → Shopify proxy   ║');
  console.log('║  GET  /api/health          → durum           ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  ⏱  Sipariş sync: her 5 dk (otomatik)       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

export default app;
