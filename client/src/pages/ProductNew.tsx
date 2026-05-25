import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

const CHANNELS = [
  { key: 'trendyol', label: 'Trendyol',    favicon: 'trendyol.com' },
  { key: 'hepsi',    label: 'Hepsiburada', favicon: 'hepsiburada.com' },
  { key: 'n11',      label: 'N11',         favicon: 'n11.com' },
  { key: 'ikas',     label: 'İkas',        favicon: 'ikas.com' },
  { key: 'shopify',  label: 'Shopify',     favicon: 'shopify.com' },
  { key: 'ticimax',  label: 'Ticimax',     favicon: 'ticimax.com' },
  { key: 'ideasoft', label: 'İdeasoft',    favicon: 'ideasoft.com' },
];

const CATEGORIES = ['Telefon','Bilgisayar','Tablet','Aksesuar','Ses Sistemleri','Monitör','Televizyon','Ev Elektroniği','Fotoğraf'];

export default function ProductNew() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', discounted_price: '', cost: '',
    sku: '', barcode: '', stock: '0', weight: '', status: 'draft', category: '',
  });
  const [channels, setChannels] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const profit = () => {
    const p = parseFloat(form.price) || 0;
    const c = parseFloat(form.cost) || 0;
    if (!p || !c) return null;
    return Math.round(((p - c) / p) * 100);
  };
  const profitVal = profit();

  const toggleChannel = (key: string) => {
    setChannels(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const val = tagInput.trim();
    if (val && !tags.includes(val)) setTags(prev => [...prev, val]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Hata', 'Ürün adı zorunludur.', 'error'); return; }
    if (!form.price) { showToast('Hata', 'Satış fiyatı zorunludur.', 'error'); return; }
    if (!form.sku.trim()) { showToast('Hata', 'SKU zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      const p = await api.products.create({
        name: form.name, description: form.description,
        price: parseFloat(form.price) || 0,
        discounted_price: parseFloat(form.discounted_price) || null,
        cost: parseFloat(form.cost) || 0,
        sku: form.sku, barcode: form.barcode,
        stock: parseInt(form.stock) || 0,
        weight: parseFloat(form.weight) || 0,
        status: form.status as 'active' | 'draft' | 'archived',
        category: form.category, channels, tags,
      });
      showToast('Oluşturuldu', 'Ürün başarıyla eklendi.', 'success');
      navigate(`/products/${p.id}`);
    } catch (e: unknown) {
      showToast('Hata', e instanceof Error ? e.message : 'Bir hata oluştu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Yeni Ürün Ekle"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/products" className="btn btn-ghost btn-sm">Vazgeç</Link>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Ürünü Oluştur'}
          </button>
        </div>
      }
    >
      <Link to="/products" className="pd-back">
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Ürünler
      </Link>

      <div className="pd-header">
        <div className="pd-header-left">
          <h1>Yeni Ürün</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Ürün bilgilerini doldurun ve kanalları seçin</p>
        </div>
      </div>

      <div className="pd-layout">

        {/* Sol sütun */}
        <div>

          {/* Ürün Bilgisi */}
          <div className="pd-card">
            <div className="pd-card-title">Ürün Bilgisi</div>
            <div className="pd-card-body">
              <div className="form-group">
                <label className="form-label">Ürün Adı <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="form-control" type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ürün adını girin" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Açıklama</label>
                <textarea className="form-control" rows={10} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ürün açıklamasını girin..." style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* Medya */}
          <div className="pd-card">
            <div className="pd-card-title">Medya</div>
            <div className="pd-card-body">
              <label className="media-upload">
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} />
                <svg width={32} height={32} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Dosyaları sürükleyin veya tıklayın</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>PNG, JPG, WEBP — Maks. 20 MB</p>
              </label>
            </div>
          </div>

          {/* Fiyatlandırma */}
          <div className="pd-card">
            <div className="pd-card-title">Fiyatlandırma</div>
            <div className="pd-card-body">
              <div className="price-row">
                <div className="form-group">
                  <label className="form-label">Satış Fiyatı (₺) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-control" type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label className="form-label">İndirimli Fiyat (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opsiyonel</span></label>
                  <input className="form-control" type="number" value={form.discounted_price} onChange={e => set('discounted_price', e.target.value)} placeholder="—" />
                  <div className="price-hint">Dolu ise satış fiyatı üstü çizili gösterilir</div>
                </div>
              </div>
              <div className="price-row" style={{ marginTop: 4 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Maliyet (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>müşteriye gösterilmez</span></label>
                  <input className="form-control" type="number" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0,00" />
                </div>
              </div>
              <div className="profit-bar">
                <span style={{ color: 'var(--text-muted)' }}>Tahmini kâr marjı</span>
                <span className="profit-val" style={{
                  color: profitVal === null ? 'var(--text-muted)'
                    : profitVal >= 20 ? 'var(--success)'
                    : profitVal >= 10 ? 'var(--warning)'
                    : 'var(--danger)'
                }}>
                  {profitVal === null ? '—' : `%${profitVal}`}
                </span>
              </div>
            </div>
          </div>

          {/* Envanter */}
          <div className="pd-card">
            <div className="pd-card-title">Envanter</div>
            <div className="pd-card-body">
              <div className="price-row">
                <div className="form-group">
                  <label className="form-label">SKU (Stok Kodu) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="form-control" type="text" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Örn: PRD-001-SYH" />
                </div>
                <div className="form-group">
                  <label className="form-label">Barkod (GTIN / EAN)</label>
                  <input className="form-control" type="text" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="8680000000000" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Başlangıç Stoğu</label>
                <input className="form-control" type="number" value={form.stock} onChange={e => set('stock', e.target.value)} style={{ maxWidth: 160 }} />
              </div>
            </div>
          </div>

          {/* Kargo */}
          <div className="pd-card">
            <div className="pd-card-title">Kargo</div>
            <div className="pd-card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ağırlık (kg)</label>
                <input className="form-control" type="number" step="0.1" value={form.weight} onChange={e => set('weight', e.target.value)} style={{ maxWidth: 160 }} />
              </div>
            </div>
          </div>

        </div>

        {/* Sağ sütun */}
        <div>

          {/* Durum */}
          <div className="pd-card">
            <div className="pd-card-title">Durum</div>
            <div className="pd-card-body">
              <select className="status-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Aktif</option>
                <option value="draft">Taslak</option>
                <option value="archived">Arşiv</option>
              </select>
            </div>
          </div>

          {/* Satış Kanalları */}
          <div className="pd-card">
            <div className="pd-card-title">Satış Kanalları</div>
            <div className="pd-card-body">
              <div className="channel-list">
                {CHANNELS.map(ch => (
                  <div key={ch.key} className={`channel-row${channels.includes(ch.key) ? ' active' : ''}`}
                    onClick={() => toggleChannel(ch.key)}>
                    <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" readOnly checked={channels.includes(ch.key)}
                        onChange={() => toggleChannel(ch.key)} />
                      <img src={`https://www.google.com/s2/favicons?domain=${ch.favicon}&sz=32`}
                        width={18} height={18} style={{ borderRadius: 3 }} alt="" />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{ch.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Organizasyon */}
          <div className="pd-card">
            <div className="pd-card-title">Organizasyon</div>
            <div className="pd-card-body">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Kategori seçin</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Etiketler</label>
                <div className="tag-list">
                  {tags.map(t => (
                    <span key={t} className="tag">
                      {t}
                      <button onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                    </span>
                  ))}
                </div>
                <input className="form-control" type="text" placeholder="Etiket ekle ve Enter'a bas"
                  style={{ marginTop: 8 }} value={tagInput}
                  onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} />
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="save-bar">
        <Link to="/products" className="btn btn-ghost">Vazgeç</Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Ürünü Oluştur'}
        </button>
      </div>
    </Layout>
  );
}
