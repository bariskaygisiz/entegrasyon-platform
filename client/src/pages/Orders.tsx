import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Order } from '../types';

const STATUS_TABS = [
  { key: 'all',       label: 'Tümü' },
  { key: 'new',       label: 'Yeni' },
  { key: 'preparing', label: 'Hazırlanıyor' },
  { key: 'shipped',   label: 'Kargoda' },
  { key: 'delivered', label: 'Teslim Edildi' },
  { key: 'cancelled', label: 'İptal' },
];

const CHANNEL_LABELS: Record<string, string> = {
  trendyol: 'Trendyol', site: 'Site', hepsi: 'Hepsiburada', n11: 'N11',
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = (status: string, q: string) => {
    setLoading(true);
    api.orders.list({ status: status !== 'all' ? status : undefined, search: q || undefined, limit: 100 })
      .then(r => { setOrders(r.orders); setTotal(r.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load('all', ''); }, []);

  const handleStatus = (s: string) => { setStatusFilter(s); load(s, search); };
  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(statusFilter, q), 300);
  };

  return (
    <Layout title="Siparişler">
      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUS_TABS.map(t => (
          <button key={t.key}
            onClick={() => handleStatus(t.key)}
            className={`status-tab${statusFilter === t.key ? ' active' : ''}`}
            style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: statusFilter === t.key ? 'var(--primary)' : 'var(--card)', color: statusFilter === t.key ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
          >{t.label}</button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input className="form-control" type="text" placeholder="Müşteri, ürün, sipariş no…"
            style={{ paddingLeft: 32, width: 240 }} value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Ürün</th>
                  <th>Kanal</th>
                  <th>Tarih</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const st = statusLabel(o.status);
                  return (
                    <tr key={o.id} data-status={o.status}>
                      <td>
                        <Link to={`/orders/${o.id}`} style={{ fontWeight: 600, color: 'var(--primary)' }}>#{o.id}</Link>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customer}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.city}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{o.productEmoji} {o.productName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>x{o.qty}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
                          {CHANNEL_LABELS[o.channel] || o.channel}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.dateStr}</td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(o.amount)}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', fontSize: 12, color: 'var(--text-muted)' }}>
          {total} sipariş
        </div>
      </div>
    </Layout>
  );
}
