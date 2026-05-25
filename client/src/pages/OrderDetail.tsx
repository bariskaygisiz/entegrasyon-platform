import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../lib/api';
import { formatMoney, statusLabel } from '../lib/utils';
import type { Order } from '../types';

const STATUS_STEPS = ['new', 'preparing', 'shipped', 'delivered'];
const STATUS_LABELS: Record<string, string> = {
  new: 'Yeni Sipariş', preparing: 'Hazırlanıyor', shipped: 'Kargoya Verildi', delivered: 'Teslim Edildi', cancelled: 'İptal Edildi',
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.orders.get(parseInt(id)).then(setOrder).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout title="Sipariş Detayı"><div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Yükleniyor…</div></Layout>;
  if (!order)  return <Layout title="Sipariş Bulunamadı"><div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Sipariş bulunamadı.</div></Layout>;

  const st = statusLabel(order.status);
  const stepIdx = STATUS_STEPS.indexOf(order.status);

  return (
    <Layout title={`Sipariş #${order.id}`}>
      <Link to="/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 16 }}>
        <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Siparişler
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, marginBottom: 6 }}>Sipariş #{order.id}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge ${st.cls}`}>{st.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.dateStr}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Fatura Kes</button>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>Kargoya Ver</button>
        </div>
      </div>

      {/* Progress bar */}
      {order.status !== 'cancelled' && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 14, left: '5%', right: '5%', height: 2, background: 'var(--border)', zIndex: 0 }} />
            {STATUS_STEPS.map((s, i) => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1, flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                  background: i <= stepIdx ? 'var(--primary)' : 'var(--card)',
                  border: `2px solid ${i <= stepIdx ? 'var(--primary)' : 'var(--border)'}`,
                  color: i <= stepIdx ? '#fff' : 'var(--text-muted)',
                }}>
                  {i < stepIdx ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i <= stepIdx ? 'var(--primary)' : 'var(--text-muted)', fontWeight: i === stepIdx ? 700 : 400, textAlign: 'center' }}>
                  {STATUS_LABELS[s]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          {/* Order items */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: 13 }}>Sipariş Kalemleri</div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  {order.productEmoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{order.productName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>SKU: {order.productSku}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatMoney(order.productPrice)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>x{order.qty}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Toplam</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{formatMoney(order.amount)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Ödeme Bilgisi</div>
            {[
              ['Ödeme Yöntemi', order.paymentMethod],
              ['Kargo Ücreti', formatMoney(0)],
              ['Toplam', formatMoney(order.amount)],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                <span style={{ fontWeight: lbl === 'Toplam' ? 700 : 400 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Cargo */}
          {order.cargoCode && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Kargo Bilgisi</div>
              <div style={{ fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Firma: </span>{order.cargoCompany}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Takip No: </span><strong>{order.cargoCode}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Müşteri Bilgisi</div>
            {[
              ['Ad Soyad', order.customer],
              ['E-posta', order.email],
              ['Telefon', order.phone],
              ['Şehir', `${order.district}, ${order.city}`],
              ['Adres', order.address],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>

          {order.note && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius)', padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6 }}>⚠ Sipariş Notu</div>
              <div style={{ fontSize: 13, color: '#78350F' }}>{order.note}</div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
