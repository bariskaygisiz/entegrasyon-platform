import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney } from '../lib/utils';
import type { Order } from '../types';

// ── Kanal meta ────────────────────────────────────────────────────────────────
const CHANNEL_META: Record<string, { label: string; favicon?: string; color: string; emoji?: string }> = {
  trendyol: { label: 'Trendyol',    favicon: 'trendyol.com',    color: '#F27A1A' },
  hepsi:    { label: 'Hepsiburada', favicon: 'hepsiburada.com', color: '#FF6000' },
  n11:      { label: 'N11',         favicon: 'n11.com',         color: '#7B2D8B' },
  ikas:     { label: 'İkas',        favicon: 'ikas.com',        color: '#4F46E5' },
  shopify:  { label: 'Shopify',     favicon: 'shopify.com',     color: '#96BF48' },
  ticimax:  { label: 'Ticimax',     favicon: 'ticimax.com',     color: '#0EA5E9' },
  ideasoft: { label: 'İdeasoft',    favicon: 'ideasoft.com',    color: '#F59E0B' },
  site:     { label: 'Site',        emoji: '🌐',                color: '#4F46E5' },
};

// ── Durum meta ────────────────────────────────────────────────────────────────
const ORDER_STATUSES = [
  { value: 'approved',  label: 'Onaylandı',       color: '#0369a1', bg: '#e0f2fe' },
  { value: 'preparing', label: 'Hazırlanıyor',     color: '#92400e', bg: '#fef3c7' },
  { value: 'shipped',   label: 'Kargoya Verildi',  color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'delivered', label: 'Teslim Edildi',    color: '#15803d', bg: '#dcfce7' },
  { value: 'cancelled', label: 'İptal Edildi',     color: '#dc2626', bg: '#fee2e2' },
];

const STATUS_META = Object.fromEntries(ORDER_STATUSES.map(s => [s.value, s])) as Record<string, typeof ORDER_STATUSES[0]>;
// backward compat
STATUS_META['new'] = STATUS_META['approved'];

const STATUS_TABS = [
  { key: 'all',       label: 'Tümü' },
  { key: 'approved',  label: 'Onaylandı',      dot: '#0369a1' },
  { key: 'preparing', label: 'Hazırlanıyor',   dot: '#92400e' },
  { key: 'shipped',   label: 'Kargoya Verildi',dot: '#1d4ed8' },
  { key: 'delivered', label: 'Teslim Edildi',  dot: '#15803d' },
  { key: 'cancelled', label: 'İptal Edildi',   dot: '#dc2626' },
];

