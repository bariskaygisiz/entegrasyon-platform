import express from 'express';
import cors from 'cors';
import productsRouter from './routes/products';
import ordersRouter from './routes/orders';
import shopifyRouter from './routes/shopify';

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8080'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/products', productsRouter);
app.use('/api/orders',   ordersRouter);
app.use('/api/shopify',  shopifyRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Endpoint bulunamadı.' }));

// ── Start ─────────────────────────────────────────────────────────────────────
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
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});

export default app;
