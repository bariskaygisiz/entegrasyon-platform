import React, { useState } from 'react';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';

export default function Settings() {
  const { showToast } = useToast();
  const [storeName, setStoreName] = useState('Teknoloji A.Ş.');
  const [email, setEmail] = useState('info@teknoloji.com');
  const [currency, setCurrency] = useState('TRY');

  return (
    <Layout title="Ayarlar">
      <div style={{ maxWidth: 640 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Mağaza Bilgileri</h3>
          <div className="form-group"><label className="form-label">Mağaza Adı</label>
            <input className="form-control" value={storeName} onChange={e => setStoreName(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">E-posta</label>
            <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Para Birimi</label>
            <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="TRY">₺ Türk Lirası</option>
              <option value="USD">$ Amerikan Doları</option>
              <option value="EUR">€ Euro</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => showToast('Kaydedildi', 'Ayarlar güncellendi.', 'success')}>Kaydet</button>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--danger)' }}>Tehlikeli Alan</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Bu işlemler geri alınamaz.</p>
          <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
            onClick={() => showToast('İptal', 'Bu işlem şu an devre dışı.', 'warning')}>
            Hesabı Sil
          </button>
        </div>
      </div>
    </Layout>
  );
}