// ── Kanal ikonu ───────────────────────────────────────────────────────────────
function ChannelBadge({ channel }: { channel: string }) {
  const meta = CHANNEL_META[channel] || { label: channel, color: '#94a3b8' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {meta.favicon ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${meta.favicon}&sz=32`}
          width={16} height={16}
          style={{ borderRadius: 3, flexShrink: 0 }}
          alt=""
        />
      ) : (
        <span style={{ fontSize: 14, lineHeight: 1 }}>{meta.emoji}</span>
      )}
      <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>{meta.label}</span>
    </div>
  );
}

// ── İşlemler ikonları ─────────────────────────────────────────────────────────
function ActionButton({ title, onClick, children }: { title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 30, height: 30, border: '1px solid var(--border)',
        borderRadius: 6, background: 'var(--card)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', transition: 'all .15s', flexShrink: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-light,#EEF2FF)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--primary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--card)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
    >
      {children}
    </button>
  );
}

// ── Ana sayfa ─────────────────────────────────────────────────────────────────
// Durum eşleştirici — 'new' eski veriler için 'approved' sayılır
function matchesStatus(orderStatus: string, tab: string): boolean {
  if (tab === 'approved') return orderStatus === 'approved' || orderStatus === 'new';
  return orderStatus === tab;
}

export default function Orders() {
  const navigate = useNavigate();
  // Tüm siparişler tek seferinde yüklenir; filtreleme client'ta yapılır
  const PER_PAGE = 50;
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [syncMsg,   setSyncMsg]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadOrders = async () => {
    const r = await api.orders.list({});
    setAllOrders(r.orders);
    return r.orders;
  };

  const doSync = async (silent = false) => {
    setSyncing(true);
    if (!silent) setSyncMsg(null);
    try {
      const result = await api.shopify.syncOrders();
      const orders = await loadOrders();
      if (!silent) setSyncMsg(`${result.synced} yeni, ${result.updated} güncellendi. Toplam: ${orders.length} sipariş.`);
    } catch (err: any) {
      if (!silent) setSyncMsg('Hata: ' + (err.message || 'Bilinmeyen hata'));
    } finally {
      setSyncing(false);
    }
  };

  // Sayfa ilk açılışında: DB'den yükle, boşsa Shopify'dan otomatik çek
  useEffect(() => {
    setLoading(true);
    loadOrders()
      .then(orders => {
        if (orders.length === 0) {
          // İlk açılışta Shopify'dan otomatik sync (sessizce)
          return doSync(true);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab + arama client-side filtresi
  const displayedOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOrders.filter(o => {
      if (activeTab !== 'all' && !matchesStatus(o.status, activeTab)) return false;
      if (q) {
        const name = (o.orderName || '').toLowerCase();
        if (!o.customer.toLowerCase().includes(q) &&
            !o.productName.toLowerCase().includes(q) &&
            !String(o.id).includes(q) &&
            !name.includes(q)) return false;
      }
      return true;
    });
  }, [allOrders, activeTab, search]);

  // Tab veya arama değişince 1. sayfaya dön
  const handleTabChange = (key: string) => { setActiveTab(key); setPage(1); };
  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
    clearTimeout(searchTimer.current);
  };

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    try {
      await api.orders.patch(orderId, { status: newStatus } as any);
    } catch {
      // hata → sunucudan taze veri çek
      api.orders.list({}).then(r => setAllOrders(r.orders)).catch(() => {});
    }
  };

  // Her tab için gerçek sayı — tüm allOrders üzerinden hesaplanır
  const countByStatus = (s: string) => allOrders.filter(o => matchesStatus(o.status, s)).length;

  const totalPages  = Math.max(1, Math.ceil(displayedOrders.length / PER_PAGE));
  const pagedOrders = useMemo(
    () => displayedOrders.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [displayedOrders, page],
  );

  return (
    <Layout title={<>Siparişler <span>{loading ? '…' : `${allOrders.length} sipariş`}</span></>}>
      <style>{`
        .order-row { cursor: pointer; transition: background .1s; }
        .order-row:hover td { background: var(--primary-light, #EEF2FF) !important; }
        .status-select-wrap select {
          appearance: none; -webkit-appearance: none;
          border: none; outline: none; cursor: pointer;
          font-size: 11px; font-weight: 700; padding: 3px 18px 3px 8px;
          border-radius: 20px; background-color: transparent; width: 100%;
        }
        .status-select-wrap {
          position: relative; display: inline-flex; align-items: center;
          border-radius: 20px; overflow: visible;
        }
        .status-select-wrap::after {
          content: '▾'; position: absolute; right: 6px; top: 50%;
          transform: translateY(-50%); font-size: 9px; pointer-events: none;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {syncMsg && (
        <div style={{
          padding: '10px 16px', marginBottom: 12, borderRadius: 8, fontSize: 13,
          background: syncMsg.startsWith('Hata') ? '#fee2e2' : '#dcfce7',
          color:      syncMsg.startsWith('Hata') ? '#991b1b' : '#166534',
          border:     `1px solid ${syncMsg.startsWith('Hata') ? '#fca5a5' : '#86efac'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{syncMsg}</span>
          <button onClick={() => setSyncMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'inherit', opacity: 0.6 }}>×</button>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Sipariş Yönetimi</div>
          <div className="page-subtitle">Tüm kanallardan gelen siparişleri tek ekranda yönetin</div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => doSync(false)}
            disabled={syncing}
            title="Shopify siparişlerini senkronize et"
          >
            <svg
              width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={syncing ? { animation: 'spin 1s linear infinite' } : {}}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Senkronize ediliyor…' : 'Shopify\'dan Senkronize Et'}
          </button>
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
          { label: 'Onaylanan',    key: 'approved',  cls: 'info',    sub: 'İşlem bekliyor', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Hazırlanıyor', key: 'preparing', cls: 'warning', sub: 'Kargoya hazır',  icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
          { label: 'Kargoda',      key: 'shipped',   cls: 'primary', sub: 'Yolda',          icon: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
          { label: 'Teslim Edildi',key: 'delivered', cls: 'success', sub: 'Tamamlandı',     icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}>
              <svg width={22} height={22} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
              </svg>
            </div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{loading ? '—' : countByStatus(s.key as string)}</div>
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
              {'dot' in t && t.dot && <span style={{ width: 7, height: 7, background: t.dot, borderRadius: '50%', display: 'inline-block' }} />}
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

        {(loading || syncing) ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div>{syncing ? 'Shopify\'dan siparişler alınıyor…' : 'Yükleniyor…'}</div>
          </div>
        ) : pagedOrders.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <h3>Sipariş bulunamadı</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {allOrders.length === 0
                ? 'Shopify bağlantısını kontrol edin ve "Shopify\'dan Senkronize Et" butonuna tıklayın.'
                : 'Arama kriterlerinize uyan sipariş bulunamadı.'}
            </p>
          </div>
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
                  <th style={{ textAlign: 'center' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map(o => {
                  const sm = STATUS_META[o.status] || STATUS_META['approved'];
                  return (
                    <tr
                      key={o.id}
                      className="order-row"
                      onClick={() => navigate(`/orders/${o.id}`)}
                    >
                      {/* Sipariş No */}
                      <td>
                        <Link
                          to={`/orders/${o.id}`}
                          style={{ fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', fontSize: 13 }}
                          onClick={e => e.stopPropagation()}
                        >
                          {o.orderName || `#${o.id}`}
                        </Link>
                      </td>

                      {/* Müşteri */}
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{o.customer}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.city}</div>
                      </td>

                      {/* Ürün */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{o.productEmoji}</span>
                          <div>
                            <div style={{ fontSize: 12 }}>{o.productName}</div>
                            {o.qty > 1 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>x{o.qty}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Kanal */}
                      <td><ChannelBadge channel={o.channel} /></td>

                      {/* Tarih */}
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {o.dateStr}
                      </td>

                      {/* Tutar */}
                      <td style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {formatMoney(o.amount)}
                      </td>

                      {/* Durum — inline dropdown */}
                      <td onClick={e => e.stopPropagation()}>
                        <div
                          className="status-select-wrap"
                          style={{ background: sm.bg, color: sm.color }}
                        >
                          <select
                            value={o.status === 'new' ? 'approved' : o.status}
                            onChange={e => handleStatusChange(o.id, e.target.value)}
                            style={{ color: sm.color }}
                          >
                            {ORDER_STATUSES.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>

                      {/* İşlemler */}
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {/* Sipariş Detayları */}
                          <ActionButton title="Sipariş Detayları" onClick={e => { e.stopPropagation(); navigate(`/orders/${o.id}`); }}>
                            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </ActionButton>

                          {/* Detayları Yazdır */}
                          <ActionButton title="Detayları Yazdır" onClick={e => { e.stopPropagation(); /* TODO */ }}>
                            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                          </ActionButton>

                          {/* Kargo Bilgilerini Yazdır */}
                          <ActionButton title="Kargo Bilgilerini Yazdır" onClick={e => { e.stopPropagation(); /* TODO */ }}>
                            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </ActionButton>

                          {/* Fatura Oluştur */}
                          <ActionButton title="Fatura Oluştur" onClick={e => { e.stopPropagation(); /* TODO */ }}>
                            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
            padding: '12px 16px', borderTop: '1px solid var(--border-light)',
          }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Önceki
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) + 1 < n) acc.push('...');
                acc.push(n);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`e${idx}`} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 2px' }}>…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    style={{
                      minWidth: 32, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: page === item ? 'none' : '1px solid var(--border)',
                      background: page === item ? 'var(--primary)' : 'transparent',
                      color: page === item ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12, opacity: page === totalPages ? 0.4 : 1 }}
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Sonraki →
            </button>
          </div>
        )}

        <div className="card-footer">
          <span className="page-info">
            <b>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayedOrders.length)}</b>
            {' '}/ {displayedOrders.length} sipariş
            {activeTab !== 'all' || search ? ` · Toplam: ${allOrders.length}` : ''}
          </span>
        </div>
      </div>
    </Layout>
  );
}
