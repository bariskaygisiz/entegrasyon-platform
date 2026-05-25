import React from 'react';
import Layout from '../components/Layout';

const CATS = [
  { name: 'Telefon', count: 40, emoji: '📱' }, { name: 'Bilgisayar', count: 28, emoji: '💻' },
  { name: 'Aksesuar', count: 35, emoji: '⌨️' }, { name: 'Ses Sistemleri', count: 12, emoji: '🎧' },
  { name: 'Televizyon', count: 8, emoji: '📺' }, { name: 'Monitör', count: 15, emoji: '🖥️' },
  { name: 'Tablet', count: 18, emoji: '📱' }, { name: 'Ev Elektroniği', count: 22, emoji: '🧹' },
  { name: 'Fotoğraf', count: 9, emoji: '📷' },
];
export default function Categories() {
  return (
    <Layout title="Kategoriler" actions={<button className="btn btn-primary btn-sm">Kategori Ekle</button>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {CATS.map(c => (
          <div key={c.name} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, cursor: 'pointer' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>{c.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.count} ürün</div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
