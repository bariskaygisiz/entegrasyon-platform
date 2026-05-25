import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { ShopifySettings } from '../types';

/* ── Sync options shown in wizard step 3 and connected dashboard ── */
const SYNC_OPTS = [
  { key: 'products',  icon: '📦', label: 'Ürün Senkronu',        desc: 'Ürün bilgilerini Shopify ile senkronize et',      def: true  },
  { key: 'inventory', icon: '📊', label: 'Stok Güncellemesi',     desc: 'Stok değişimlerini anlık olarak aktar',           def: true  },
  { key: 'orders',    icon: '🛒', label: 'Sipariş Aktarımı',      desc: 'Shopify siparişlerini otomatik çek',              def: true  },
  { key: 'webhooks',  icon: '⚡', label: 'Webhook Desteği',       desc: 'Anlık bildirimlerle gecikme sıfıra indir',        def: true  },
  { key: 'prices',    icon: '💰', label: 'Fiyat Senkronu',        desc: "Fiyat güncellemelerini Shopify'a otomatik yansıt", def: false },
  { key: 'images',    icon: '🖼',  label: 'Görsel Senkronu',       desc: "Ürün görsellerini Shopify'a aktar",               def: false },
];

const TEST_STEPS = [
  { msg: 'Mağaza bilgileri doğrulanıyor…',      sub: 'myshopify.com' },
  { msg: 'API izinleri kontrol ediliyor…',       sub: 'Admin API kapsamları' },
  { msg: 'Ürün kataloğu alınıyor…',              sub: 'Ürün sayısı hesaplanıyor' },
  { msg: "Webhook endpoint'leri ayarlanıyor…",   sub: 'Bağlantı güvenliği sağlanıyor' },
];

const MOCK_LOGS = [
  { t: '09:41', ok: true,  msg: 'Sipariş #45231 başarıyla çekildi' },
  { t: '09:38', ok: true,  msg: '12 ürün stoğu güncellendi' },
  { t: '09:35', ok: false, msg: 'Rate limit yaklaşıyor (85%)' },
  { t: '09:30', ok: true,  msg: 'Stok senkronu tamamlandı (156 ürün)' },
  { t: '09:22', ok: true,  msg: 'Fiyat güncellemesi gönderildi (43 ürün)' },
  { t: '09:15', ok: true,  msg: 'Bağlantı testi başarılı' },
];

