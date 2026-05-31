import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { MediaItem, VariantOption, VariantDataEntry } from '../types';

const CHANNELS = [
  { key: 'trendyol', label: 'Trendyol',    favicon: 'trendyol.com' },
  { key: 'hepsi',    label: 'Hepsiburada', favicon: 'hepsiburada.com' },
  { key: 'n11',      label: 'N11',         favicon: 'n11.com' },
  { key: 'ikas',     label: 'İkas',        favicon: 'ikas.com' },
  { key: 'shopify',  label: 'Shopify',     favicon: 'shopify.com' },
  { key: 'ticimax',  label: 'Ticimax',     favicon: 'ticimax.com' },
  { key: 'ideasoft', label: 'İdeasoft',    favicon: 'ideasoft.com' },
];

const KDV_RATES = [0, 1, 8, 10, 18, 20];

function KdvSection({ vatRate, vatIncluded, basePrice, onRateChange, onIncludedChange }: {
  vatRate: number; vatIncluded: boolean; basePrice: number;
  onRateChange: (v: number) => void; onIncludedChange: (v: boolean) => void;
}) {
  const kdvTutar = vatRate > 0 && basePrice > 0
    ? vatIncluded
      ? basePrice - basePrice / (1 + vatRate / 100)
      : basePrice * (vatRate / 100)
    : null;
  const kdvDahilFiyat = vatRate > 0 && basePrice > 0 && !vatIncluded
    ? basePrice + basePrice * (vatRate / 100)
    : null;

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 120 }}>
          <label className="form-label">KDV Oranı</label>
          <select
            className="form-control"
            value={vatRate}
            onChange={e => onRateChange(parseInt(e.target.value))}
            style={{ maxWidth: 120 }}
          >
            {KDV_RATES.map(r => <option key={r} value={r}>%{r}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Fiyatlara KDV</label>
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
            {[true, false].map(val => (
              <button
                key={String(val)}
                type="button"
                onClick={() => onIncludedChange(val)}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: vatIncluded === val ? 'var(--primary)' : 'transparent',
                  color: vatIncluded === val ? '#fff' : 'var(--text-muted)',
                  transition: 'all .15s',
                }}
              >
                {val ? 'KDV Dahil' : 'KDV Hariç'}
              </button>
            ))}
          </div>
        </div>
      </div>
      {basePrice > 0 && vatRate > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {kdvTutar !== null && (
            <span>KDV Tutarı: <strong style={{ color: 'var(--text)' }}>₺{kdvTutar.toFixed(2)}</strong></span>
          )}
          {kdvDahilFiyat !== null && (
            <span>KDV Dahil Fiyat: <strong style={{ color: 'var(--text)' }}>₺{kdvDahilFiyat.toFixed(2)}</strong></span>
          )}
          {vatIncluded && basePrice > 0 && vatRate > 0 && (
            <span>KDV Hariç Fiyat: <strong style={{ color: 'var(--text)' }}>₺{(basePrice / (1 + vatRate / 100)).toFixed(2)}</strong></span>
          )}
        </div>
      )}
    </div>
  );
}

function getCombinations(options: VariantOption[]): string[] {
  const filled = options.filter(o => o.name && o.values.length > 0);
  if (!filled.length) return [];
  let combos: string[][] = [[]];
  for (const opt of filled) combos = combos.flatMap(c => opt.values.map(v => [...c, v]));
  return combos.map(c => c.join(' / '));
}

