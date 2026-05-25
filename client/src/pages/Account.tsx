import React from 'react';
import Layout from '../components/Layout';
import { useToast } from '../context/ToastContext';

export default function Account() {
  const { showToast } = useToast();
  return (
    <Layout title="Hesabım">
      <div style={{ maxWidth: 640 }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 700 }}>TA</div>
            <div><div style={{ fontWeight: 800, fontSize: 18 }}>Teknoloji A.Ş.</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pro Plan · 6 aktif entegrasyon</div></div>
          </div>
          {[
            ['Ad Soyad / Şirket', 'Teknoloji A.Ş.'],
            ['E-posta', 'admin@teknoloji.com'],
            ['Telefon', '0212 555 00 00'],
            ['Adres', 'İstanbul, Türkiye'],
          ].map(([lbl, val]) => (
            <div key={lbl} className="form-group">
              <label className="form-label">{lbl}</label>
              <input className="form-control" defaultValue={val} />
            </div>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() => showToast('Kaydedildi', 'Hesap bilgileri güncellendi.', 'success')}>Kaydet</button>
        </div>
      </div>
    </Layout>
  );
}
