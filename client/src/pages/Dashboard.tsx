import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Order } from '../types';

const syncData = [0, 4, 12, 34, 56, 89, 112].map((v, i) => ({ name: `G${i + 1}`, value: v }));

const INTEGRATIONS = [
  { slug: 'trendyol',       name: 'Trendyol',        letter: 'T', bg: '#FFF4EB', color: '#F27A1A', badge: 'Pazaryeri',  badgeCls: 'badge-trendyol', desc: '286 ürün · 8 yeni sipariş · Son: 2dk',  synced: 'Bugün 1.024 işlem',  status: 'green' },
  { slug: 'hepsiburada',    name: 'Hepsiburada',     letter: 'H', bg: '#FFF0EB', color: '#FF6000', badge: 'Pazaryeri',  badgeCls: '',               desc: '142 ürün · 3 yeni sipariş · Son: 5dk',  synced: 'Bugün 318 işlem',    status: 'green' },
  { slug: 'ikas',           name: 'İkas',            letter: 'İ', bg: '#EEF2FF', color: '#4F46E5', badge: 'E-Ticaret',  badgeCls: 'badge-primary',  desc: '1.240 ürün · 2 yeni sipariş · Son: 3dk', synced: 'Bugün 89 işlem',   status: 'green' },
  { slug: 'parasut',        name: 'Paraşüt',         letter: 'P', bg: '#E0FDF4', color: '#0D9488', badge: 'Muhasebe',   badgeCls: 'badge-success',  desc: '13 fatura oluşturuldu · Son: 2dk',       synced: 'Bugün 13 fatura',  status: 'green' },
  { slug: 'aras-kargo',     name: 'Aras Kargo',      letter: 'A', bg: '#FEF2F2', color: '#DC2626', badge: 'Kargo',      badgeCls: 'badge-danger',   desc: '8 sevkiyat oluşturuldu · Son: 8dk',      synced: 'Bugün 8 sevkiyat', status: 'green' },
  { slug: 'trendyol-efatura', name: 'Tr. E-Faturam', letter: 'E', bg: '#FFFBEB', color: '#D97706', badge: 'E-Fatura',   badgeCls: 'badge-warning',  desc: 'API sertifikası 3 gün içinde sona eriyor', synced: 'Bugün 7 fatura', status: 'yellow', warn: true },
];

