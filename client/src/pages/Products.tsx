import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Product } from '../types';

const STATUS_TABS = [
  { key: 'all',      label: 'Tümü' },
  { key: 'active',   label: 'Aktif' },
  { key: 'draft',    label: 'Taslak' },
  { key: 'archived', label: 'Arşiv' },
];

const CHANNEL_META: Record<string, { label: string; favicon: string }> = {
  trendyol: { label: 'Trendyol',    favicon: 'trendyol.com' },
  hepsi:    { label: 'Hepsiburada', favicon: 'hepsiburada.com' },
  n11:      { label: 'N11',         favicon: 'n11.com' },
  ikas:     { label: 'İkas',        favicon: 'ikas.com' },
  shopify:  { label: 'Shopify',     favicon: 'shopify.com' },
  ticimax:  { label: 'Ticimax',     favicon: 'ticimax.com' },
  ideasoft: { label: 'İdeasoft',    favicon: 'ideasoft.com' },
};

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = (status: string, q: string) => {
    setLoading(true);
    api.products.list({ status: status !== 'all' ? status : undefined, search: q || undefined, limit: 100 })
      .then(r => { setProducts(r.products); setTotal(r.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(statusFilter, search); }, []);

  const handleStatusChange = (s: string) => {
    setStatusFilter(s);
    load(s, search);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(statusFilter, q), 300);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(products.map(p => p.id)) : new Set());
  };

  const activeCount   = products.filter(p => p.status === 'active').length;
  const draftCount    = products.filter(p => p.status === 'draft').length;
  const archivedCount = products.filter(p => p.status === 'archived').length;
  const noStockCount  = products.filter(p => p.stock === 0).length;

  return (
    <Layout
      title="Ürünler"
      actions={
        <Link to="/products/new" className="btn btn-primary btn-sm">
          <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Ürün Ekle
        </Link>
      }
    >
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Aktif', val: activeCount,   color: 'var(--success)', bg: '#F0FDF4' },
          { label: 'Taslak', val: draftCount,   color: 'var(--warning)', bg: '#FFFBEB' },
          { label: 'Arşiv',  val: archivedCount, color: 'var(--text-muted)', bg: 'var(--bg)' },
          { label: 'Stok Yok', val: noStockCount, color: 'var(--danger)', bg: '#FFF5F5' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
          <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
          </svg>
          <input
            className="form-control"
            style={{ paddingLeft: 32 }}
            type="text"
            placeholder="Ürün adı, SKU veya kategori…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        {/* Status tabs */}
        <div className="status-tabs" style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              className={`status-tab${statusFilter === t.key ? ' active' : ''}`}
              onClick={() => handleStatusChange(t.key)}
              style={{ padding: '6px 14px', fontSize: 12, background: statusFilter === t.key ? 'var(--primary)' : 'var(--card)', color: statusFilter === t.key ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div id="bulkBar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} ürün seçildi</span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setSelected(new Set())}>Seçimi Kaldır</button>
          <button className="btn btn-sm" style={{ fontSize: 12, background: 'var(--danger)', color: '#fff', border: 'none' }}>Seçilenleri Sil</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : products.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Ürün bulunamadı.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input type="checkbox" checked={selected.size === products.length && products.length > 0}
                      onChange={e => toggleAll(e.target.checked)} />
                  </th>
                  <th>Ürün</th>
                  <th>Durum</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>Kanallar</th>
                  <th>Kategori</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const st = statusLabel(p.status);
                  const hasLowStock = p.stock > 0 && p.stock <= 5;
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/products/${p.id}`)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="row-check" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            {p.emoji}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SKU: {p.sku || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        <span style={{ color: p.stock === 0 ? 'var(--danger)' : hasLowStock ? 'var(--warning)' : 'var(--text)' }}>
                          {p.stock === 0 ? 'Stok Yok' : `${p.stock} adet`}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatMoney(p.price)}</div>
                        {p.discounted_price && (
                          <div style={{ fontSize: 11, color: 'var(--success)' }}>{formatMoney(p.discounted_price)}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {p.channels.slice(0, 3).map(ch => {
                            const m = CHANNEL_META[ch];
                            return m ? (
                              <img key={ch} src={`https://www.google.com/s2/favicons?domain=${m.favicon}&sz=16`}
                                title={m.label} alt={m.label} style={{ width: 16, height: 16, borderRadius: 3 }} />
                            ) : null;
                          })}
                          {p.channels.length > 3 && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{p.channels.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.category}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-light)', fontSize: 12, color: 'var(--text-muted)' }}>
          {total} ürün · {products.length} gösteriliyor
        </div>
      </div>
    </Layout>
  );
}
