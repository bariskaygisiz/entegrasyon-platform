import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { ShopifySettings } from '../types';

const INTEGRATION_META: Record<string, { name: string; domain: string; color: string; desc: string }> = {
  shopify:      { name: 'Shopify',     domain: 'shopify.com',     color: '#96BF48', desc: 'Shopify mağazanızla ürün ve sipariş senkronizasyonu.' },
  trendyol:     { name: 'Trendyol',    domain: 'trendyol.com',    color: '#F27A1A', desc: 'Trendyol pazaryeri entegrasyonu.' },
  hepsiburada:  { name: 'Hepsiburada', domain: 'hepsiburada.com', color: '#FF6000', desc: 'Hepsiburada entegrasyonu.' },
  ikas:         { name: 'İkas',        domain: 'ikas.com',        color: '#4F46E5', desc: 'İkas e-ticaret entegrasyonu.' },
  ticimax:      { name: 'Ticimax',     domain: 'ticimax.com',     color: '#0EA5E9', desc: 'Ticimax altyapı entegrasyonu.' },
  amazon:       { name: 'Amazon',      domain: 'amazon.com.tr',   color: '#FF9900', desc: 'Amazon Türkiye entegrasyonu.' },
};

const syncData = [0, 0, 0, 12, 34, 56, 89, 112, 134].map((v, i) => ({ name: `G${i + 1}`, value: v }));

export default function IntegrationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const meta = INTEGRATION_META[slug || ''] || { name: slug || '', domain: '', color: 'var(--primary)', desc: '' };

  const isShopify = slug === 'shopify';
  const [shopifyState, setShopifyState] = useState<ShopifySettings | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(isShopify);
  const [setupModal, setSetupModal] = useState(false);
  const [formDomain, setFormDomain] = useState('');
  const [formToken, setFormToken]  = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isShopify) return;
    api.shopify.getSettings().then(s => {
      setShopifyState(s);
      if (s) { setFormDomain(s.shop_domain); setFormToken(s.access_token); }
    }).finally(() => setShopifyLoading(false));
  }, [isShopify]);

  const mappedCount = 0; // TODO: count from mappings

  const handleShopifyActivate = async () => {
    if (!formDomain || !formToken) { showToast('Hata', 'Domain ve token zorunlu.', 'error'); return; }
    setSaving(true);
    try {
      const domain = formDomain.replace('.myshopify.com', '').replace(/^https?:\/\//, '');
      const s = await api.shopify.saveSettings({
        shop_domain: domain, access_token: formToken, connected: true,
        plan: 'Basic', shop_name: domain,
      });
      setShopifyState(s);
      setSetupModal(false);
      showToast('Bağlandı', `${domain}.myshopify.com bağlantısı kuruldu.`, 'success');
    } catch (e) {
      showToast('Hata', 'Kayıt sırasında bir hata oluştu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    await api.shopify.deleteSettings();
    setShopifyState(null);
    showToast('Bağlantı Kesildi', 'Shopify bağlantısı kaldırıldı.', 'info');
  };

  return (
    <Layout title={meta.name}>
      <Link to="/integrations" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 16 }}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Entegrasyonlar
      </Link>

      {/* Header card */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <img src={`https://www.google.com/s2/favicons?domain=${meta.domain}&sz=64`} width={48} height={48} style={{ borderRadius: 10, border: '1px solid var(--border)' }} alt={meta.name} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{meta.name}</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{meta.desc}</p>
        </div>
        <div>
          {isShopify ? (
            shopifyState?.connected ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => setSetupModal(true)}>Ayarlar</button>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={handleDisconnect}>Bağlantıyı Kes</button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" style={{ background: meta.color, borderColor: meta.color }} onClick={() => setSetupModal(true)}>
                Bağlan
              </button>
            )
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Yapılandır</button>
          )}
        </div>
      </div>

      {isShopify && shopifyState?.connected && (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
            {[
              { lbl: 'Mağaza', val: shopifyState.shop_domain + '.myshopify.com' },
              { lbl: 'Plan', val: shopifyState.plan || 'Basic' },
              { lbl: 'Eşleştirilen Ürün', val: String(mappedCount) },
              { lbl: 'Son Senkronizasyon', val: '2 dk önce' },
            ].map(s => (
              <div key={s.lbl} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{s.lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Sync chart */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14 }}>Senkronizasyon Aktivitesi</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={syncData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/products" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Ürün Eşleştirme</Link>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
              onClick={() => showToast('Senkronizasyon', 'Shopify senkronize ediliyor…', 'info')}>
              Tümünü Senkronize Et
            </button>
          </div>
        </>
      )}

      {isShopify && !shopifyState?.connected && !shopifyLoading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛍</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Shopify henüz bağlı değil</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Shopify mağazanızı bağlamak için aşağıdaki butona tıklayın.</div>
          <button className="btn btn-primary" style={{ background: meta.color, borderColor: meta.color }} onClick={() => setSetupModal(true)}>
            Shopify'ı Bağla
          </button>
        </div>
      )}

      {/* Setup Modal */}
      <Modal
        open={setupModal}
        onClose={() => setSetupModal(false)}
        title={<span>🛍 Shopify Bağlantısı</span>}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setSetupModal(false)}>İptal</button>
            <button className="btn btn-primary" style={{ background: meta.color, borderColor: meta.color }}
              onClick={handleShopifyActivate} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Bağlan'}
            </button>
          </div>
        }
      >
        <div className="form-group">
          <label className="form-label">Shopify Mağaza Domaini</label>
          <input className="form-control" type="text" placeholder="magazaadi (veya magazaadi.myshopify.com)"
            value={formDomain} onChange={e => setFormDomain(e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Sadece mağaza adını girin (ör: my-store)</div>
        </div>
        <div className="form-group">
          <label className="form-label">Admin API Access Token</label>
          <input className="form-control" type="password" placeholder="shpat_xxxxxxxxxxxx"
            value={formToken} onChange={e => setFormToken(e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Shopify Admin → Uygulamalar → Özel uygulamalar</div>
        </div>
      </Modal>
    </Layout>
  );
}
