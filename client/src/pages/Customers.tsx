import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney } from '../lib/utils';
import type { Customer } from '../types';

// ── Kanal renkleri ────────────────────────────────────────────────────────────
const CHANNEL_COLOR: Record<string, { label: string; color: string; bg: string }> = {
  shopify:  { label: 'Shopify',     color: '#3a7d44', bg: '#dcfce7' },
  trendyol: { label: 'Trendyol',    color: '#c2410c', bg: '#ffedd5' },
  hepsi:    { label: 'Hepsiburada', color: '#9a3412', bg: '#ffedd5' },
  n11:      { label: 'N11',         color: '#6b21a8', bg: '#f3e8ff' },
  ikas:     { label: 'İkas',        color: '#3730a3', bg: '#e0e7ff' },
  site:     { label: 'Site',        color: '#1d4ed8', bg: '#dbeafe' },
};

function ChannelBadge({ channel }: { channel: string }) {
  const m = CHANNEL_COLOR[channel] || { label: channel, color: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: m.bg, color: m.color, display: 'inline-block',
    }}>
      {m.label}
    </span>
  );
}

// ── Müşteri avatarı ───────────────────────────────────────────────────────────
const AVATAR_COLORS: [string, string][] = [
  ['#fff', '#6366f1'], ['#fff', '#0ea5e9'], ['#fff', '#10b981'],
  ['#fff', '#f59e0b'], ['#fff', '#ef4444'], ['#fff', '#8b5cf6'],
  ['#fff', '#ec4899'], ['#fff', '#14b8a6'],
];
function avatarColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const [fg, bg] = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.4, flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
const PER_PAGE = 20;

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    api.customers.list({})
      .then(r => setCustomers(r.customers))
      .finally(() => setLoading(false));
  }, []);

  // Arama filtresi
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q)  ||
      c.email.toLowerCase().includes(q) ||
      c.phone.replace(/\s/g,'').includes(q.replace(/\s/g,'')) ||
      c.city.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged       = useMemo(() => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE), [filtered, page]);

  const handleSearch = (q: string) => {
    setSearch(q); setPage(1);
    clearTimeout(searchTimer.current);
  };

  // İstatistikler
  const totalCustomers = customers.length;
  const totalCities    = new Set(customers.map(c => c.city).filter(Boolean)).size;
  const totalRevenue   = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgSpend       = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
  const multiOrder     = customers.filter(c => c.orderCount > 1).length;

  return (
    <Layout title={<>Müşteriler <span>{loading ? '…' : `${totalCustomers} müşteri`}</span></>}>
      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          {
            label: 'Toplam Müşteri', value: loading ? '—' : totalCustomers.toLocaleString('tr-TR'),
            sub: 'Benzersiz alıcı', cls: 'primary',
            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
          },
          {
            label: 'Tekrar Alıcı', value: loading ? '—' : multiOrder.toLocaleString('tr-TR'),
            sub: '2+ sipariş vermiş', cls: 'success',
            icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
          },
          {
            label: 'Şehir Sayısı', value: loading ? '—' : totalCities.toLocaleString('tr-TR'),
            sub: 'Farklı şehir', cls: 'info',
            icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
          },
          {
            label: 'Ort. Harcama', value: loading ? '—' : formatMoney(Math.round(avgSpend)),
            sub: 'Müşteri başına', cls: 'warning',
            icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
          },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.cls}`}>
              <svg width={22} height={22} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {s.icon.split('M').filter(Boolean).map((d, i) => (
                  <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={`M${d}`} />
                ))}
              </svg>
            </div>
            <div className="stat-info">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-change">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        {/* Filtre */}
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
          <div className="search-wrap">
            <svg className="search-icon" width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text" className="form-control"
              placeholder="İsim, e-posta, telefon veya şehir..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
            )}
          </div>
          {!loading && search && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} sonuç
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : paged.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <h3>{customers.length === 0 ? 'Henüz müşteri yok' : 'Sonuç bulunamadı'}</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              {customers.length === 0
                ? 'Shopify siparişleri senkronize edildiğinde müşteriler otomatik oluşur.'
                : 'Arama kriterini değiştirmeyi deneyin.'}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Müşteri</th>
                  <th>Telefon</th>
                  <th>Şehir</th>
                  <th>Kanal</th>
                  <th style={{ textAlign: 'center' }}>Sipariş</th>
                  <th style={{ textAlign: 'right' }}>Toplam Harcama</th>
                  <th>Son Sipariş</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(c => (
                  <tr
                    key={c.key}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/customers/${encodeURIComponent(c.key)}`)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).querySelectorAll('td').forEach(td => (td.style.background = 'var(--primary-light,#EEF2FF)'))}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).querySelectorAll('td').forEach(td => (td.style.background = ''))}
                  >
                    {/* Müşteri */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={c.name} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                          {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Telefon */}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {c.phone || <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>

                    {/* Şehir */}
                    <td style={{ fontSize: 13 }}>
                      {c.city
                        ? <><span style={{ fontWeight: 500 }}>{c.city}</span>{c.district && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> / {c.district}</span>}</>
                        : <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>

                    {/* Kanal */}
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.channels.map(ch => <ChannelBadge key={ch} channel={ch} />)}
                      </div>
                    </td>

                    {/* Sipariş sayısı */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                        background: c.orderCount > 1 ? 'var(--primary-light,#EEF2FF)' : 'var(--bg)',
                        color: c.orderCount > 1 ? 'var(--primary)' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                      }}>
                        {c.orderCount}
                      </span>
                    </td>

                    {/* Toplam harcama */}
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {formatMoney(c.totalSpent)}
                    </td>

                    {/* Son sipariş */}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {c.lastOrderDate || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sayfalama */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '12px 16px', borderTop: '1px solid var(--border-light)' }}>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, opacity: page === 1 ? 0.4 : 1 }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Önceki</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce<(number | '...')[]>((acc, n, idx, arr) => { if (idx > 0 && (arr[idx - 1] as number) + 1 < n) acc.push('...'); acc.push(n); return acc; }, [])
              .map((item, idx) => item === '...'
                ? <span key={`e${idx}`} style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</span>
                : <button key={item} onClick={() => setPage(item as number)} style={{ minWidth: 32, height: 32, borderRadius: 6, fontSize: 12, fontWeight: 600, border: page === item ? 'none' : '1px solid var(--border)', background: page === item ? 'var(--primary)' : 'transparent', color: page === item ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>{item}</button>
              )}
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, opacity: page === totalPages ? 0.4 : 1 }} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Sonraki →</button>
          </div>
        )}

        <div className="card-footer">
          <span className="page-info">
            {!loading && filtered.length > 0 && (
              <><b>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</b> / {filtered.length} müşteri{search ? ` · Toplam: ${totalCustomers}` : ''}</>
            )}
          </span>
        </div>
      </div>
    </Layout>
  );
}
