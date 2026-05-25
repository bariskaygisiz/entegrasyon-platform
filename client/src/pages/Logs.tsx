import React from 'react';
import Layout from '../components/Layout';

const LOG_TYPES = ['success','success','success','error','warning','success','success','info','success','error'];
const LOG_MSGS = [
  'Trendyol sipariş #45231 senkronize edildi','Hepsiburada stok güncellendi — 48 ürün',
  'Shopify ürün eşleştirmesi tamamlandı','Aras Kargo API timeout hatası',
  'Trendyol fiyat güncellemesi gecikiyor','N11 listesi başarıyla aktarıldı',
  'Paraşüt fatura oluşturuldu — #INV-2891','Shopify webhook alındı: order/created',
  'İkas ürün senkronizasyonu tamamlandı','Hepsiburada bağlantı hatası: 503',
];
const LOG_TIMES = ['2 dk önce','5 dk önce','12 dk önce','18 dk önce','34 dk önce','1 sa önce','2 sa önce','3 sa önce','5 sa önce','8 sa önce'];

export default function Logs() {
  return (
    <Layout title="İşlem Kayıtları">
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {LOG_MSGS.map((msg, i) => {
          const type = LOG_TYPES[i];
          const color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'var(--primary)';
          const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1, fontSize: 13 }}>{msg}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{LOG_TIMES[i]}</div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
