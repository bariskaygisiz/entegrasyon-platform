import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Product } from '../types';

const STATUS_TABS = [
  { key: 'all',      label: 'Tüm Ürünler' },
  { key: 'active',   label: 'Aktif' },
  { key: 'draft',    label: 'Taslak' },
  { key: 'archived', label: 'Arşiv' },
  { key: 'nostock',  label: 'Stokta Yok' },
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
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const load = (tab: string, q: string) => {
    setLoading(true);
    const status = tab === 'all' || tab === 'nostock' ? undefined : tab;
    api.products.list({ status, search: q || undefined, limit: 100 })
      .then(r => {
        const list = tab === 'nostock' ? r.products.filter(p => p.stock === 0) : r.products;
        setProducts(list);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load('all', ''); }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    load(key, search);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(activeTab, q), 300);
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

  const tabCount = (key: string) => {
    if (key === 'all')      return total;
    if (key === 'active')   return activeCount;
    if (key === 'draft')    return draftCount;
    if (key === 'archived') return archivedCount;
    if (key === 'nostock')  return noStockCount;
    return 0;
  };

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
      <div className="page-header">
        <div>
          <div className="page-title">Ürün Yönetimi</div>
          <div className="page-subtitle">Ürünlerinizi ekleyin, düzenleyin ve pazaryerlerine gönderin</div>
        </div>
        <div className="page-actions">
          <Link to="/products/new" className="btn btn-primary">
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ürün Ekle
          </Link>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--primary-light)', border: '1px solid var(--primary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>{selected.size} ürün seçildi</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Seçimi Kaldır</button>
            <button className="btn btn-danger btn-sm">Sil</button>
          </div>
        </div>
      )}

      <div className="card">
        {/* Tabs */}
        <div className="tabs">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              className={`tab-btn${activeTab === t.key ? ' active' : ''}`}
              onClick={() => handleTabChange(t.key)}
            >
              {t.label}
              {' '}
              <span style={{ color: t.key === 'nostock' ? 'var(--danger)' : 'var(--text-muted)' }}>
                {tabCount(t.key)}
              </span>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <svg className="search-icon" width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="form-control"
              placeholder="Ürün adı, SKU veya barkod ara..."
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2M9 16h6" />
            </svg>
            Filtrele
          </button>
          <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Senkronize Et
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : products.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <h3>Ürün bulunamadı</h3>
            <p>Arama kriterlerinizi değiştirmeyi deneyin.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table id="productsTable">
              <thead>
                <tr>
                  <th><input type="checkbox" id="checkAll" checked={selected.size === products.length && products.length > 0} onChange={e => toggleAll(e.target.checked)} /></th>
                  <th>Ürün</th>
                  <th>Ürün Tipi</th>
                  <th>Kategori</th>
                  <th>Fiyat</th>
                  <th>Stok</th>
                  <th>Kanallar</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const st = statusLabel(p.status);
                  const hasLowStock = p.stock > 0 && p.stock <= 5;
                  const isVariant = p.has_variants;
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/products/${p.id}`)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
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
                      <td>
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>
                          {isVariant ? 'Varyant' : 'Basit'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.category}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatMoney(p.price)}</div>
                        {p.discounted_price && (
                          <div style={{ fontSize: 11, color: 'var(--success)' }}>{formatMoney(p.discounted_price)}</div>
                        )}
                      </td>
                      <td>
                        <span style={{ color: p.stock === 0 ? 'var(--danger)' : hasLowStock ? 'var(--warning)' : 'var(--text)', fontWeight: hasLowStock || p.stock === 0 ? 600 : 400 }}>
                          {p.stock === 0 ? 'Stok Yok' : `${p.stock} adet`}
                        </span>
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
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => navigate(`/products/${p.id}`)}>
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-footer">
          <span className="text-muted" style={{ fontSize: 13 }}>{products.length} ürün gösteriliyor</span>
          <span className="text-muted" style={{ fontSize: 13 }}>Toplam: {total}</span>
        </div>
      </div>
    </Layout>
  );
}
