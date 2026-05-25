import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Product } from '../types';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.products.list({ limit: 200 }).then(r => setProducts(r.products)).finally(() => setLoading(false));
  }, []);

  const sorted = [...products].sort((a, b) => a.stock - b.stock);

  return (
    <Layout title="Envanter">
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>SKU</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const st = statusLabel(p.status);
                  const stockColor = p.stock === 0 ? 'var(--danger)' : p.stock <= 5 ? 'var(--warning)' : 'var(--success)';
                  return (
                    <tr key={p.id}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 20 }}>{p.emoji}</span><span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span></div></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.sku || '—'}</td>
                      <td><span style={{ fontWeight: 700, color: stockColor }}>{p.stock === 0 ? 'Stok Yok' : `${p.stock} adet`}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(p.price)}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