const FLOWS = [
  { title: 'Trendyol Sipariş → Fatura + Kargo',    last: '2 dk önce',  count: 8,  chips: [{ label: 'Trendyol', bg: '#FFF4EB', color: '#F27A1A' }, { label: 'Paraşüt', bg: 'var(--success-light)', color: 'var(--success)' }, { label: 'Aras Kargo', bg: 'var(--danger-light)', color: 'var(--danger)' }] },
  { title: 'Hepsiburada Sipariş → Fatura + Kargo', last: '15 dk önce', count: 3,  chips: [{ label: 'Hepsiburada', bg: '#FFF0EB', color: '#FF6000' }, { label: 'Paraşüt', bg: 'var(--success-light)', color: 'var(--success)' }, { label: 'Aras Kargo', bg: 'var(--danger-light)', color: 'var(--danger)' }] },
  { title: 'İkas Sipariş → E-Fatura',              last: '44 dk önce', count: 2,  chips: [{ label: 'İkas', bg: 'var(--primary-light)', color: 'var(--primary)' }, { label: 'Tr. E-Faturam', bg: '#FFFBEB', color: '#D97706' }] },
];

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.orders.list({ limit: 8 }),
      api.products.list({ limit: 1 }),
    ]).then(([ordRes, prodRes]) => {
      setOrders(ordRes.orders);
      setProductCount(prodRes.total);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <Layout
      title={<>Panel Özeti <span>22 Mayıs 2026</span></>}
      actions={
        <Link to="/integrations" className="btn btn-primary btn-sm">
          <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Entegrasyon Ekle
        </Link>
      }
    >
      {/* Platform health bar */}
      <div className="health-bar">
        {[
          { val: 6,     lbl: 'Aktif Entegrasyon', color: 'var(--success)', bg: 'var(--success-light)', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
          { val: '1.284', lbl: 'Bugün Senkronize', color: 'var(--primary)', bg: 'var(--primary-light)', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
          { val: 2,     lbl: 'Uyarı',             color: 'var(--warning)', bg: 'var(--warning-light)', icon: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
          { val: 0,     lbl: 'Hata',              color: 'var(--danger)',  bg: 'var(--danger-light)',  icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { val: 3,     lbl: 'Aktif Akış',         color: 'var(--trendyol)', bg: '#FFF4EB',           icon: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4' },
        ].map((item, i, arr) => (
          <React.Fragment key={item.lbl}>
            <div className="health-item">
              <div className="health-item-icon" style={{ background: item.bg }}>
                <svg width={18} height={18} fill="none" stroke={item.color} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <div>
                <div className="health-item-val" style={{ color: item.color }}>{item.val}</div>
                <div className="health-item-lbl">{item.lbl}</div>
              </div>
            </div>
            {i < arr.length - 1 && <div className="health-divider" />}
          </React.Fragment>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--success)' }}>
            <span style={{ width: 8, height: 8, background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }} />
            Tüm sistemler çalışıyor
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>Son kontrol: 1dk önce</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid-7-5" style={{ marginBottom: 20 }}>

        {/* LEFT: Active integrations + chart */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
            Aktif Entegrasyonlar
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {INTEGRATIONS.map(int => (
              <Link key={int.slug} to={`/integrations/${int.slug}`}
                className={`int-card${int.warn ? '' : ' connected'}`}
                style={{ textDecoration: 'none', color: 'inherit', ...(int.warn ? { borderColor: 'var(--warning)' } : {}) }}>
                <div className="int-card-header">
                  <div className="int-logo" style={{ background: int.bg, color: int.color }}>{int.letter}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div className={`int-status-dot ${int.status}`} />
                    <span className={`badge ${int.badgeCls}`} style={{ fontSize: 10, padding: '2px 7px' }}>{int.badge}</span>
                  </div>
                </div>
                <div className="int-name">{int.name}</div>
                <div className="int-desc">{int.desc}</div>
                <div className="int-meta">
                  <span style={{ fontSize: 11, fontWeight: 600, color: int.warn ? 'var(--warning)' : 'var(--success)' }}>
                    {int.warn ? '⚠ Uyarı' : '● Sağlıklı'}
                  </span>
                  <span className="int-last-sync">{int.synced}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Sync chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Senkronizasyon Aktivitesi (Son 7 Gün)
              </div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={syncData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* RIGHT: Flows + stats + recent orders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active flows */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Aktif Akışlar
              </div>
              <Link to="/flows" className="btn btn-ghost btn-sm">Tümü</Link>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FLOWS.map(f => (
                <div key={f.title} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {f.chips.map((c, i) => (
                      <React.Fragment key={c.label}>
                        {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>}
                        <span style={{ fontSize: 11, background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{c.label}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Son tetiklendi: {f.last} · Bugün {f.count} kez
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Bu Ay Özet</div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Bu Ay Ciro',        val: formatMoney(144200), sub: '+12%', subCls: 'up' },
                { label: 'Bugün Gelir',        val: formatMoney(24900),  sub: '47 sipariş', subCls: '' },
                { label: 'Toplam Ürün',        val: String(productCount || '—'), sub: 'Aktif & taslak', subCls: '' },
                { label: 'Bekleyen Sipariş',   val: '23',                sub: '8 acil', subCls: 'down' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{s.label}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{s.val}</span>
                    {s.sub && (
                      <span className={`stat-change ${s.subCls}`} style={{ display: 'block', fontSize: 11 }}>{s.sub}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Son Siparişler</div>
          <Link to="/orders" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Tümünü Gör</Link>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Müşteri</th>
                  <th>Ürün</th>
                  <th>Kanal</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const st = statusLabel(o.status);
                  return (
                    <tr key={o.id}>
                      <td><Link to={`/orders/${o.id}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>#{o.id}</Link></td>
                      <td>{o.customer}</td>
                      <td>{o.productEmoji} {o.productName}</td>
                      <td style={{ fontSize: 12 }}>{o.channel}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(o.amount)}</td>
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
