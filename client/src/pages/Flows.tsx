import React from 'react';
import Layout from '../components/Layout';
export default function Flows() {
  return (
    <Layout title="Akış Kuralları" actions={<button className="btn btn-primary btn-sm">Kural Ekle</button>}>
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚙️</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Otomasyon Kuralları</div>
        <p style={{ fontSize: 13 }}>Sipariş geldiğinde otomatik kargo, fatura ve stok güncelleme kuralları oluşturun.</p>
        <button className="btn btn-primary" style={{ marginTop: 16 }}>İlk Kuralı Oluştur</button>
      </div>
    </Layout>
  );
}
