import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney } from '../lib/utils';
import type { CustomerWithOrders } from '../types';

// ── Kanal badge ───────────────────────────────────────────────────────────────
const CHANNEL_META: Record<string, { label: string; favicon?: string; color: string; bg: string }> = {
  shopify:  { label: 'Shopify',     favicon: 'shopify.com',     color: '#3a7d44', bg: '#dcfce7' },
  trendyol: { label: 'Trendyol',    favicon: 'trendyol.com',    color: '#c2410c', bg: '#ffedd5' },
  hepsi:    { label: 'Hepsiburada', favicon: 'hepsiburada.com', color: '#9a3412', bg: '#ffedd5' },
  n11:      { label: 'N11',         favicon: 'n11.com',         color: '#6b21a8', bg: '#f3e8ff' },
  ikas:     { label: 'İkas',        favicon: 'ikas.com',        color: '#3730a3', bg: '#e0e7ff' },
  site:     { label: 'Site',        color: '#1d4ed8', bg: '#dbeafe' },
};
function ChannelBadge({ channel }: { channel: string }) {
  const m = CHANNEL_META[channel] || { label: channel, color: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:m.bg, color:m.color }}>
      {m.favicon && <img src={`https://www.google.com/s2/favicons?domain=${m.favicon}&sz=16`} width={11} height={11} alt="" style={{ borderRadius:2 }} />}
      {m.label}
    </span>
  );
}

// ── Durum badge ───────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  approved:  { label: 'Onaylandı',       color: '#0369a1', bg: '#e0f2fe' },
  preparing: { label: 'Hazırlanıyor',    color: '#92400e', bg: '#fef3c7' },
  shipped:   { label: 'Kargoya Verildi', color: '#1d4ed8', bg: '#dbeafe' },
  delivered: { label: 'Teslim Edildi',   color: '#15803d', bg: '#dcfce7' },
  cancelled: { label: 'İptal Edildi',    color: '#dc2626', bg: '#fee2e2' },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['approved'];
  return <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:s.bg, color:s.color }}>{s.label}</span>;
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS: [string, string][] = [
  ['#fff','#6366f1'],['#fff','#0ea5e9'],['#fff','#10b981'],
  ['#fff','#f59e0b'],['#fff','#ef4444'],['#fff','#8b5cf6'],
  ['#fff','#ec4899'],['#fff','#14b8a6'],
];
function avatarColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const INPUT_STYLE: React.CSSProperties = {
  width:'100%', padding:'8px 12px', border:'1px solid var(--border)',
  borderRadius:8, fontSize:13, background:'var(--bg)', color:'var(--text)',
  outline:'none', boxSizing:'border-box', transition:'border-color .15s',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.4, marginBottom:5 }}>
      {children}
    </div>
  );
}

// ── Form state ────────────────────────────────────────────────────────────────
type ProfileState = {
  name: string; email: string; phone: string;
  city: string; district: string; address: string; notes: string;
  invoiceType: 'individual' | 'corporate';
  tcNo: string; taxNo: string; taxOffice: string;
};

