import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { Product } from '../types';

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
        /* Önizleme */
        <div style={{ position: 'relative', display: 'inline-block', width: '50%' }}>
          <img
            src={value}
            alt="Kategori görseli"
            style={{
              width: '100%', height: 'auto', display: 'block',
              borderRadius: 8, border: '1px solid var(--border-light)',
            }}
          />
          <div style={{
            position: 'absolute', top: 8, right: 8,
            display: 'flex', gap: 6,
          }}>
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
        /* Yükleme alanı */
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

// ── Sayfa ─────────────────────────────────────────────────────────────────────
export default function CategoryNew() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [image,       setImage]       = useState('');
  const [saving,      setSaving]      = useState(false);

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [prodSearch,  setProdSearch]  = useState('');
  const [prodLoading, setProdLoading] = useState(true);

  useEffect(() => {
    api.products.list({ limit: 1000 })
      .then(r => setAllProducts(r.products))
      .finally(() => setProdLoading(false));
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { showToast('Hata', 'Kategori adı zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      const cat = await api.categories.create({ name: trimmed, description: description.trim(), image });
      showToast('Oluşturuldu', `"${cat.name}" kategorisi oluşturuldu.`, 'success');
      navigate(`/categories/${cat.id}`);
    } catch (e: unknown) {
      showToast('Hata', e instanceof Error ? e.message : 'Oluşturulamadı.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = allProducts.filter(p =>
    !prodSearch.trim() ||
    p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(prodSearch.toLowerCase())
  );

  const tdStyle: React.CSSProperties = {
    padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border-light)',
    verticalAlign: 'middle',
  };

  return (
    <Layout title="Kategoriler">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link to="/categories" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Kategoriler</Link>
        <span>/</span>
        <span style={{ color: 'var(--text)' }}>Yeni Kategori</span>
      </div>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Yeni Kategori</div>
          <div className="page-subtitle">Kategori bilgilerini girin ve kaydedin.</div>
        </div>
        <div className="page-actions">
          <Link to="/categories" className="btn btn-ghost">İptal</Link>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Sol kart — Kategori bilgileri */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>Kategori Bilgileri</h3>

          <div className="form-group">
            <label className="form-label">Kategori Adı <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              autoFocus
              className="form-control"
              placeholder="ör. Yazıcılar"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Açıklama</label>
            <textarea
              className="form-control"
              rows={3}
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

        {/* Sağ kart — Ürünler */}
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>Bu Kategorideki Ürünler</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
            Kategori kaydedildikten sonra ürünleri bu kategoriye atayabilirsiniz.
          </p>

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
          ) : (
            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)' }}>Ürün</th>
                    <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)' }}>Kategori</th>
                    <th style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)' }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        {prodSearch ? 'Sonuç bulunamadı.' : 'Henüz ürün yok.'}
                      </td>
                    </tr>
                  ) : filteredProducts.map(p => (
                    <tr key={p.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{p.emoji || '📦'}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            {p.sku && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sku}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(p.category ?? []).map(c => (
                            <span key={c} className="badge badge-gray" style={{ fontSize: 11 }}>{c}</span>
                          ))}
                          {(p.category ?? []).length === 0 && <span style={{ fontSize: 12, color: 'var(--border)' }}>—</span>}
                        </div>
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
    </Layout>
  );
}
