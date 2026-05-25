import React from 'react';
import Layout from '../components/Layout';

const VIDEOS = [
  { title: 'Platform Başlangıç Rehberi', duration: '8:24', cat: 'Başlangıç' },
  { title: 'Trendyol Entegrasyonu Kurulumu', duration: '12:10', cat: 'Entegrasyon' },
  { title: 'Toplu Ürün Yükleme', duration: '6:45', cat: 'Ürünler' },
  { title: 'Shopify Bağlantısı ve Ürün Eşleştirme', duration: '15:30', cat: 'Shopify' },
  { title: 'Stok Yönetimi ve Uyarılar', duration: '9:12', cat: 'Envanter' },
  { title: 'Otomatik Fatura Akışı', duration: '11:08', cat: 'Otomasyon' },
];
export default function Training() {
  return (
    <Layout title="Eğitim Videoları">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {VIDEOS.map((v, i) => (
          <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', cursor: 'pointer' }}>
            <div style={{ height: 140, background: 'linear-gradient(135deg, var(--primary-light), var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>▶️</div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>{v.cat}</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{v.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>⏱ {v.duration}</div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