export default function CustomerDetail() {
  const { key }   = useParams<{ key: string }>();
  const navigate  = useNavigate();
  const [customer, setCustomer] = useState<CustomerWithOrders | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [saveErr,  setSaveErr]  = useState('');
  const [form, setForm] = useState<ProfileState>({
    name:'', email:'', phone:'', city:'', district:'', address:'', notes:'',
    invoiceType:'individual', tcNo:'11111111111', taxNo:'', taxOffice:'',
  });

  const set = (field: keyof ProfileState, value: string) =>
    setForm(p => ({ ...p, [field]: value }));

  useEffect(() => {
    if (!key) return;
    api.customers.get(key)
      .then(c => {
        setCustomer(c);
        setForm({
          name:        c.name        || '',
          email:       c.email       || '',
          phone:       c.phone       || '',
          city:        c.city        || '',
          district:    c.district    || '',
          address:     c.address     || '',
          notes:       c.notes       || '',
          invoiceType: c.invoiceType || 'individual',
          // Varsayılan: bireysel + TC No = 11111111111
          tcNo:        c.tcNo        || '11111111111',
          taxNo:       c.taxNo       || '',
          taxOffice:   c.taxOffice   || '',
        });
      })
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false));
  }, [key]);

  const handleSave = async () => {
    if (!key || !customer) return;
    setSaving(true); setSaved(false); setSaveErr('');
    try {
      await api.customers.update(key, {
        name: form.name, email: form.email, phone: form.phone,
        city: form.city, district: form.district, address: form.address,
        notes: form.notes,
        invoiceType: form.invoiceType,
        tcNo: form.tcNo, taxNo: form.taxNo, taxOffice: form.taxOffice,
      } as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setSaveErr(e.message || 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Layout title="Müşteri Detayı"><div style={{ padding:60, textAlign:'center', color:'var(--text-muted)' }}>Yükleniyor…</div></Layout>;
  }
  if (!customer) {
    return (
      <Layout title="Müşteri Bulunamadı">
        <div style={{ padding:60, textAlign:'center', color:'var(--text-muted)' }}>
          <p>Müşteri bulunamadı.</p>
          <Link to="/customers" style={{ color:'var(--primary)' }}>← Müşterilere Dön</Link>
        </div>
      </Layout>
    );
  }

  const [fg, bg] = avatarColor(form.name || customer.name);
  const avgOrder = customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0;

  return (
    <Layout title={customer.name}>
      <style>{`
        .prof-input:focus { border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-light,#EEF2FF); }
        .invoice-radio { display:flex; gap:10px; }
        .invoice-radio label { display:flex; align-items:center; gap:8px; padding:9px 16px; border:2px solid var(--border); border-radius:10px; cursor:pointer; font-size:13px; font-weight:600; transition:all .15s; flex:1; justify-content:center; }
        .invoice-radio label.active { border-color:var(--primary); background:var(--primary-light,#EEF2FF); color:var(--primary); }
        .invoice-radio input[type=radio] { display:none; }
        @media (max-width:680px) { .detail-grid { grid-template-columns:1fr !important; } .info-grid { grid-template-columns:1fr !important; } }
      `}</style>

      {/* Geri */}
      <Link to="/customers" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'var(--text-muted)', textDecoration:'none', marginBottom:20 }}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Müşteriler
      </Link>

      {/* Başlık */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap' }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:bg, color:fg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:22, flexShrink:0 }}>
          {(form.name || customer.name || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:20, fontWeight:800, margin:'0 0 6px' }}>{form.name || customer.name}</h1>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {customer.channels.map(ch => <ChannelBadge key={ch} channel={ch} />)}
          </div>
        </div>
      </div>

      <div className="detail-grid" style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20, alignItems:'start' }}>

        {/* SOL: Bilgi kartları */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Müşteri Bilgileri */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-light)', fontWeight:700, fontSize:13 }}>
              Müşteri Bilgileri
            </div>
            <div className="info-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, padding:16 }}>

              {/* Ad Soyad — full width */}
              <div style={{ gridColumn:'1 / -1' }}>
                <FieldLabel>Adı Soyadı</FieldLabel>
                <input className="prof-input" style={INPUT_STYLE} value={form.name}
                  onChange={e => set('name', e.target.value)} placeholder="Ad Soyad" />
              </div>

              <div>
                <FieldLabel>E-posta Adresi</FieldLabel>
                <input className="prof-input" style={INPUT_STYLE} value={form.email}
                  onChange={e => set('email', e.target.value)} placeholder="ornek@mail.com" type="email" />
              </div>

              <div>
                <FieldLabel>Telefon</FieldLabel>
                <input className="prof-input" style={INPUT_STYLE} value={form.phone}
                  onChange={e => set('phone', e.target.value)} placeholder="05xx xxx xx xx" />
              </div>

              <div>
                <FieldLabel>İl</FieldLabel>
                <input className="prof-input" style={INPUT_STYLE} value={form.city}
                  onChange={e => set('city', e.target.value)} placeholder="İstanbul" />
              </div>

              <div>
                <FieldLabel>İlçe</FieldLabel>
                <input className="prof-input" style={INPUT_STYLE} value={form.district}
                  onChange={e => set('district', e.target.value)} placeholder="Kadıköy" />
              </div>

              {/* Adres — full width */}
              <div style={{ gridColumn:'1 / -1' }}>
                <FieldLabel>Adres</FieldLabel>
                <textarea className="prof-input" style={{ ...INPUT_STYLE, resize:'vertical', minHeight:64 }}
                  value={form.address} onChange={e => set('address', e.target.value)}
                  placeholder="Açık adres" />
              </div>

              {/* Notlar — full width */}
              <div style={{ gridColumn:'1 / -1' }}>
                <FieldLabel>Notlar</FieldLabel>
                <textarea className="prof-input" style={{ ...INPUT_STYLE, resize:'vertical', minHeight:48 }}
                  value={form.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="Müşteriye özel notlar…" />
              </div>

            </div>
          </div>

          {/* Fatura Bilgileri */}
          <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border-light)', fontWeight:700, fontSize:13 }}>
              Fatura Bilgileri
            </div>
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>

              {/* Fatura türü */}
              <div>
                <FieldLabel>Fatura Türü</FieldLabel>
                <div className="invoice-radio">
                  <label className={form.invoiceType === 'individual' ? 'active' : ''}>
                    <input type="radio" value="individual" checked={form.invoiceType === 'individual'}
                      onChange={() => setForm(p => ({ ...p, invoiceType: 'individual' }))} />
                    <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Bireysel
                  </label>
                  <label className={form.invoiceType === 'corporate' ? 'active' : ''}>
                    <input type="radio" value="corporate" checked={form.invoiceType === 'corporate'}
                      onChange={() => setForm(p => ({ ...p, invoiceType: 'corporate' }))} />
                    <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Kurumsal
                  </label>
                </div>
              </div>

              {/* Bireysel → TC No */}
              {form.invoiceType === 'individual' && (
                <div>
                  <FieldLabel>TC Kimlik Numarası</FieldLabel>
                  <input
                    className="prof-input"
                    style={INPUT_STYLE}
                    value={form.tcNo}
                    onChange={e => set('tcNo', e.target.value.replace(/\D/g,'').slice(0,11))}
                    placeholder="11 haneli TC kimlik numarası"
                    inputMode="numeric"
                  />
                  {form.tcNo.length > 0 && form.tcNo.length !== 11 && (
                    <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>TC kimlik numarası 11 haneli olmalıdır ({form.tcNo.length}/11)</div>
                  )}
                </div>
              )}

              {/* Kurumsal → Vergi No + Vergi Dairesi */}
              {form.invoiceType === 'corporate' && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <FieldLabel>Vergi Numarası</FieldLabel>
                    <input
                      className="prof-input"
                      style={INPUT_STYLE}
                      value={form.taxNo}
                      onChange={e => set('taxNo', e.target.value.replace(/\D/g,'').slice(0,10))}
                      placeholder="10 haneli vergi numarası"
                      inputMode="numeric"
                    />
                    {form.taxNo.length > 0 && form.taxNo.length !== 10 && (
                      <div style={{ fontSize:11, color:'#ef4444', marginTop:4 }}>{form.taxNo.length}/10 hane</div>
                    )}
                  </div>
                  <div>
                    <FieldLabel>Vergi Dairesi</FieldLabel>
                    <input
                      className="prof-input"
                      style={INPUT_STYLE}
                      value={form.taxOffice}
                      onChange={e => set('taxOffice', e.target.value)}
                      placeholder="Örn: Kadıköy Vergi Dairesi"
                    />
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Kaydet */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth:130 }}>
              {saving ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
            </button>
            {saved && (
              <span style={{ fontSize:13, color:'#15803d', display:'flex', alignItems:'center', gap:5 }}>
                <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Kaydedildi
              </span>
            )}
            {saveErr && <span style={{ fontSize:12, color:'#ef4444' }}>{saveErr}</span>}
          </div>

        </div>

        {/* SAĞ: İstatistikler */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { label:'Toplam Sipariş', value: customer.orderCount.toLocaleString('tr-TR'), icon:'🛒', color:'#6366f1' },
            { label:'Toplam Harcama', value: formatMoney(customer.totalSpent),            icon:'💰', color:'#10b981' },
            { label:'Ort. Sipariş',   value: formatMoney(Math.round(avgOrder)),           icon:'📊', color:'#f59e0b' },
            { label:'Son Sipariş',    value: customer.lastOrderDate || '—',               icon:'📅', color:'#0ea5e9' },
            { label:'İlk Sipariş',    value: customer.firstOrderDate || '—',              icon:'🗓', color:'#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'11px 14px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:20 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:s.color, lineHeight:1.2 }}>{s.value}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sipariş geçmişi */}
      <div className="card" style={{ marginTop:20 }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border-light)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Sipariş Geçmişi</span>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{customer.orders.length} sipariş</span>
        </div>

        {customer.orders.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Sipariş bulunamadı.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Ürün</th>
                  <th>Kanal</th>
                  <th style={{ textAlign:'right' }}>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                  <th>Kargo</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map(o => (
                  <tr
                    key={o.id}
                    style={{ cursor:'pointer' }}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).querySelectorAll('td').forEach(td => (td.style.background='var(--primary-light,#EEF2FF)'))}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).querySelectorAll('td').forEach(td => (td.style.background=''))}
                  >
                    <td><span style={{ fontWeight:700, color:'var(--primary)', fontSize:13 }}>{o.orderName}</span></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span>{o.productEmoji}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:500 }}>{o.productName}</div>
                          {o.qty > 1 && <div style={{ fontSize:11, color:'var(--text-muted)' }}>x{o.qty}</div>}
                        </div>
                      </div>
                    </td>
                    <td><ChannelBadge channel={o.channel} /></td>
                    <td style={{ textAlign:'right', fontWeight:700, fontSize:13, whiteSpace:'nowrap' }}>{formatMoney(o.amount)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{o.dateStr}</td>
                    <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                      {o.cargoCode
                        ? <><span style={{ fontWeight:600 }}>{o.cargoCompany}</span><br /><span style={{ fontSize:11 }}>{o.cargoCode}</span></>
                        : <span style={{ color:'var(--border)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