export default function ProductNew() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', discounted_price: '', cost: '',
    sku: '', barcode: '', stock: '0', weight: '', status: 'draft',
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Kategorileri API'den çek
  useEffect(() => {
    api.categories.names().then(setAllCategories).catch(() => {});
  }, []);

  // Media state
  const [media, setMedia] = useState<MediaItem[]>([]);
  const mediaInputRef  = useRef<HTMLInputElement>(null);
  const dragIdxRef     = useRef<number | null>(null);
  const dragOverIdxRef = useRef<number | null>(null);

  // KDV state
  const [vatRate, setVatRate]         = useState(20);
  const [vatIncluded, setVatIncluded] = useState(true);

  // B2B state
  const [b2bPrice, setB2bPrice]           = useState('');
  const [b2bDiscounted, setB2bDiscounted] = useState('');

  // Variant state
  const [hasVariants, setHasVariants] = useState(false);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variantData, setVariantData] = useState<Record<string, VariantDataEntry>>({});

  const combos = hasVariants ? getCombinations(variantOptions) : [];

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const profitVal = (() => {
    const p = parseFloat(form.price) || 0;
    const c = parseFloat(form.cost) || 0;
    if (!p || !c) return null;
    return Math.round(((p - c) / p) * 100);
  })();

  const readFiles = (files: FileList | File[]) => {
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach((f, i) => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (!ev.target?.result) return;
        // Canvas ile sıkıştır: max 1200px, JPEG %80 — base64 boyutunu ~10x küçültür
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          setMedia(prev => [...prev, { id: Date.now() + i + Math.random(), src: compressed, selected: false }]);
        };
        img.src = ev.target!.result as string;
      };
      reader.readAsDataURL(f);
    });
  };

  const toggleChannel = (key: string) => {
    setChannels(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const val = tagInput.trim();
    if (val && !tags.includes(val)) setTags(prev => [...prev, val]);
    setTagInput('');
  };

  const updVar = (combo: string, field: string, val: string) => {
    setVariantData(prev => ({ ...prev, [combo]: { ...prev[combo], [field]: val } }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Hata', 'Ürün adı zorunludur.', 'error'); return; }
    if (!hasVariants) {
      if (!form.price) { showToast('Hata', 'Satış fiyatı zorunludur.', 'error'); return; }
      if (!form.sku.trim()) { showToast('Hata', 'SKU zorunludur.', 'error'); return; }
    }
    setSaving(true);
    try {
      const totalStock = hasVariants
        ? Object.values(variantData).reduce((s, v) => s + (parseInt(v.stock || '0') || 0), 0)
        : parseInt(form.stock) || 0;

      const p = await api.products.create({
        name: form.name,
        description: form.description,
        price: hasVariants ? 0 : parseFloat(form.price) || 0,
        discounted_price: hasVariants ? null : (parseFloat(form.discounted_price) || null),
        cost: hasVariants ? 0 : parseFloat(form.cost) || 0,
        sku: hasVariants ? '' : form.sku,
        barcode: hasVariants ? '' : form.barcode,
        stock: totalStock,
        weight: hasVariants ? 0 : parseFloat(form.weight) || 0,
        status: form.status as 'active' | 'draft' | 'archived',
        category: categories,
        channels,
        tags,
        media: media.map(m => ({ id: m.id, src: m.src ?? null, emoji: m.emoji })),
        has_variants: hasVariants,
        variant_options: variantOptions,
        variant_data: variantData,
        vat_rate: vatRate,
        vat_included: vatIncluded,
        b2b_price: b2bPrice ? parseFloat(b2bPrice) : null,
        b2b_discounted_price: b2bDiscounted ? parseFloat(b2bDiscounted) : null,
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
          {/* Medya */}
          <div className="pd-card">
            <div className="pd-card-title">
              <span>Medya</span>
              {media.some(m => m.selected) && (
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--danger)' }}
                  onClick={() => setMedia(prev => prev.filter(m => !m.selected))}>
                  Seçilenleri Sil
                </button>
              )}
            </div>
            <div className="pd-card-body">
              <input ref={mediaInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { readFiles(e.target.files || []); e.target.value = ''; }} />
              {media.length === 0 ? (
                <div className="media-upload" style={{ cursor: 'pointer' }}
                  onClick={() => mediaInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); readFiles(e.dataTransfer.files); }}>
                  <svg width={32} height={32} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ display: 'block', margin: '0 auto 10px', color: 'var(--text-muted)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Dosyaları sürükleyin veya tıklayın</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>PNG, JPG, WEBP — Maks. 20 MB</p>
                </div>
              ) : (
                <div className="media-grid"
                  onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
                  onDrop={e => { if (e.dataTransfer.files.length > 0) { e.preventDefault(); readFiles(e.dataTransfer.files); } }}
                >
                  {media.map((m, idx) => (
                    <div key={m.id}
                      className={`media-thumb${idx === 0 ? ' main-thumb' : ''}${m.selected ? ' selected' : ''}`}
                      draggable
                      onDragStart={() => { dragIdxRef.current = idx; }}
                      onDragEnter={() => { dragOverIdxRef.current = idx; }}
                      onDragOver={e => e.preventDefault()}
                      onDragEnd={() => {
                        const from = dragIdxRef.current;
                        const to   = dragOverIdxRef.current;
                        if (from === null || to === null || from === to) return;
                        setMedia(prev => {
                          const arr = [...prev];
                          arr.splice(to, 0, arr.splice(from, 1)[0]);
                          return arr;
                        });
                        dragIdxRef.current = null;
                        dragOverIdxRef.current = null;
                      }}
                      onClick={() => setMedia(prev => prev.map(x => x.id === m.id ? { ...x, selected: !x.selected } : x))}
                      style={{ cursor: 'grab' }}
                    >
                      <input type="checkbox" className="media-cb" checked={!!m.selected}
                        onChange={e => { e.stopPropagation(); setMedia(prev => prev.map(x => x.id === m.id ? { ...x, selected: !x.selected } : x)); }}
                        onClick={e => e.stopPropagation()} />
                      {m.src
                        ? <img src={m.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: idx === 0 ? 48 : 32 }}>{m.emoji || '🖼'}</span>
                      }
                      {idx === 0 && <div className="media-main-badge">ANA GÖRSEL</div>}
                    </div>
                  ))}
                  <div className="media-thumb add" onClick={() => mediaInputRef.current?.click()}>
                    <svg width={24} height={24} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Ekle</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Varyantlar */}
          <div className="pd-card">
            <div className="pd-card-title">
              <span>Varyantlar</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 400, cursor: 'pointer' }}>
                <input type="checkbox" checked={hasVariants}
                  onChange={e => {
                    setHasVariants(e.target.checked);
                    if (e.target.checked && variantOptions.length === 0)
                      setVariantOptions([{ id: Date.now(), name: '', values: [] }]);
                  }}
                  style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                Bu ürünün farklı seçenekleri var
              </label>
            </div>
            {hasVariants && (
              <div className="pd-card-body" style={{ borderTop: '1px solid var(--border-light)' }}>
                {variantOptions.map((opt, oi) => (
                  <div key={opt.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Seçenek adı</span>
                      <input className="form-control" type="text" placeholder="Renk, Beden…" value={opt.name} style={{ maxWidth: 200, fontSize: 13 }}
                        onChange={e => setVariantOptions(prev => prev.map((o, i) => i === oi ? { ...o, name: e.target.value } : o))} />
                      <button onClick={() => setVariantOptions(prev => prev.filter((_, i) => i !== oi))}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      {opt.values.map(v => (
                        <span key={v} className="tag">
                          {v}
                          <button onClick={() => setVariantOptions(prev => prev.map((o, i) => i === oi ? { ...o, values: o.values.filter(x => x !== v) } : o))}>×</button>
                        </span>
                      ))}
                      <input className="form-control" type="text" placeholder="Değer ekle + Enter" style={{ width: 160, padding: '5px 10px', fontSize: 12 }}
                        onKeyDown={e => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val && !opt.values.includes(val))
                            setVariantOptions(prev => prev.map((o, i) => i === oi ? { ...o, values: [...o.values, val] } : o));
                          (e.target as HTMLInputElement).value = '';
                        }} />
                    </div>
                  </div>
                ))}
                {variantOptions.length < 3 && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                    onClick={() => setVariantOptions(prev => [...prev, { id: Date.now(), name: '', values: [] }])}>
                    + Seçenek Ekle
                  </button>
                )}

                {/* Varyant tablosu */}
                {combos.length > 0 && (
                  <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
                      {combos.length} VARYANT
                    </div>
                    <div className="table-wrap">
                      <table style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth: 120 }}>Varyant</th>
                            <th style={{ minWidth: 100 }}>Fiyat (₺)</th>
                            <th style={{ minWidth: 110 }}>İnd. Fiyat (₺)</th>
                            <th style={{ minWidth: 105 }}>Toptan Fiyatı (₺)</th>
                            <th style={{ minWidth: 115 }}>Toptan İnd. (₺)</th>
                            <th style={{ minWidth: 80 }}>Stok</th>
                            <th style={{ minWidth: 120 }}>SKU</th>
                            <th style={{ minWidth: 130 }}>Barkod</th>
                            <th style={{ minWidth: 90 }}>Ağırlık (kg)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combos.map((combo, ci) => {
                            const vd = variantData[combo] || {};
                            return (
                              <tr key={combo}>
                                <td><span style={{ fontWeight: 600, fontSize: 13 }}>{combo}</span></td>
                                <td><input className="form-control" type="number" style={{ width: 95 }} placeholder="0"
                                  value={vd.price || ''} onChange={e => updVar(combo, 'price', e.target.value)} /></td>
                                <td><input className="form-control" type="number" style={{ width: 105 }} placeholder="—"
                                  value={vd.disc || ''} onChange={e => updVar(combo, 'disc', e.target.value)} /></td>
                                <td><input className="form-control" type="number" style={{ width: 100 }} placeholder="—"
                                  value={vd.b2b_price || ''} onChange={e => updVar(combo, 'b2b_price', e.target.value)} /></td>
                                <td><input className="form-control" type="number" style={{ width: 110 }} placeholder="—"
                                  value={vd.b2b_disc || ''} onChange={e => updVar(combo, 'b2b_disc', e.target.value)} /></td>
                                <td><input className="form-control" type="number" style={{ width: 75 }} placeholder="0"
                                  value={vd.stock || ''} onChange={e => updVar(combo, 'stock', e.target.value)} /></td>
                                <td><input className="form-control" type="text" style={{ width: 115 }} placeholder={`SKU-${ci + 1}`}
                                  value={vd.sku || ''} onChange={e => updVar(combo, 'sku', e.target.value)} /></td>
                                <td><input className="form-control" type="text" style={{ width: 125 }} placeholder="8680000000000"
                                  value={vd.barcode || ''} onChange={e => updVar(combo, 'barcode', e.target.value)} /></td>
                                <td><input className="form-control" type="number" step="0.1" style={{ width: 85 }} placeholder="0.0"
                                  value={vd.weight || ''} onChange={e => updVar(combo, 'weight', e.target.value)} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Fiyatlandırma — varyantlı ürünlerde gizle */}
          {!hasVariants && (
            <div className="pd-card">
              <div className="pd-card-title">Fiyatlandırma</div>
              <div className="pd-card-body">
                <div className="price-row">
                  <div className="form-group">
                    <label className="form-label">Perakende Fiyatı (₺) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input className="form-control" type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Perakende İndirimli Fiyatı (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opsiyonel</span></label>
                    <input className="form-control" type="number" value={form.discounted_price} onChange={e => set('discounted_price', e.target.value)} placeholder="—" />
                    <div className="price-hint">Dolu ise perakende fiyatı üstü çizili gösterilir</div>
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
                {/* Toptan Fiyatlandırma */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 10 }}>Toptan Fiyatlandırma</div>
                  <div className="price-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Toptan Fiyatı (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opsiyonel</span></label>
                      <input className="form-control" type="number" value={b2bPrice} onChange={e => setB2bPrice(e.target.value)} placeholder="—" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Toptan İndirimli Fiyatı (₺) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opsiyonel</span></label>
                      <input className="form-control" type="number" value={b2bDiscounted} onChange={e => setB2bDiscounted(e.target.value)} placeholder="—" />
                    </div>
                  </div>
                </div>

                <KdvSection
                  vatRate={vatRate} vatIncluded={vatIncluded}
                  basePrice={parseFloat(form.discounted_price || form.price) || 0}
                  onRateChange={setVatRate}
                  onIncludedChange={setVatIncluded}
                />
              </div>
            </div>
          )}

          {/* KDV — varyantlı ürünlerde ayrı kart */}
          {hasVariants && (
            <div className="pd-card">
              <div className="pd-card-title">KDV</div>
              <div className="pd-card-body">
                <KdvSection
                  vatRate={vatRate} vatIncluded={vatIncluded}
                  basePrice={0}
                  onRateChange={setVatRate}
                  onIncludedChange={setVatIncluded}
                />
              </div>
            </div>
          )}

          {/* Envanter — varyantlı ürünlerde gizle */}
          {!hasVariants && (
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
          )}

          {/* Kargo — varyantlı ürünlerde gizle */}
          {!hasVariants && (
            <div className="pd-card">
              <div className="pd-card-title">Kargo</div>
              <div className="pd-card-body">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ağırlık (kg)</label>
                  <input className="form-control" type="number" step="0.1" value={form.weight} onChange={e => set('weight', e.target.value)} style={{ maxWidth: 160 }} />
                </div>
              </div>
            </div>
          )}

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
            <div className="pd-card-body" style={{ padding: 0 }}>
              <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                Ürün kaydedildikten sonra satış kanallarına eklenebilir
              </div>
            </div>
          </div>

          {/* Organizasyon */}
          <div className="pd-card">
            <div className="pd-card-title">Organizasyon</div>
            <div className="pd-card-body">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                {categories.length > 0 && (
                  <div className="tag-list" style={{ marginBottom: 8 }}>
                    {categories.map(c => (
                      <span key={c} className="tag">
                        {c}
                        <button onClick={() => setCategories(prev => prev.filter(x => x !== c))}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <select
                  className="form-control"
                  value=""
                  onChange={e => {
                    const val = e.target.value;
                    if (val && !categories.includes(val))
                      setCategories(prev => [...prev, val]);
                  }}
                >
                  <option value="">Kategori ekle…</option>
                  {allCategories.filter(c => !categories.includes(c)).map(c => <option key={c}>{c}</option>)}
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