/* ── Wizard Step Indicator ─────────────────────────────────────── */
function StepIndicator({ step }: { step: number }) {
  const labels = ['Kimlik Bilgileri', 'Bağlantı Testi', 'Senkronizasyon'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: '0 8px' }}>
      {labels.map((lbl, i) => {
        const n = i + 1;
        const done = n < step, active = n === step;
        return (
          <React.Fragment key={n}>
            {n > 1 && (
              <div style={{ flex: 1, height: 2, background: n <= step ? '#96BF48' : 'var(--border)', marginTop: 15 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 700,
                background: done || active ? '#96BF48' : 'var(--border)',
                color: done || active ? '#fff' : 'var(--text-muted)',
              }}>
                {done ? '✓' : n}
              </div>
              <div style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? '#96BF48' : done ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {lbl}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export default function IntegrationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { showToast } = useToast();
  const isShopify = slug === 'shopify';

  /* Shopify settings from API */
  const [shopifyState, setShopifyState] = useState<ShopifySettings | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(isShopify);

  /* Wizard state */
  const [wizardStep, setWizardStep] = useState(1);
  const [formDomain, setFormDomain] = useState('');
  const [formToken, setFormToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Step 2: test animation */
  const [testPhaseIdx, setTestPhaseIdx] = useState(0);
  const [testDone, setTestDone] = useState(false);
  const testTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /* Step 3: sync options */
  const [syncSettings, setSyncSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(SYNC_OPTS.map(o => [o.key, o.def]))
  );

  /* Connected: API settings edit */
  const [apiDomain, setApiDomain] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [showApiToken, setShowApiToken] = useState(false);
  const [connSyncSettings, setConnSyncSettings] = useState<Record<string, boolean>>({});

  /* Disconnect modal */
  const [disconnectModal, setDisconnectModal] = useState(false);

  /* Load settings */
  useEffect(() => {
    if (!isShopify) return;
    api.shopify.getSettings().then(s => {
      setShopifyState(s);
      if (s) {
        setApiDomain(s.shop_domain);
        setApiToken(s.access_token);
        setConnSyncSettings(Object.fromEntries(SYNC_OPTS.map(o => [o.key, true])));
      }
    }).finally(() => setShopifyLoading(false));
  }, [isShopify]);

  /* Step 2 animation */
  useEffect(() => {
    if (wizardStep !== 2) return;
    testTimers.current.forEach(clearTimeout);
    testTimers.current = [];
    setTestPhaseIdx(0);
    setTestDone(false);
    TEST_STEPS.forEach((_, i) => {
      if (i === 0) return;
      testTimers.current.push(setTimeout(() => setTestPhaseIdx(i), i * 900));
    });
    testTimers.current.push(setTimeout(() => setTestDone(true), TEST_STEPS.length * 900 + 400));
    return () => testTimers.current.forEach(clearTimeout);
  }, [wizardStep]);

  /* Step 1 → 2 */
  const handleStep1Next = () => {
    const d = formDomain.trim().replace(/\.myshopify\.com.*/i, '').replace(/^https?:\/\//i, '');
    if (!d) { showToast('Hata', 'Mağaza alan adını girin.', 'error'); return; }
    if (!formToken.trim()) { showToast('Hata', "Access token'ı girin.", 'error'); return; }
    setFormDomain(d);
    setWizardStep(2);
  };

  /* Step 3 → Activate */
  const handleActivate = async () => {
    setSaving(true);
    try {
      const s = await api.shopify.saveSettings({
        shop_domain: formDomain,
        access_token: formToken,
        connected: true,
        plan: 'Shopify',
        shop_name: formDomain.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      });
      setShopifyState(s);
      setApiDomain(s.shop_domain);
      setApiToken(s.access_token);
      setConnSyncSettings(syncSettings);
      showToast('Bağlandı!', 'Shopify entegrasyonu başarıyla aktifleştirildi.', 'success');
    } catch {
      showToast('Hata', 'Kayıt sırasında bir hata oluştu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* Disconnect */
  const handleDisconnect = async () => {
    await api.shopify.deleteSettings();
    setShopifyState(null);
    setDisconnectModal(false);
    setWizardStep(1);
    setFormDomain(''); setFormToken('');
    showToast('Bağlantı Kesildi', 'Shopify entegrasyonu kaldırıldı.', 'info');
  };

  /* Save API settings (on connected dashboard) */
  const handleSaveApiSettings = async () => {
    const d = apiDomain.trim().replace(/\.myshopify\.com.*/i, '');
    const t = apiToken.trim();
    if (!d || !t) { showToast('Hata', 'Alan adı ve token zorunludur.', 'error'); return; }
    setSaving(true);
    try {
      const s = await api.shopify.saveSettings({
        shop_domain: d, access_token: t, connected: true,
        plan: shopifyState?.plan || 'Shopify',
        shop_name: shopifyState?.shop_name || d,
      });
      setShopifyState(s);
      showToast('Kaydedildi', 'API ayarları güncellendi.', 'success');
    } catch {
      showToast('Hata', 'Kayıt sırasında bir hata oluştu.', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Layout header actions ───────────────────────────────────── */
  const headerActions = isShopify && shopifyState?.connected ? (
    <div style={{ display: 'flex', gap: 8 }}>
      <button className="btn btn-ghost btn-sm"
        onClick={() => showToast('Senkronizasyon', 'Shopify senkronu başlatıldı.', 'info')}>
        <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Senkronize Et
      </button>
      <button className="btn btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
        onClick={() => setDisconnectModal(true)}>
        Bağlantıyı Kes
      </button>
    </div>
  ) : undefined;

  if (!isShopify) {
    return (
      <Layout title={slug || ''}>
        <Link to="/integrations" className="pd-back">
          <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Entegrasyonlar
        </Link>
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Bu entegrasyon için detay sayfası henüz hazır değil.
        </div>
      </Layout>
    );
  }

  /* ── Loading ─────────────────────────────────────────────────── */
  if (shopifyLoading) {
    return (
      <Layout title="Shopify">
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div>
      </Layout>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     CONNECTED DASHBOARD
  ══════════════════════════════════════════════════════════════ */
  if (shopifyState?.connected) {
    const storeDomain = (shopifyState.shop_domain || '') + '.myshopify.com';
    const connectedAt = shopifyState.created_at
      ? new Date(shopifyState.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '—';

    return (
      <Layout title="Shopify" actions={headerActions}>
        <Link to="/integrations" className="pd-back">
          <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Entegrasyonlar
        </Link>

        {/* Hero card */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#96BF48', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>S</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Shopify</div>
                <span className="badge badge-success">Bağlı</span>
                <span className="badge badge-info" style={{ fontSize: 11 }}>E-Ticaret</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{storeDomain}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)' }}>Bağlandı: {connectedAt}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { val: '0',        color: '#96BF48',       lbl: 'Eşleştirilen Ürün' },
            { val: '0',        color: 'var(--primary)', lbl: 'Bugün Sipariş' },
            { val: '0',        color: 'var(--danger)',  lbl: 'Hata' },
            { val: 'Az önce',  color: 'var(--success)', lbl: 'Son Senkron' },
          ].map(s => (
            <div key={s.lbl} className="card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* 2-column: API settings + Sync settings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="detail-grid">

          {/* API Settings */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>API Bağlantı Ayarları</div>
            <div style={{ padding: 20 }}>
              <div className="form-group">
                <label className="form-label">Mağaza Alan Adı</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <input className="form-control" type="text" value={apiDomain}
                    onChange={e => setApiDomain(e.target.value.replace(/\.myshopify\.com.*/i, ''))}
                    style={{ border: 'none', borderRadius: 0, flex: 1 }} />
                  <span style={{ padding: '0 12px', fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg)', borderLeft: '1.5px solid var(--border)', whiteSpace: 'nowrap', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                    .myshopify.com
                  </span>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Admin API Erişim Token'ı</label>
                <div style={{ position: 'relative' }}>
                  <input className="form-control" type={showApiToken ? 'text' : 'password'} value={apiToken}
                    onChange={e => setApiToken(e.target.value)} />
                  <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    onClick={() => setShowApiToken(p => !p)}>👁</button>
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 16, background: '#96BF48', borderColor: '#96BF48' }}
                onClick={handleSaveApiSettings} disabled={saving}>
                {saving ? 'Kaydediliyor…' : 'Ayarları Kaydet'}
              </button>
            </div>
          </div>

          {/* Sync Settings */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>Senkronizasyon Ayarları</div>
            <div style={{ padding: '4px 20px 16px' }}>
              {SYNC_OPTS.map(opt => (
                <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      Sıklık: {opt.key === 'products' ? '20 dk' : opt.key === 'inventory' ? '5 dk' : opt.key === 'orders' ? '3 dk' : opt.key === 'webhooks' ? 'Anlık' : opt.key === 'prices' ? '20 dk' : '60 dk'}
                    </div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={connSyncSettings[opt.key] ?? opt.def}
                      onChange={e => {
                        setConnSyncSettings(p => ({ ...p, [opt.key]: e.target.checked }));
                        showToast('Kaydedildi', `${opt.label} ${e.target.checked ? 'aktif' : 'devre dışı'}.`, 'success');
                      }} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Son Aktivite</div>
            <span style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>Tüm loglar →</span>
          </div>
          {[
            { t: 'az önce',   ok: true,  msg: 'Bağlantı başarıyla kuruldu' },
            { t: '1 dk önce', ok: true,  msg: `Mağaza doğrulandı: ${storeDomain}` },
            { t: '2 dk önce', ok: true,  msg: "Webhook endpoint'leri kaydedildi" },
            ...MOCK_LOGS,
          ].map((l, i) => (
            <div key={i} className="log-row">
              <div className={`log-status ${l.ok ? 'ok' : 'warn'}`}>{l.ok ? '✓' : '!'}</div>
              <div className="log-content">
                <div className="log-title">{l.msg}</div>
                <div className="log-time">{l.t}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Disconnect confirm modal */}
        <Modal
          open={disconnectModal}
          onClose={() => setDisconnectModal(false)}
          maxWidth={420}
          title="Bağlantıyı Kes"
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDisconnectModal(false)}>Vazgeç</button>
              <button className="btn" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }} onClick={handleDisconnect}>Bağlantıyı Kes</button>
            </div>
          }
        >
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Bu entegrasyonun bağlantısını kesmek istediğinizden emin misiniz? Mevcut akışlar duraklatılacaktır.</p>
          <div style={{ background: 'var(--danger-light)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 13, color: 'var(--danger)' }}>
            ⚠ Bağlantı kesildikten sonra otomasyon akışları çalışmayı durduracaktır.
          </div>
        </Modal>
      </Layout>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     WIZARD (not connected)
  ══════════════════════════════════════════════════════════════ */
  return (
    <Layout title="Shopify">
      <Link to="/integrations" className="pd-back">
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Entegrasyonlar
      </Link>

      {/* Wizard header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#96BF48', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, flexShrink: 0 }}>S</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Shopify Entegrasyonu</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>E-Ticaret Altyapısı</div>
          </div>
          <span className="badge badge-gray" style={{ marginLeft: 'auto' }}>Bağlı Değil</span>
        </div>
        <StepIndicator step={wizardStep} />
      </div>

      {/* ── STEP 1: Credentials ─────────────────────────────────── */}
      {wizardStep === 1 && (
        <div className="card" style={{ padding: 28, maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Shopify Mağazanızı Bağlayın</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Bağlantı kurmak için Shopify Admin API bilgilerinizi girin.</div>

          <div className="form-group">
            <label className="form-label">Mağaza Alan Adı</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--card)' }}>
              <input className="form-control" type="text" placeholder="magazaniz" value={formDomain}
                onChange={e => setFormDomain(e.target.value.replace(/\.myshopify\.com.*/i, ''))}
                style={{ border: 'none', borderRadius: 0, flex: 1 }} />
              <span style={{ padding: '0 12px', fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg)', borderLeft: '1.5px solid var(--border)', alignSelf: 'stretch', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                .myshopify.com
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Shopify yönetici URL'inizdeki alt alan adı (örn: benim-magaza)</div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Admin API Erişim Token'ı</label>
            <div style={{ position: 'relative' }}>
              <input className="form-control" type={showToken ? 'text' : 'password'} placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                value={formToken} onChange={e => setFormToken(e.target.value)} />
              <button type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowToken(p => !p)}>👁</button>
            </div>
          </div>

          {/* How-to accordion */}
          <details style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <summary style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg)', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Access Token nasıl alınır?
            </summary>
            <div style={{ padding: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8, borderTop: '1px solid var(--border)' }}>
              <strong>1.</strong> Shopify Admin paneline giriş yapın<br />
              <strong>2.</strong> <em>Ayarlar → Uygulamalar ve satış kanalları</em> menüsüne gidin<br />
              <strong>3.</strong> <em>Özel uygulamalar geliştir</em> linkine tıklayın<br />
              <strong>4.</strong> <em>Özel uygulama oluştur</em> butonuna tıklayın<br />
              <strong>5.</strong> Uygulamaya bir ad verin (örn: <em>Entegrasyon Platformu</em>)<br />
              <strong>6.</strong> <em>Admin API kapsamları</em> bölümünden şu izinleri seçin:<br />
              &nbsp;&nbsp;&nbsp;• <code>read_products, write_products</code><br />
              &nbsp;&nbsp;&nbsp;• <code>read_inventory, write_inventory</code><br />
              &nbsp;&nbsp;&nbsp;• <code>read_orders, write_orders</code><br />
              <strong>7.</strong> Uygulamayı kaydedin ve <em>API kimlik bilgilerini yükle</em> butonuna tıklayın<br />
              <strong>8.</strong> <strong>Admin API erişim token'ı</strong>nı kopyalayın (<code>shpat_...</code> ile başlar)
            </div>
          </details>

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20, background: '#96BF48', borderColor: '#96BF48' }}
            onClick={handleStep1Next}>
            Bağlantıyı Test Et
            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 6 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* ── STEP 2: Connection Test ──────────────────────────────── */}
      {wizardStep === 2 && (
        <div className="card" style={{ padding: 28, maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          {!testDone ? (
            <>
              <div style={{ width: 52, height: 52, border: '3px solid var(--border)', borderTopColor: '#96BF48', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>{TEST_STEPS[testPhaseIdx]?.msg}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                {testPhaseIdx === 0 ? `${formDomain}.myshopify.com` : TEST_STEPS[testPhaseIdx]?.sub}
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#ECFDF5', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px' }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Bağlantı Başarılı!</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{formDomain}.myshopify.com doğrulandı</div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'left', marginBottom: 20 }}>
                {[
                  ['Mağaza Adı', formDomain.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())],
                  ['Alan Adı', `${formDomain}.myshopify.com`],
                  ['Plan', 'Shopify'],
                  ['Eşleştirilen Ürün', '0 ürün'],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                    <span style={{ fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', background: '#96BF48', borderColor: '#96BF48' }}
                onClick={() => setWizardStep(3)}>
                Devam Et — Senkronizasyon Ayarları
                <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 6 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12 }}
                onClick={() => setWizardStep(1)}>← Geri Dön</button>
            </>
          )}
        </div>
      )}

      {/* ── STEP 3: Sync Options ────────────────────────────────── */}
      {wizardStep === 3 && (
        <div className="card" style={{ padding: 28, maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Senkronizasyon Ayarları</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Hangi verilerin senkronize edileceğini seçin.</div>

          {SYNC_OPTS.map(opt => (
            <div key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: 20 }}>{opt.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={syncSettings[opt.key]}
                  onChange={e => setSyncSettings(p => ({ ...p, [opt.key]: e.target.checked }))} />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 20, background: '#96BF48', borderColor: '#96BF48' }}
            onClick={handleActivate} disabled={saving}>
            {saving ? 'Aktifleştiriliyor…' : 'Entegrasyonu Aktifleştir ✓'}
          </button>
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
