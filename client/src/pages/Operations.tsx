import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { SyncJob } from '../types';

// ── Metadata ──────────────────────────────────────────────────────────────────
// Yeni bir kanal eklenirse → CHANNEL_META + ChannelFilter type + filtre chip'leri güncellenmeli
// Yeni bir action eklenirse → ACTION_META + server/src/lib/log.ts yorumlarına bakılmalı
//
// Mevcut channel'lar: shopify | product | category | system
// Mevcut action'lar:
//   product  → create | update | delete
//   category → create | update | delete
//   shopify  → sync | auto-stock | auto-product | auto-price | image-sync
//              settings.update | settings.delete | mapping.create | mapping.delete
//   system   → settings.update

const CHANNEL_META: Record<string, { label: string; favicon?: string; emoji?: string }> = {
  shopify:  { label: 'Shopify',     favicon: 'shopify.com' },
  product:  { label: 'Ürün',        emoji: '📦' },
  category: { label: 'Kategori',    emoji: '🗂️' },
  system:   { label: 'Sistem',      emoji: '⚙️' },
  trendyol: { label: 'Trendyol',    favicon: 'trendyol.com' },
  hepsi:    { label: 'Hepsiburada', favicon: 'hepsiburada.com' },
};

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  // ── Ürün işlemleri (channel: product) ─────────────────────────────────────
  'create':          { label: 'Oluşturuldu',           color: '#0369a1', bg: '#e0f2fe' },
  'update':          { label: 'Güncellendi',            color: '#6d28d9', bg: '#ede9fe' },
  'delete':          { label: 'Silindi',                color: '#dc2626', bg: '#fee2e2' },

  // ── Shopify manuel sync (channel: shopify) ─────────────────────────────────
  'sync':            { label: 'Shopify Sync',           color: '#15803d', bg: '#dcfce7' },

  // ── Shopify otomatik sync (channel: shopify) ───────────────────────────────
  'auto-stock':      { label: 'Otomatik Stok',          color: '#047857', bg: '#d1fae5' },
  'auto-product':    { label: 'Otomatik Ürün Sync',     color: '#0369a1', bg: '#e0f2fe' },
  'auto-price':      { label: 'Otomatik Fiyat Sync',    color: '#6d28d9', bg: '#ede9fe' },
  'image-sync':      { label: 'Görsel Sync',            color: '#0e7490', bg: '#cffafe' },
  'auto-image':      { label: 'Görsel Sync',            color: '#0e7490', bg: '#cffafe' }, // eski kayıtlar için

  // ── Shopify ayar & eşleştirme (channel: shopify) ──────────────────────────
  'settings.update': { label: 'Ayar Güncellendi',       color: '#92400e', bg: '#fef3c7' },
  'settings.delete': { label: 'Bağlantı Kesildi',       color: '#dc2626', bg: '#fee2e2' },
  'mapping.create':  { label: 'Eşleştirildi',           color: '#0369a1', bg: '#e0f2fe' },
  'mapping.delete':  { label: 'Eşleştirme Kaldırıldı',  color: '#c2410c', bg: '#ffedd5' },
  'import':          { label: 'Shopify İçeri Aktar',    color: '#7c3aed', bg: '#f5f3ff' },
};

