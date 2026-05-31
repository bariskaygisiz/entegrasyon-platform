import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney } from '../lib/utils';
import type { CustomerWithOrders } from '../types';

// ── Kanal badge ───────────────────────────────────────────────────────────────
const CHANNEL_META: Record<string, { label: string; favicon?: string; color: string; bg: string }> = {
  shopify:  { label: 'Shopify',     favicon: 'shopify.com',     color: '#3a7d44', bg: '#dcfce7' },
  trendyol: { label: 'Trendyol',    favicon: 'trendyol.com',    color: '#c2410c', bg: '#ffedd5' },
  hepsi:    { label: 'Hepsiburada', favicon: 'hepsiburada.com', color: '#9a3412', bg: '#ffedd5' },
  n11:      { label: 'N11',         favicon: 'n11.com',         color: '#6b21a8', bg: '#f3e8ff' },
  ikas:     { label: 'İkas',        favicon: 'ikas.com',        color: '#3730a3', bg: '#e0e7ff' },
  site:     { label: 'Site',        color: '#1d4ed8', bg: '#dbeafe' },
};

function ChannelBadge({ channel }: { channel: string }) {
  const m = CHANNEL_META[channel] || { label: channel, color: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: m.bg, color: m.color }}>
      {m.favicon && <img src={`https://www.google.com/s2/favicons?domain=${m.favicon}&sz=16`} width={11} height={11} alt="" style={{ borderRadius: 2 }} />}
      {m.label}
    </span>
  );
}

// ── Durum badge ───────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  approved:  { label: 'Onaylandı',       color: '#0369a1', bg: '#e0f2fe' },
  preparing: { label: 'Hazırlanıyor',    color: '#92400e', bg: '#fef3c7' },
  shipped:   { label: 'Kargoya Verildi', color: '#1d4ed8', bg: '#dbeafe' },
  delivered: { label: 'Teslim Edildi',   color: '#15803d', bg: '#dcfce7' },
  cancelled: { label: 'İptal Edildi',    color: '#dc2626', bg: '#fee2e2' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['approved'];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
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

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export default function CustomerDetail() {
  const { key }    = useParams<{ key: string }>();
  const navigate   = useNavigate();
  const [customer, setCustomer] = useState<CustomerWithOrders | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!key) return;
    api.customers.get(key)
      .then(setCustomer)
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false));
  }, [key]);

  if (loading) {
    return <Layout title="Müşteri Detayı"><div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div></Layout>;
  }
  if (!customer) {
    return (
      <Layout title="Müşteri Bulunamadı">
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>Müşteri bulunamadı.</p>
          <Link to="/customers" style={{ color: 'var(--primary)' }}>← Müşterilere Dön</Link>
        </div>
      </Layout>
    );
  }

  const [fg, bg] = avatarColor(customer.name);
  const avgOrder = customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0;

  return (
    <Layout title={customer.name}>
      {/* Geri butonu */}
      <Link to="/customers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 20 }}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Müşteriler
      </Link>

      {/* Müşteri başlık kartı */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px 24px', marginBottom: 20, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, flexShrink: 0 }}>
          {(customer.name || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>{customer.name}</h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
            {customer.email && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {customer.email}
              </span>
            )}
            {customer.phone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                {customer.phone}
              </span>
            )}
            {customer.city && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {customer.city}{customer.district ? ` / ${customer.district}` : ''}
              </span>
            )}
          </div>
          {customer.address && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{customer.address}</div>
          )}
        </div>
        {/* Kanal badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {customer.channels.map(ch => <ChannelBadge key={ch} channel={ch} />)}
        </div>
      </div>

      {/* İstatistik kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Toplam Sipariş',   value: customer.orderCount.toLocaleString('tr-TR'), icon: '🛒', color: '#6366f1' },
          { label: 'Toplam Harcama',   value: formatMoney(customer.totalSpent), icon: '💰', color: '#10b981' },
          { label: 'Ort. Sipariş',     value: formatMoney(Math.round(avgOrder)), icon: '📊', color: '#f59e0b' },
          { label: 'Son Sipariş',      value: customer.lastOrderDate || '—', icon: '📅', color: '#0ea5e9' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sipariş geçmişi */}
      <div className="card">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Sipariş Geçmişi</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{customer.orders.length} sipariş</span>
        </div>

        {customer.orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Sipariş bulunamadı.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Ürün</th>
                  <th>Kanal</th>
                  <th style={{ textAlign: 'right' }}>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                  <th>Kargo</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map(o => (
                  <tr
                    key={o.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).querySelectorAll('td').forEach(td => (td.style.background = 'var(--primary-light,#EEF2FF)'))}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).querySelectorAll('td').forEach(td => (td.style.background = ''))}
                  >
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{o.orderName}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{o.productEmoji}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{o.productName}</div>
                          {o.qty > 1 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>x{o.qty}</div>}
                        </div>
                      </div>
                    </td>
                    <td><ChannelBadge channel={o.channel} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                      {formatMoney(o.amount)}
                    </td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{o.dateStr}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {o.cargoCode
                        ? <><span style={{ fontWeight: 600 }}>{o.cargoCompany}</span><br /><span style={{ fontSize: 11 }}>{o.cargoCode}</span></>
                        : <span style={{ color: 'var(--border)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* İlk sipariş bilgisi */}
      {customer.firstOrderDate && customer.firstOrderDate !== customer.lastOrderDate && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          İlk sipariş: <strong>{customer.firstOrderDate}</strong>
        </div>
      )}
    </Layout>
  );
}
