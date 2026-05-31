import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { Category, Product } from '../types';

// ── Thumbnail: görsel varsa göster, yoksa renkli harf placeholder ─────────────
const PLACEHOLDER_COLORS: [string, string][] = [
  ['#6366f1','#e0e7ff'], ['#0ea5e9','#e0f2fe'], ['#10b981','#d1fae5'],
  ['#f59e0b','#fef3c7'], ['#ec4899','#fce7f3'], ['#8b5cf6','#ede9fe'],
  ['#14b8a6','#ccfbf1'], ['#f97316','#ffedd5'],
];

function nameColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}

function CatThumb({ name, image }: { name: string; image?: string }) {
  const [fg, bg] = nameColor(name);
  const style: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    border: '1px solid var(--border-light)', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  if (image) {
    return (
      <div style={style}>
        <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    );
  }
  return (
    <div style={{ ...style, background: bg }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: fg, lineHeight: 1, userSelect: 'none' }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

interface CatRow {
  id?: string;
  name: string;
  image?: string;
  total: number;
  active: number;
  draft: number;
  archived: number;
  nostock: number;
}

type SortKey = 'name' | 'total' | 'active' | 'draft' | 'archived' | 'nostock';

function buildRows(products: Product[], categories: Category[]): CatRow[] {
  const map: Record<string, CatRow> = {};

  // Seed from categories table (so empty categories also appear, with their image)
  categories.forEach(cat => {
    map[cat.name] = { id: cat.id, name: cat.name, image: cat.image || undefined, total: 0, active: 0, draft: 0, archived: 0, nostock: 0 };
  });

  // Count products
  products.forEach(p => {
    (p.category ?? []).forEach(cat => {
      if (!cat) return;
      if (!map[cat]) {
        map[cat] = { name: cat, total: 0, active: 0, draft: 0, archived: 0, nostock: 0 };
      }
      map[cat].total++;
      if (p.status === 'active')   map[cat].active++;
      if (p.status === 'draft')    map[cat].draft++;
      if (p.status === 'archived') map[cat].archived++;
      if (p.stock === 0)           map[cat].nostock++;
    });
  });
  return Object.values(map);
}

export default function Categories() {
  const navigate    = useNavigate();
  const { showToast } = useToast();

  const [products,    setProducts]    = useState<Product[]>([]);
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [sortKey,     setSortKey]     = useState<SortKey>('total');
  const [sortAsc,     setSortAsc]     = useState(false);

  // Silme onay modal
  const [deleteTarget, setDeleteTarget] = useState<CatRow | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => {
    Promise.all([
      api.products.list({ limit: 500 }),
      api.categories.list(),
    ]).then(([prodRes, cats]) => {
      setProducts(prodRes.products);
      setCategories(cats);
    }).finally(() => setLoading(false));
  }, []);

  // Kategorileri ürünlerden + categories tablosundan hesapla
  const rows = buildRows(products, categories);

  // Filtre + sıralama
  const filtered = rows
    .filter(c => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aVal = sortKey === 'name' ? a.name : (a[sortKey] as number);
      const bVal = sortKey === 'name' ? b.name : (b[sortKey] as number);
      if (typeof aVal === 'string' && typeof bVal === 'string')
        return sortAsc ? aVal.localeCompare(bVal, 'tr') : bVal.localeCompare(aVal, 'tr');
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(key === 'name'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <svg width={12} height={12} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: .3, marginLeft: 4 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return <svg width={12} height={12} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 4, color: 'var(--primary)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={sortAsc ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} /></svg>;
  };

  // Yeni kategori sayfasına git
  const handleAddCategory = () => navigate('/categories/new');

  // Kategori satırına tıklama — DB'de kaydı yoksa önce oluştur, sonra detay sayfasına git
  const handleRowClick = async (c: CatRow) => {
    if (c.id) {
      navigate(`/categories/${c.id}`);
      return;
    }
    // Ürünlerden gelen ama categories tablosunda henüz olmayan kategori → otomatik kaydet
    try {
      const cat = await api.categories.create({ name: c.name, description: '', image: '' });
      setCategories(prev => [...prev, cat]);
      navigate(`/categories/${cat.id}`);
    } catch {
      // Belki 409 — zaten oluşturulmuş ama biz bilmiyoruz; listeyi yenile
      const cats = await api.categories.list().catch(() => [] as typeof categories);
      const found = cats.find(cat => cat.name === c.name);
      if (found) {
        setCategories(cats);
        navigate(`/categories/${found.id}`);
      } else {
        navigate(`/categories/new`);
      }
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Bu kategorideki tüm ürünleri bul ve kategoriden çıkar
      const affected = products.filter(p => (p.category ?? []).includes(deleteTarget.name));
      await Promise.all(affected.map(p =>
        api.products.patch(p.id, {
          category: (p.category ?? []).filter(c => c !== deleteTarget.name) as any,
        })
      ));
      setProducts(prev => prev.map(p => ({
        ...p,
        category: (p.category ?? []).filter(c => c !== deleteTarget.name),
      })));
      // categories tablosundan da sil (varsa)
      if (deleteTarget.id) {
        await api.categories.delete(deleteTarget.id).catch(() => {});
        setCategories(prev => prev.filter(c => c.id !== deleteTarget.id));
      }
      showToast('Silindi', `"${deleteTarget.name}" kategorisi ${affected.length} üründen kaldırıldı.`, 'success');
      setDeleteTarget(null);
    } catch (e: unknown) {
      showToast('Hata', e instanceof Error ? e.message : 'Silme başarısız.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 16px', fontSize: 12, fontWeight: 700,
    color: 'var(--text-muted)', textAlign: 'left', whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none', background: 'var(--bg-soft)',
    borderBottom: '1px solid var(--border)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '12px 16px', fontSize: 13, borderBottom: '1px solid var(--border-light)',
    verticalAlign: 'middle',
  };

  return (
    <Layout title="Kategoriler">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Kategori Yönetimi</div>
          <div className="page-subtitle">
            {loading ? 'Yükleniyor…' : `${rows.length} kategori · ${products.length} ürün`}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleAddCategory}>
            <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Kategori Ekle
          </button>
        </div>
      </div>

      <div className="card">
        {/* Filter bar */}
        <div className="filter-bar">
          <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
            <svg className="search-icon" width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              className="form-control"
              placeholder="Kategori ara…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setSearch('')}>
              ✕ Temizle
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <h3>Kategori bulunamadı</h3>
            <p>Henüz hiçbir ürüne kategori atanmamış veya arama sonuç vermedi.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle} onClick={() => handleSort('name')}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      Kategori <SortIcon col="name" />
                    </span>
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => handleSort('total')}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Toplam <SortIcon col="total" />
                    </span>
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => handleSort('active')}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Aktif <SortIcon col="active" />
                    </span>
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => handleSort('draft')}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Taslak <SortIcon col="draft" />
                    </span>
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => handleSort('archived')}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Arşiv <SortIcon col="archived" />
                    </span>
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center' }} onClick={() => handleSort('nostock')}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Stok Yok <SortIcon col="nostock" />
                    </span>
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right', cursor: 'default' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr
                    key={c.name}
                    style={{ background: i % 2 === 1 ? 'var(--bg-soft, #fafafa)' : '#fff', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-light, #EEF2FF)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 1 ? 'var(--bg-soft, #fafafa)' : '#fff')}
                    onClick={() => handleRowClick(c)}
                  >
                    {/* Kategori adı */}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <CatThumb name={c.name} image={c.image} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            {c.total} ürün
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Toplam */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <strong style={{ fontSize: 15 }}>{c.total}</strong>
                    </td>

                    {/* Aktif */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {c.active > 0
                        ? <span className="badge badge-success">{c.active}</span>
                        : <span style={{ color: 'var(--border)', fontSize: 14 }}>—</span>}
                    </td>

                    {/* Taslak */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {c.draft > 0
                        ? <span className="badge badge-warning">{c.draft}</span>
                        : <span style={{ color: 'var(--border)', fontSize: 14 }}>—</span>}
                    </td>

                    {/* Arşiv */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {c.archived > 0
                        ? <span className="badge badge-gray">{c.archived}</span>
                        : <span style={{ color: 'var(--border)', fontSize: 14 }}>—</span>}
                    </td>

                    {/* Stok Yok */}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {c.nostock > 0
                        ? <span className="badge badge-danger">{c.nostock}</span>
                        : <span style={{ color: 'var(--border)', fontSize: 14 }}>—</span>}
                    </td>

                    {/* İşlemler */}
                    <td style={{ ...tdStyle, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12 }}
                          onClick={() => handleRowClick(c)}
                          title="Kategori detayı"
                        >
                          Düzenle
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ fontSize: 12, background: 'var(--danger-light)', color: 'var(--danger)', border: 'none' }}
                          onClick={() => setDeleteTarget(c)}
                          title="Kategoriyi sil"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer */}
            <div style={{
              padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-light)',
              display: 'flex', gap: 16,
            }}>
              <span><strong>{filtered.length}</strong> kategori</span>
              <span><strong>{filtered.reduce((s, c) => s + c.total, 0)}</strong> ürün</span>
              <span><strong>{filtered.reduce((s, c) => s + c.active, 0)}</strong> aktif</span>
              {filtered.some(c => c.nostock > 0) && (
                <span style={{ color: 'var(--danger)' }}>
                  <strong>{filtered.reduce((s, c) => s + c.nostock, 0)}</strong> stok yok
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Kategori Sil Onay Modal ─────────────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Kategoriyi Sil">
        {deleteTarget && (
          <>
            <div style={{ padding: '4px 0 20px' }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>
                <strong>"{deleteTarget.name}"</strong> kategorisi{' '}
                <strong style={{ color: 'var(--danger)' }}>{deleteTarget.total} ürün</strong>den kaldırılacak.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Ürünler silinmez, sadece bu kategori etiketleri kaldırılır. Bu işlem geri alınamaz.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>İptal</button>
              <button
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
                onClick={handleDeleteCategory}
                disabled={deleting}
              >
                {deleting ? 'Siliniyor…' : 'Sil'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}
