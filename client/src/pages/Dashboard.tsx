import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Order } from '../types';

const revenueData = [
  { name: '1 May', value: 18400 },
  { name: '5 May', value: 22100 },
  { name: '10 May', value: 19800 },
  { name: '15 May', value: 31200 },
  { name: '20 May', value: 27600 },
  { name: '22 May', value: 24900 },
];

const channelData = [
  { name: 'Trendyol', value: 58, color: '#F27A1A' },
  { name: 'Site',     value: 22, color: '#4F46E5' },
  { name: 'Hepsiburada', value: 14, color: '#FF6000' },
  { name: 'N11',      value: 6,  color: '#7B2D8B' },
];

const STATUS_ORDER = ['new', 'preparing', 'shipped', 'delivered', 'cancelled'];

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.orders.list({ limit: 5 }),
      api.products.list({ limit: 1 }),
    ]).then(([ordRes, prodRes]) => {
      setOrders(ordRes.orders);
      setProductCount(prodRes.total);
    }).finally(() => setLoading(false));
  }, []);

  const totalRevenue = 144200;
  const todayRevenue = 24900;
  const activeIntegrations = 6;

  const channelLabel = (c: string) => {
    const map: Record<string, string> = { trendyol: 'Trendyol', site: 'Site', hepsi: 'Hepsiburada', n11: 'N11' };
    return map[c] || c;
  };

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
          { val: activeIntegrations, lbl: 'Aktif Entegrasyon', color: 'var(--success)', bg: 'var(--success-light)', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
          { val: '1.284', lbl: 'Bugün Senkronize', color: 'var(--primary)', bg: 'var(--primary-light)', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
          { val: productCount, lbl: 'Toplam Ürün', color: 'var(--warning)', bg: '#FFF8EC', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
          { val: '0', lbl: 'Hata', color: 'var(--text-muted)', bg: 'var(--bg)', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
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
      </div>

      {/* Stats row */}
      <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Bu Ay Ciro', val: formatMoney(totalRevenue), sub: '+12% geçen aya göre', subColor: 'var(--success)' },
          { label: 'Bugün Gelir', val: formatMoney(todayRevenue), sub: '47 sipariş', subColor: 'var(--text-muted)' },
          { label: 'Bekleyen Sipariş', val: '23', sub: '8 acil', subColor: 'var(--danger)' },
          { label: 'Kargo Bekleyen', val: '12', sub: 'Bugün gönderilecek', subColor: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{s.val}</div>
            <div style={{ fontSize: 12, color: s.subColor }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Gelir Grafiği</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={v => '₺' + (v / 1000).toFixed(0) + 'K'} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Line type="monotone" dataKey="value" stroke="#4F46E5" strokeWidth={2.5} dot={{ fill: '#4F46E5', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Sipariş Kaynakları</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={channelData} cx="50%" cy="45%" innerRadius={50} outerRadius={75} dataKey="value">
                {channelData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
              <Tooltip formatter={(v: number) => `%${v}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent orders */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Son Siparişler</span>
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
                      <td><span style={{ fontSize: 12 }}>{channelLabel(o.channel)}</span></td>
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
