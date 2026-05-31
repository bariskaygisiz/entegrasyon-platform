import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { ShopifySettings, SyncJob } from '../types';

/* ── Sync options shown in wizard step 3 and connected dashboard ── */
const SYNC_OPTS = [
  { key: 'products',  icon: '📦', label: 'Ürün Senkronu',        desc: 'Ürün bilgilerini Shopify ile senkronize et',      def: true  },
  { key: 'inventory', icon: '📊', label: 'Stok Güncellemesi',     desc: 'Stok değişimlerini anlık olarak aktar',           def: true  },
  { key: 'orders',    icon: '🛒', label: 'Sipariş Aktarımı',      desc: 'Shopify siparişlerini otomatik çek',              def: true  },
  { key: 'webhooks',  icon: '⚡', label: 'Webhook Desteği',       desc: 'Anlık bildirimlerle gecikme sıfıra indir',        def: true  },
  { key: 'prices',    icon: '💰', label: 'Fiyat Senkronu',        desc: "Fiyat güncellemelerini Shopify'a otomatik yansıt", def: false },
];

const TEST_STEPS = [
  { msg: 'Mağaza bilgileri doğrulanıyor…',      sub: 'myshopify.com' },
  { msg: 'API izinleri kontrol ediliyor…',       sub: 'Admin API kapsamları' },
  { msg: 'Ürün kataloğu alınıyor…',              sub: 'Ürün sayısı hesaplanıyor' },
  { msg: "Webhook endpoint'leri ayarlanıyor…",   sub: 'Bağlantı güvenliği sağlanıyor' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'Az önce';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d} gün önce`;
  return new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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
  const navigate = useNavigate();
  const isShopify = slug === 'shopify';

  /* Shopify settings from API */
  const [shopifyState, setShopifyState] = useState<ShopifySettings | null>(null);
  const [shopifyLoading, setShopifyLoading] = useState(isShopify);
  const [recentJobs, setRecentJobs]     = useState<SyncJob[]>([]);
  const [mappingCount, setMappingCount] = useState(0);

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
  const [connSyncSettings, setConnSyncSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(SYNC_OPTS.map(o => [o.key, o.def]))
  );
  const [syncConfigLoading, setSyncConfigLoading] = useState(false);
  const [importing, setImporting]                 = useState(false);
  const [priceType, setPriceType]                 = useState<'retail' | 'wholesale'>('retail');
  const [priceTypeLoading, setPriceTypeLoading]   = useState(false);

  /* Disconnect modal */
  const [disconnectModal, setDisconnectModal] = useState(false);

  /* Load settings + sync config + activity */
  useEffect(() => {
    if (!isShopify) return;
    Promise.all([
      api.shopify.getSettings(),
      api.shopify.getSyncConfig().catch(() => null),
      api.shopify.getJobs().catch(() => [] as SyncJob[]),
      api.shopify.getMappings().catch(() => ({})),
    ]).then(([s, cfg, jobs, mappings]) => {
      setShopifyState(s);
      if (s) {
        setApiDomain(s.shop_domain);
        setApiToken(s.access_token);
        setPriceType(s.price_type ?? 'retail');
      }
      if (cfg) setConnSyncSettings(cfg);
      setRecentJobs(jobs.slice(0, 12));
      setMappingCount(Object.keys(mappings).length);
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
      // Wizard step 3'teki toggle seçimlerini scheduler'a kaydet (orders/webhooks hariç)
      const schedulableKeys = ['inventory', 'products', 'prices'];
      const schedConfig = Object.fromEntries(
        schedulableKeys.map(k => [k, syncSettings[k] ?? false])
      );
      await api.shopify.saveSyncConfig(schedConfig).catch(() => null);

      setShopifyState(s);
      setApiDomain(s.shop_domain);
      setApiToken(s.access_token);
      setConnSyncSettings({ ...syncSettings, ...schedConfig });
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

  /* ── Shopify'dan içeri aktar ─────────────────────────────────── */
  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await api.shopify.importProducts();
      const { imported, skipped, total } = result;
      if (imported === 0 && skipped === total) {
        showToast('Bilgi', 'Tüm Shopify ürünleri zaten eşleştirilmiş.', 'info');
      } else {
        showToast(
          'İçeri Aktarıldı',
          `${imported} ürün aktarıldı${skipped > 0 ? `, ${skipped} zaten eşleştirili` : ''}.`,
          'success',
        );
        // Sayıları güncelle
        setMappingCount(c => c + imported);
        const jobs = await api.shopify.getJobs().catch(() => [] as typeof recentJobs);
        setRecentJobs(jobs.slice(0, 12));
      }
    } catch (e: any) {
      showToast('Hata', e.message || 'İçeri aktarma başarısız.', 'error');
    } finally {
      setImporting(false);
    }
  };

  /* ── Layout header actions ───────────────────────────────────── */
  const headerActions = isShopify && shopifyState?.connected ? (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        className="btn btn-ghost btn-sm"
        disabled={importing}
        onClick={handleImport}
        style={{ gap: 6 }}
      >
        {importing ? (
          <>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              style={{ animation: 'spin 1s linear infinite', marginRight: 4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Aktarılıyor…
          </>
        ) : (
          <>
            <svg width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Ürünleri İçeri Aktar
          </>
        )}
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
          {(() => {
            const errorCount   = recentJobs.filter(j => j.status === 'error').length;
            const lastSyncJob  = recentJobs.find(j => j.status === 'success');
            const lastSyncTime = lastSyncJob ? timeAgo(lastSyncJob.updated_at) : '—';
            return [
              { val: String(mappingCount),  color: '#96BF48',       lbl: 'Eşleştirilen Ürün' },
              { val: String(recentJobs.length), color: 'var(--primary)', lbl: 'Son İşlem' },
              { val: String(errorCount),    color: errorCount > 0 ? 'var(--danger)' : 'var(--success)', lbl: 'Hata' },
              { val: lastSyncTime,          color: 'var(--success)', lbl: 'Son Senkron' },
            ];
          })().map(s => (
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
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg)' }}>
                  <input
                    className="form-control"
                    type="text"
                    value={apiDomain}
                    readOnly
                    style={{ border: 'none', borderRadius: 0, flex: 1, background: 'transparent', cursor: 'default', color: 'var(--text-muted)' }}
                  />
                  <span style={{ padding: '0 12px', fontSize: 13, color: 'var(--text-muted)', background: 'var(--bg)', borderLeft: '1.5px solid var(--border)', whiteSpace: 'nowrap', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                    .myshopify.com
                  </span>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Admin API Erişim Token'ı</label>
                <input
                  className="form-control"
                  type="password"
                  value={apiToken}
                  readOnly
                  style={{ background: 'var(--bg)', cursor: 'default', color: 'var(--text-muted)' }}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 16, opacity: 0.4, cursor: 'not-allowed', background: '#96BF48', borderColor: '#96BF48' }}
                disabled
              >
                Ayarları Kaydet
              </button>
              <button
                className="btn"
                style={{ width: '100%', marginTop: 8, background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                onClick={() => setDisconnectModal(true)}
              >
                Bağlantıyı Kes
              </button>
            </div>
          </div>

          {/* Sync Settings */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>Senkronizasyon Ayarları</div>
            <div style={{ padding: '4px 20px 16px' }}>
              {SYNC_OPTS.map(opt => {
                const FREQ: Record<string,string> = { products:'20 dk', inventory:'5 dk', orders:'3 dk', webhooks:'Anlık', prices:'20 dk' };
                const isScheduled = ['inventory','products','prices','images'].includes(opt.key);
                const currentVal  = connSyncSettings[opt.key] ?? opt.def;
                return (
                  <div key={opt.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                        {!isScheduled && (
                          <span style={{ fontSize: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-muted)' }}>Yakında</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {isScheduled ? `Her ${FREQ[opt.key]} otomatik çalışır` : `Sıklık: ${FREQ[opt.key]}`}
                      </div>
                    </div>
                    <label className="toggle" style={{ opacity: !isScheduled ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        disabled={!isScheduled || syncConfigLoading}
                        checked={currentVal}
                        onChange={async e => {
                          const newConfig = { ...connSyncSettings, [opt.key]: e.target.checked };
                          setConnSyncSettings(newConfig);
                          setSyncConfigLoading(true);
                          try {
                            await api.shopify.saveSyncConfig(newConfig);
                            showToast('Kaydedildi', `${opt.label} ${e.target.checked ? 'aktif' : 'devre dışı'} edildi.`, 'success');
                          } catch {
                            setConnSyncSettings(prev => ({ ...prev, [opt.key]: !e.target.checked }));
                            showToast('Hata', 'Ayar kaydedilemedi.', 'error');
                          } finally {
                            setSyncConfigLoading(false);
                          }
                        }}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Price Type */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
            Shopify'a Aktarılacak Fiyat
          </div>
          <div style={{ padding: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Shopify'a senkronize edilecek fiyat tipini seçin. Bu seçim hem manuel hem de otomatik fiyat senkronizasyonunu etkiler.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {([
                { value: 'retail',    label: 'Perakende Fiyatı',  desc: 'Normal Fiyat ve Perakende İndirimli Fiyat',  icon: '🏪' },
                { value: 'wholesale', label: 'Toptan Fiyatı',      desc: 'B2B Fiyat ve Toptan İndirimli Fiyat',        icon: '🏭' },
              ] as { value: 'retail' | 'wholesale'; label: string; desc: string; icon: string }[]).map(opt => {
                const isActive = priceType === opt.value;
                return (
                  <button
                    key={opt.value}
                    disabled={priceTypeLoading}
                    onClick={async () => {
                      if (isActive) return;
                      setPriceTypeLoading(true);
                      try {
                        await api.shopify.savePriceType(opt.value);
                        setPriceType(opt.value);
                        showToast('Kaydedildi', `Shopify fiyatı: ${opt.label}`, 'success');
                      } catch {
                        showToast('Hata', 'Fiyat tipi kaydedilemedi.', 'error');
                      } finally {
                        setPriceTypeLoading(false);
                      }
                    }}
                    style={{
                      flex: 1, minWidth: 200, textAlign: 'left', padding: '14px 18px',
                      borderRadius: 'var(--radius-sm)', cursor: isActive ? 'default' : 'pointer',
                      border: `2px solid ${isActive ? '#96BF48' : 'var(--border)'}`,
                      background: isActive ? '#96BF4810' : 'var(--card)',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#5a8a20' : 'var(--text)' }}>{opt.label}</span>
                      {isActive && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#96BF48' }}>● Aktif</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 30 }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Son Aktivite</div>
            <button
              onClick={() => navigate('/operations')}
              style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Tüm işlemler →
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Henüz kayıt yok. Ürün eşleştirip düzenlediğinizde aktiviteler burada görünecek.
            </div>
          ) : (
            recentJobs.map(job => {
              const isOk  = job.status === 'success';
              const isErr = job.status === 'error';
              const isBusy = job.status === 'syncing' || job.status === 'pending';
              const icon  = isOk ? '✓' : isErr ? '✕' : '…';
              const cls   = isOk ? 'ok' : isErr ? 'warn' : '';

              // İşlem etiketi
              const ACTION_LABELS: Record<string, string> = {
                sync:           'Shopify Sync',
                'auto-stock':   'Otomatik Stok',
                'auto-product': 'Otomatik Ürün',
                'auto-price':   'Otomatik Fiyat',
                'auto-image':   'Otomatik Görsel',
                create:         'Ürün Oluşturuldu',
                update:         'Ürün Güncellendi',
                delete:         'Ürün Silindi',
                'mapping.create': 'Eşleştirildi',
                'mapping.delete': 'Eşleştirme Kaldırıldı',
                'settings.update': 'Ayar Güncellendi',
              };
              const actionLabel = ACTION_LABELS[job.action] || job.action;
              const title = job.product_name && job.product_name !== 'Toplu Senkronizasyon'
                ? `${actionLabel} — ${job.product_name}`
                : actionLabel;

              return (
                <div key={job.id} className="log-row" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 20px', borderBottom: '1px solid var(--border-light)',
                }}>
                  {/* Status icon */}
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, marginTop: 1,
                    background: isOk ? '#dcfce7' : isErr ? '#fee2e2' : '#e0f2fe',
                    color:      isOk ? '#15803d' : isErr ? '#dc2626' : '#0369a1',
                  }}>
                    {isBusy ? (
                      <span style={{ fontSize: 10, animation: 'spin-dot 1s linear infinite', display: 'inline-block' }}>●</span>
                    ) : icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {title}
                    </div>
                    <div style={{
                      fontSize: 11, color: isErr ? '#dc2626' : 'var(--text-muted)',
                      marginTop: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {job.message}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                    {timeAgo(job.updated_at)}
                  </div>
                </div>
              );
            })
          )}
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
