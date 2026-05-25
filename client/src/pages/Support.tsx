import React from 'react';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';

export default function Support() {
  const { showToast } = useToast();
  return (
    <Layout title="Destek">
      <div style={{ maxWidth: 640 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Destek Talebi Oluştur</h3>
          <div className="form-group"><label className="form-label">Konu</label>
            <input className="form-control" placeholder="Sorunuzu kısaca özetleyin" /></div>
          <div className="form-group"><label className="form-label">Açıklama</label>
            <textarea className="form-control" rows={5} placeholder="Detayları buraya yazın…" /></div>
          <button className="btn btn-primary btn-sm" onClick={() => showToast('Gönderildi', 'Destek talebiniz alındı.', 'success')}>Gönder</button>
        </div>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>Hızlı Bağlantılar</h3>
          {['Başlangıç Rehberi', 'API Dokümantasyonu', 'Video Eğitimler', 'SSS'].map(link => (
            <div key={link} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13, cursor: 'pointer', color: 'var(--primary)' }}>→ {link}</div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
