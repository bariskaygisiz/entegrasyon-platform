import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Order } from '../types';

const STATUS_TABS = [
  { key: 'all',       label: 'Tümü',          dot: '' },
  { key: 'new',       label: 'Yeni',           dot: 'var(--info)' },
  { key: 'preparing', label: 'Hazırlanıyor',   dot: 'var(--warning)' },
  { key: 'shipped',   label: 'Kargoda',        dot: 'var(--primary)' },
  { key: 'delivered', label: 'Teslim Edildi',  dot: 'var(--success)' },
  { key: 'cancelled', label: 'İptal',          dot: 'var(--danger)' },
];

const CHANNEL_LABEL: Record<string, string> = {
  trendyol: 'Trendyol', hepsi: 'Hepsiburada', n11: 'N11', ikas: 'İkas', site: 'Site', shopify: 'Shopify',
};

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = (status: string, q: string) => {
    setLoading(true);
    api.orders.list({ status: status !== 'all' ? status : undefined, search: q || undefined, limit: 100 })
      .then(r => { setOrders(r.orders); setTotal(r.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load('all', ''); }, []);

  const handleTabChange = (key: string) => { setActiveTab(key); load(key, search); };
  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(activeTab, q), 300);
  };

  const countByStatus = (s: string) => orders.filter(o => o.status === s).length;

  return (
    <Layout title={<>Siparişler <span>{total} sipariş</span></>}>
      <div className="page-header">
        <div>
          <div className="page-title">Sipariş Yönetimi</div>
          <div className="page-subtitle">Tüm kanallardan gelen siparişleri tek ekranda yönetin</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary">
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Dışa Aktar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Yeni Siparişler',  key: 'new',       cls: 'info',    sub: 'Onay bekliyor', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Hazırlanıyor',     key: 'preparing', cls: 'warning', sub: 'Kargoya hazır', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
          { label: 'Kargoda',          key: 'shipped',   cls: 'primary', sub: 'Yolda',          icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
          { label: 'Teslim Edildi',    key: 'delivered', cls: 'success', sub: 'Tamamlandı',     icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}>
              <svg width={22} height={22} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
              </svg>
            </div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{loading ? '—' : countByStatus(s.key)}</div>
              <div className="stat-change">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        {/* Status tabs */}
        <div className="status-tabs">
          {STATUS_TABS.map(t => (
            <button key={t.key} className={`status-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => handleTabChange(t.key)}>
              {t.dot && <span style={{ width: 7, height: 7, background: t.dot, borderRadius: '50%', display: 'inline-block' }} />}
              {t.label}
              {t.key !== 'all' && !loading && <span className="count">{countByStatus(t.key)}</span>}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <div className="search-wrap">
            <svg className="search-icon" width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input type="text" className="form-control" placeholder="Müşteri, ürün, sipariş no..." value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M9 16h6" />
            </svg>
            Filtrele
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : orders.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}><h3>Sipariş bulunamadı</h3></div>
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
                    <tr key={o.id} className="order-row" onClick={() => navigate(`/orders/${o.id}`)}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="order-id" style={{ fontWeight: 600, color: 'var(--primary)' }} onClick={e => e.stopPropagation()}>
                          #{o.id}
                        </Link>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{o.customer}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.city}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{o.productEmoji}</span>
                          <div>
                            <div style={{ fontSize: 13 }}>{o.productName}</div>
                            {o.qty > 1 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>x{o.qty}</div>}
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontSize: 13 }}>{CHANNEL_LABEL[o.channel] || o.channel}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {o.dateStr}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatMoney(o.amount)}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-footer">
          <span className="page-info"><b>{orders.length}</b> sipariş gösteriliyor · Toplam: {total}</span>
        </div>
      </div>
    </Layout>
  );
}
