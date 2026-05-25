import React from 'react';
import Layout from '../components/Layout';

const CUSTOMERS = [
  { name: 'Ahmet Yılmaz', email: 'ahmet.yilmaz@email.com', city: 'İstanbul', orders: 8, total: 124500 },
  { name: 'Fatma Kaya', email: 'fatma.kaya@email.com', city: 'Ankara', orders: 5, total: 67200 },
  { name: 'Mehmet Demir', email: 'mehmet.demir@email.com', city: 'İzmir', orders: 12, total: 198000 },
  { name: 'Ayşe Çelik', email: 'ayse.celik@email.com', city: 'İstanbul', orders: 3, total: 42000 },
  { name: 'Mustafa Şahin', email: 'mustafa.sahin@email.com', city: 'Bursa', orders: 7, total: 89500 },
  { name: 'Zeynep Arslan', email: 'zeynep.arslan@email.com', city: 'Antalya', orders: 2, total: 15000 },
];
export default function Customers() {
  return (
    <Layout title="Müşteriler">
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Müşteri</th><th>Şehir</th><th>Sipariş</th><th>Toplam Harcama</th></tr></thead>
            <tbody>
              {CUSTOMERS.map(c => (
                <tr key={c.email}>
                  <td><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div></td>
                  <td>{c.city}</td>
                  <td>{c.orders}</td>
                  <td style={{ fontWeight: 600 }}>₺{c.total.toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
