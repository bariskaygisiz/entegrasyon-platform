/**
 * Entegrasyon Platform — Shopify CORS Proxy
 * Sıfır dış bağımlılık, sadece Node.js stdlib.
 *
 * Çalıştırmak için:  node server/proxy.js
 */

const http  = require('http');
const https = require('https');

const PORT           = 3001;
const ALLOWED_ORIGIN = 'http://localhost:8080';

/* ------------------------------------------------------------------ */
/* Yardımcı: Shopify Admin API'ye istek gönder, yanıtı pipe et        */
/* ------------------------------------------------------------------ */
function forwardToShopify(req, res, shopifyPath, method = 'GET', body = null) {
  const domain = req.headers['x-shop-domain'];
  const token  = req.headers['x-shop-token'];

  if (!domain || !token) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'X-Shop-Domain ve X-Shop-Token başlıkları zorunludur.' }));
  }

  const options = {
    hostname: `${domain}.myshopify.com`,
    path:     shopifyPath,
    method,
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type':           'application/json',
      'Accept':                 'application/json',
    },
  };

  const proxyReq = https.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', err => {
    console.error('Shopify API hatası:', err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Shopify API bağlantı hatası: ' + err.message }));
  });

  if (body) proxyReq.write(body);
  proxyReq.end();
}

/* ------------------------------------------------------------------ */
/* Ana sunucu                                                           */
/* ------------------------------------------------------------------ */
const server = http.createServer((req, res) => {

  /* CORS başlıkları — tüm yanıtlara ekle */
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Shop-Domain, X-Shop-Token, Content-Type');

  /* Preflight */
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  /* -------------------------------------------------------------- */
  /* GET /shopify/products?limit=250                                 */
  /* Mağazadaki ürünleri listele                                     */
  /* -------------------------------------------------------------- */
  if (req.method === 'GET' && url.pathname === '/shopify/products') {
    const limit = url.searchParams.get('limit') || '250';
    console.log(`→ Ürünler çekiliyor (limit: ${limit}) — ${req.headers['x-shop-domain']}.myshopify.com`);
    return forwardToShopify(
      req, res,
      `/admin/api/2024-01/products.json?limit=${limit}&status=active`
    );
  }

  /* -------------------------------------------------------------- */
  /* POST /shopify/products                                          */
  /* Yeni ürün oluştur                                               */
  /* -------------------------------------------------------------- */
  if (req.method === 'POST' && url.pathname === '/shopify/products') {
    console.log(`→ Yeni ürün oluşturuluyor — ${req.headers['x-shop-domain']}.myshopify.com`);
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () =>
      forwardToShopify(req, res, '/admin/api/2024-01/products.json', 'POST', body)
    );
    return;
  }

  /* -------------------------------------------------------------- */
  /* GET /health                                                     */
  /* Proxy'nin ayakta olup olmadığını kontrol et                    */
  /* -------------------------------------------------------------- */
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, version: '1.0.0' }));
  }

  /* 404 */
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Bilinmeyen endpoint.' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Shopify CORS Proxy — hazır ✅              ║');
  console.log(`║   http://localhost:${PORT}                      ║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  GET  /shopify/products   → ürün listesi     ║');
  console.log('║  POST /shopify/products   → ürün oluştur     ║');
  console.log('║  GET  /health             → durum kontrolü   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
