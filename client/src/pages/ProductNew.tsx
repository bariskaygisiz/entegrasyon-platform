import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';

export default function ProductNew() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', price: '', cost: '', sku: '', barcode: '',
    stock: '', weight: '', status: 'draft', category: '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Hata', 'Ürün adı zorunlu.', 'error'); return; }
    setSaving(true);
    try {
      const p = await api.products.create({
        name: form.name, description: form.description,
        price: parseFloat(form.price) || 0,
        cost:  parseFloat(form.cost)  || 0,
        sku:   form.sku, barcode: form.barcode,
        stock: parseInt(form.stock)   || 0,
        weight: parseFloat(form.weight) || 0,
        status: form.status as 'active' | 'draft' | 'archived',
        category: form.category, channels: [], tags: [],
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
      title="Yeni Ürün"
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/products')}>Vazgeç</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      }
    >
      <div style={{ maxWidth: 760, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div>
          <div className="pd-card">
            <div className="pd-card-title">Ürün Bilgisi</div>
            <div className="pd-card-body">
              <div className="form-group">
                <label className="form-label">Ürün Adı *</label>
                <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ürün adını girin" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Açıklama</label>
                <textarea className="form-control" rows={6} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ürün açıklaması…" />
              </div>
            </div>
          </div>

          <div className="pd-card">
            <div className="pd-card-title">Fiyatlandırma</div>
            <div className="pd-card-body">
              <div className="price-row">
                <div className="form-group">
                  <label className="form-label">Satış Fiyatı (₺)</label>
                  <input className="form-control" type="number" value={form.price} onChange={e => set('price', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Maliyet (₺)</label>
                  <input className="form-control" type="number" value={form.cost} onChange={e => set('cost', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="pd-card">
            <div className="pd-card-title">Envanter</div>
            <div className="pd-card-body">
              <div className="price-row">
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input className="form-control" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="Stok kodu" />
                </div>
                <div className="form-group">
                  <label className="form-label">Barkod</label>
                  <input className="form-control" value={form.barcode} onChange={e => set('barcode', e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Stok Miktarı</label>
                <input className="form-control" type="number" value={form.stock} onChange={e => set('stock', e.target.value)} style={{ maxWidth: 160 }} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="pd-card">
            <div className="pd-card-title">Ürün Durumu</div>
            <div className="pd-card-body">
              <select className="status-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Aktif</option>
                <option value="draft">Taslak</option>
                <option value="archived">Arşiv</option>
              </select>
            </div>
          </div>
          <div className="pd-card">
            <div className="pd-card-title">Kategori</div>
            <div className="pd-card-body">
              <input className="form-control" value={form.category} onChange={e => set('category', e.target.value)} placeholder="Telefon, Bilgisayar…" />
            </div>
          </div>
          <div className="pd-card">
            <div className="pd-card-title">Kargo</div>
            <div className="pd-card-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ağırlık (kg)</label>
                <input className="form-control" type="number" step="0.1" value={form.weight} onChange={e => set('weight', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
