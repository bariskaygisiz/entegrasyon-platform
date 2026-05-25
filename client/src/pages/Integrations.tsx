import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const INTEGRATIONS = [
  { category: 'E-Arşiv / E-Fatura', emoji: '🧾', items: [
    { slug: 'hepsi-efatura', name: 'Hepsiburada Faturam', desc: 'Otomatik e-arşiv fatura', status: 'active' },
    { slug: 'trendyol-efatura', name: 'Trendyol E-Faturam', desc: 'Trendyol sipariş faturaları', status: 'error' },
  ]},
  { category: 'Ön Muhasebe', emoji: '📊', items: [
    { slug: 'parasut', name: 'Paraşüt', desc: 'Muhasebe entegrasyonu', status: 'inactive' },
    { slug: 'kolaybi', name: 'KolayBi', desc: 'Kolay muhasebe', status: 'inactive' },
  ]},
  { category: 'Pazaryeri', emoji: '🛒', items: [
    { slug: 'trendyol', name: 'Trendyol', desc: 'Sipariş ve ürün senkronizasyonu', status: 'active' },
    { slug: 'hepsiburada', name: 'Hepsiburada', desc: 'Ürün listesi ve stok yönetimi', status: 'active' },
    { slug: 'amazon', name: 'Amazon', desc: 'Amazon Türkiye entegrasyonu', status: 'inactive' },
  ]},
  { category: 'E-Ticaret', emoji: '🏪', items: [
    { slug: 'ikas', name: 'İkas', desc: 'Online mağaza senkronizasyonu', status: 'active' },
    { slug: 'shopify', name: 'Shopify', desc: 'Shopify mağaza entegrasyonu', status: 'active' },
    { slug: 'ticimax', name: 'Ticimax', desc: 'Ticimax e-ticaret', status: 'inactive' },
    { slug: 'ideasoft', name: 'İdeasoft', desc: 'İdeasoft altyapısı', status: 'inactive' },
  ]},
  { category: 'Kargo', emoji: '📦', items: [
    { slug: 'aras-kargo', name: 'Aras Kargo', desc: 'Kargo entegrasyonu', status: 'active' },
    { slug: 'yurtici-kargo', name: 'Yurtiçi Kargo', desc: 'Kargo ve takip', status: 'inactive' },
    { slug: 'dhl', name: 'DHL Türkiye', desc: 'Uluslararası kargo', status: 'inactive' },
  ]},
];

const statusMeta: Record<string, { label: string; cls: string }> = {
  active:   { label: 'Aktif',      cls: 'badge-success' },
  inactive: { label: 'Kurulmamış', cls: 'badge-gray' },
  error:    { label: 'Hata',       cls: 'badge-danger' },
};

export default function Integrations() {
  const navigate = useNavigate();
  return (
    <Layout title="Entegrasyonlar">
      {INTEGRATIONS.map(group => (
        <div key={group.category} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>{group.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{group.category}</span>
          </div>
          <div className="int-grid">
            {group.items.map(item => {
              const st = statusMeta[item.status];
              return (
                <div key={item.slug} className="int-card" style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/integrations/${item.slug}`)}>
                  <div className="int-card-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={`https://www.google.com/s2/favicons?domain=${item.slug.replace('-efatura','').replace('-kargo','') + '.com'}&sz=32`}
                        width={22} height={22} style={{ borderRadius: 4 }} alt="" />
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                    </div>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="int-card-body">
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <div className="int-card-foot">
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                      {item.status === 'active' ? 'Yönet' : 'Kur'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Layout>
  );
}