const STATUS_META = {
  success: { label: 'Başarılı',   dot: '#16a34a', text: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  error:   { label: 'Hata',       dot: '#dc2626', text: '#dc2626', bg: '#fff1f2', border: '#fecdd3' },
  syncing: { label: 'İşleniyor',  dot: '#2563eb', text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  pending: { label: 'Bekliyor',   dot: '#9ca3af', text: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

function formatTR(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type StatusFilter  = 'all' | 'success' | 'error' | 'syncing' | 'pending';
type ChannelFilter = 'all' | 'shopify' | 'product' | 'category' | 'system';

export default function Operations() {
  const { showToast } = useToast();
  const PER_PAGE = 50;
  const [jobs, setJobs]               = useState<SyncJob[]>([]);
  const [loading, setLoading]         = useState(true);
  const [retrying, setRetrying]       = useState<number | null>(null);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [page, setPage]               = useState(1);

  const load = useCallback(async () => {
    try { setJobs(await api.shopify.getJobs()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const filtered = useMemo(() => jobs.filter(j => {
    if (statusFilter  !== 'all' && j.status  !== statusFilter)  return false;
    if (channelFilter !== 'all' && j.channel !== channelFilter) return false;
    return true;
  }), [jobs, statusFilter, channelFilter]);

  // Sayfa sıfırlama – filtre değişince 1. sayfaya dön
  useEffect(() => setPage(1), [statusFilter, channelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [filtered, page],
  );

  const counts = useMemo(() => ({
    total:   jobs.length,
    success: jobs.filter(j => j.status === 'success').length,
    error:   jobs.filter(j => j.status === 'error').length,
    active:  jobs.filter(j => j.status === 'syncing' || j.status === 'pending').length,
  }), [jobs]);

  const handleRetry = async (jobId: number) => {
    setRetrying(jobId);
    try {
      const res = await api.shopify.retryJob(jobId);
      showToast(res.ok ? 'Başarılı' : 'Hata', res.message, res.ok ? 'success' : 'error');
      await load();
    } catch (e: any) {
      showToast('Hata', e.message, 'error');
    } finally {
      setRetrying(null);
    }
  };

  return (
    <Layout title="İşlemler">
      <style>{`
        @keyframes spin-dot { to { transform: rotate(360deg); } }
        @keyframes fade-in   { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:none } }
        .ops-row { animation: fade-in .18s ease; }
        .ops-row:hover td { background: var(--bg) !important; }
        .ops-row td { transition: background .12s; }
        .ops-tag {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px; border-radius: 20px;
          font-size: 11px; font-weight: 700; white-space: nowrap;
        }
        .ops-status {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 700; white-space: nowrap;
        }
        .stat-card {
          background: var(--card); border: 1px solid var(--border);
          border-radius: 12px; padding: 14px 20px;
          display: flex; flex-direction: column; gap: 2px;
          min-width: 100px; flex: 1;
        }
        .filter-chip {
          padding: 5px 13px; border-radius: 20px; font-size: 12px; font-weight: 600;
          border: 1.5px solid var(--border); background: transparent;
          color: var(--text-muted); cursor: pointer; transition: all .15s;
        }
        .filter-chip.active {
          background: var(--primary); border-color: var(--primary);
          color: #fff;
        }
        .ops-table { width: 100%; border-collapse: collapse; }
        .ops-table th {
          text-align: left; font-size: 11px; font-weight: 700; letter-spacing: .04em;
          color: var(--text-muted); padding: 10px 14px;
          border-bottom: 1px solid var(--border); white-space: nowrap;
          text-transform: uppercase;
        }
        .ops-table td {
          padding: 11px 14px; border-bottom: 1px solid var(--border-light);
          font-size: 13px; vertical-align: middle;
        }
        .ops-link {
          font-weight: 600; color: var(--text); text-decoration: none;
          transition: color .12s;
        }
        .ops-link:hover { color: var(--primary); }
      `}</style>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Toplam',       value: counts.total,   color: 'var(--text)' },
          { label: 'Başarılı',     value: counts.success, color: '#15803d' },
          { label: 'Hata',         value: counts.error,   color: '#dc2626' },
          { label: 'Devam Eden',   value: counts.active,  color: '#1d4ed8' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <span style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'shopify', 'product', 'category', 'system'] as ChannelFilter[]).map(ch => (
            <button key={ch} className={`filter-chip${channelFilter === ch ? ' active' : ''}`}
              onClick={() => setChannelFilter(ch)}>
              {ch === 'all' ? 'Tümü' : ch === 'shopify' ? 'Shopify' : ch === 'product' ? 'Ürünler' : ch === 'category' ? 'Kategoriler' : 'Sistem'}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'success', 'error', 'syncing'] as StatusFilter[]).map(st => (
            <button key={st} className={`filter-chip${statusFilter === st ? ' active' : ''}`}
              onClick={() => setStatusFilter(st)}>
              {st === 'all' ? 'Tümü' : st === 'success' ? 'Başarılı' : st === 'error' ? 'Hata' : 'Devam Eden'}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
          Son 3 ay · {filtered.length} kayıt{totalPages > 1 ? ` · Sayfa ${page}/${totalPages}` : ''}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>⏳</div>
            Yükleniyor…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              {statusFilter !== 'all' || channelFilter !== 'all' ? 'Filtre sonucu bulunamadı' : 'Henüz işlem yok'}
            </div>
            <div style={{ fontSize: 13 }}>
              {statusFilter !== 'all' || channelFilter !== 'all'
                ? 'Farklı bir filtre deneyin.'
                : 'Ürün oluşturun, düzenleyin ya da Shopify ile eşleştirin.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>İşlem</th>
                  <th>Kanal</th>
                  <th>Ürün</th>
                  <th>Durum</th>
                  <th>Mesaj</th>
                  <th>Zaman</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(job => {
                  const ch    = CHANNEL_META[job.channel] || { label: job.channel };
                  const act   = ACTION_META[job.action]   || { label: job.action, color: 'var(--text-muted)', bg: 'var(--bg)' };
                  const st    = STATUS_META[job.status]   || STATUS_META.pending;
                  const hasProduct = job.product_id && job.product_name;

                  return (
                    <tr key={job.id} className="ops-row">

                      {/* İşlem */}
                      <td>
                        <span className="ops-tag" style={{ color: act.color, background: act.bg }}>
                          {act.label}
                        </span>
                      </td>

                      {/* Kanal */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ch.favicon
                            ? <img src={`https://www.google.com/s2/favicons?domain=${ch.favicon}&sz=32`}
                                width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} alt="" />
                            : <span style={{ fontSize: 14, lineHeight: 1 }}>{ch.emoji}</span>
                          }
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{ch.label}</span>
                        </div>
                      </td>

                      {/* Ürün / Kategori */}
                      <td>
                        {hasProduct ? (
                          <Link
                            to={job.channel === 'category' ? `/categories/${job.product_id}` : `/products/${job.product_id}`}
                            className="ops-link"
                          >
                            {job.product_name}
                          </Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Durum */}
                      <td>
                        <span className="ops-status"
                          style={{ color: st.text, background: st.bg, border: `1px solid ${st.border}` }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: st.dot, flexShrink: 0,
                            ...(job.status === 'syncing' ? { animation: 'spin-dot 1s linear infinite' } : {}),
                          }} />
                          {st.label}
                        </span>
                      </td>

                      {/* Mesaj */}
                      <td style={{ maxWidth: 320 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 500,
                          color: job.status === 'error' ? '#dc2626' : 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {job.message}
                        </div>
                        {job.detail && (
                          <div style={{
                            fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>
                            {job.detail}
                          </div>
                        )}
                      </td>

                      {/* Zaman */}
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {formatTR(job.updated_at)}
                        </span>
                      </td>

                      {/* Aksiyon */}
                      <td style={{ textAlign: 'right' }}>
                        {job.status === 'error' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: 'var(--primary)', padding: '4px 10px' }}
                            disabled={retrying === job.id}
                            onClick={() => handleRetry(job.id)}>
                            {retrying === job.id ? '…' : '↺ Tekrar'}
                          </button>
                        )}
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
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            padding: '14px 16px', borderTop: '1px solid var(--border)',
          }}>
            <button
              className="filter-chip"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{ opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'default' : 'pointer' }}>
              ← Önceki
            </button>

            {/* Sayfa numaraları – en fazla 7 göster */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce<(number | '...')[]>((acc, n, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) + 1 < n) acc.push('...');
                acc.push(n);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`ellipsis-${idx}`} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
                ) : (
                  <button key={item} className={`filter-chip${page === item ? ' active' : ''}`}
                    onClick={() => setPage(item as number)}
                    style={{ minWidth: 34 }}>
                    {item}
                  </button>
                )
              )}

            <button
              className="filter-chip"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'default' : 'pointer' }}>
              Sonraki →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
