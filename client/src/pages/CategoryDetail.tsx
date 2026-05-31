import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { Category, Product } from '../types';

// ── Görsel sıkıştırma yardımcısı ─────────────────────────────────────────────
function compressImage(file: File, maxPx = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale  = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ── Görsel yükleme alanı ──────────────────────────────────────────────────────
function ImageUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = Array.from(files).find(f => f.type.startsWith('image/'));
    if (!file) return;
    const compressed = await compressImage(file);
    onChange(compressed);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {value ? (
        <div style={{ position: 'relative', display: 'inline-block', width: '50%' }}>
          <img
            src={value}
            alt="Kategori görseli"
            style={{
              width: '100%', height: 'auto', display: 'block',
              borderRadius: 8, border: '1px solid var(--border-light)',
            }}
          />
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--text)',
              }}
            >
              Değiştir
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              style={{
                padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.92)', border: '1px solid var(--border)',
                borderRadius: 6, color: 'var(--danger)',
              }}
            >
              Kaldır
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '32px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? 'var(--primary-light, #EEF2FF)' : 'var(--bg-soft)',
            transition: 'all .15s',
            width: '50%',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Görsel seçmek için tıklayın
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            veya sürükleyip bırakın · JPG, PNG, WEBP
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12, pointerEvents: 'none', fontSize: 12 }}
          >
            Dosya Seç
          </button>
        </div>
      )}
    </div>
  );
}

export default function CategoryDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { showToast } = useToast();

  // Category state
  const [category, setCategory] = useState<Category | null>(null);
  const [loading,  setLoading]  = useState(true);

  // Form fields
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [image,       setImage]       = useState('');
  const [dirty,       setDirty]       = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Products in this category
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [prodSearch,  setProdSearch]  = useState('');
  const [prodLoading, setProdLoading] = useState(true);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  // ── Load category ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    api.categories.get(id)
      .then(cat => {
        setCategory(cat);
        resetToCategory(cat);
      })
      .catch(() => showToast('Hata', 'Kategori yüklenemedi.', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Load all products ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.products.list({ limit: 1000 })
      .then(r => setAllProducts(r.products))
      .finally(() => setProdLoading(false));
  }, []);

  const resetToCategory = useCallback((cat: Category) => {
    setName(cat.name);
    setDescription(cat.description || '');
    setImage(cat.image || '');
    setDirty(false);
  }, []);

  // ── Dirty tracking ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!category) return;
    const changed =
      name        !== category.name        ||
      description !== (category.description || '') ||
      image       !== (category.image || '');
    setDirty(changed);
  }, [name, description, image, category]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!id || !category) return;
    const trimmed = name.trim();
    if (!trimmed) { showToast('Hata', 'Kategori adı zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      const updated = await api.categories.update(id, {
        name: trimmed,
        description: description.trim(),
        image,
      });
      setCategory(updated);
      resetToCategory(updated);
      showToast('Kaydedildi', `"${updated.name}" güncellendi.`, 'success');
    } catch (e: unknown) {
      showToast('Hata', e instanceof Error ? e.message : 'Güncellenemedi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!id || !category) return;
    setDeleting(true);
    try {
      // Remove category from products first
      const affected = allProducts.filter(p => (p.category ?? []).includes(category.name));
      await Promise.all(affected.map(p =>
        api.products.patch(p.id, {
          category: (p.category ?? []).filter(c => c !== category.name) as any,
        })
      ));
      await api.categories.delete(id);
      showToast('Silindi', `"${category.name}" kategorisi silindi.`, 'success');
      navigate('/categories');
    } catch (e: unknown) {
      showToast('Hata', e instanceof Error ? e.message : 'Silinemedi.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // ── Products in this category ─────────────────────────────────────────────────
  const catProducts = allProducts.filter(p =>
    (p.category ?? []).includes(category?.name ?? '')
  );
  const filteredProducts = catProducts.filter(p =>
    !prodSearch.trim() ||
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const tdStyle: React.CSSProperties = {
    padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border-light)',
    verticalAlign: 'middle',
  };

  if (loading) {
    return (
      <Layout title="Kategoriler">
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
      </Layout>
    );
  }

  if (!category) {
    return (
      <Layout title="Kategoriler">
        <div style={{ padding: 80, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <h3>Kategori bulunamadı</h3>
          <Link to="/categories" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>Kategorilere Dön</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Kategoriler">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link to="/categories" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Kategoriler</Link>
        <span>/</span>
        <span style={{ color: 'var(--text)' }}>{category.name}</span>
      </div>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">{category.name}</div>
          <div className="page-subtitle">
            {catProducts.length} ürün ·{' '}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(category.updated_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} güncellendi
            </span>
          </div>
        </div>
        <div className="page-actions">
          {dirty && (
            <>
              <button className="btn btn-ghost" onClick={() => resetToCategory(category)} disabled={saving}>Vazgeç</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </>
          )}
          {!dirty && (
            <button
              className="btn btn-sm"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', fontSize: 13 }}
              onClick={() => setDeleteOpen(true)}
            >
              Kategoriyi Sil
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Sol kart — Kategori bilgileri */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Kategori Bilgileri</h3>

          <div className="form-group">
            <label className="form-label">Kategori Adı <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              className="form-control"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Açıklama</label>
            <textarea
              className="form-control"
              rows={4}
              placeholder="Kategori hakkında kısa bir açıklama…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Görsel</label>
            <ImageUpload value={image} onChange={setImage} />
          </div>
        </div>

        {/* Sağ kart — Kategorideki ürünler */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Bu Kategorideki Ürünler
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
                ({catProducts.length})
              </span>
            </h3>
            <Link to={`/products?category=${encodeURIComponent(category.name)}`} style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none' }}>
              Tümünü Gör →
            </Link>
          </div>

          {/* Arama */}
          <div className="search-wrap" style={{ marginBottom: 12 }}>
            <svg className="search-icon" width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx={11} cy={11} r={8} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="form-control"
              placeholder="Ürün ara…"
              value={prodSearch}
              onChange={e => setProdSearch(e.target.value)}
            />
          </div>

          {prodLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Yükleniyor…</div>
          ) : catProducts.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div>Bu kategoriye henüz ürün atanmamış.</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>Ürün</th>
                    <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>Stok</th>
                    <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        Sonuç bulunamadı.
                      </td>
                    </tr>
                  ) : filteredProducts.map(p => (
                    <tr
                      key={p.id}
                      style={{ cursor: 'pointer', transition: 'background .1s' }}
                      onClick={() => navigate(`/products/${p.id}`)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-light, #EEF2FF)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{p.emoji || '📦'}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            {p.sku && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sku}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ fontSize: 13, color: p.stock === 0 ? 'var(--danger)' : 'var(--text)' }}>
                          {p.stock}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        {p.status === 'active'
                          ? <span className="badge badge-success">Aktif</span>
                          : p.status === 'draft'
                          ? <span className="badge badge-warning">Taslak</span>
                          : <span className="badge badge-gray">Arşiv</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Sil onay modal ──────────────────────────────────────────────────────── */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Kategoriyi Sil">
        <div style={{ padding: '4px 0 20px' }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>
            <strong>"{category.name}"</strong> kategorisi{' '}
            <strong style={{ color: 'var(--danger)' }}>{catProducts.length} ürün</strong>den kaldırılacak ve kalıcı olarak silinecek.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Ürünler silinmez, sadece bu kategori etiketleri kaldırılır. Bu işlem geri alınamaz.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-light)' }}>
          <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>İptal</button>
          <button
            className="btn"
            style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Siliniyor…' : 'Sil'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
