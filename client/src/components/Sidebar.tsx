import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  {
    section: 'Genel',
    items: [
      { id: 'dashboard',        label: 'Anasayfa',         path: '/dashboard',        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { id: 'orders',           label: 'Siparişler',       path: '/orders',           icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
      { id: 'products',         label: 'Ürünler',          path: '/products',         icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { id: 'categories',       label: 'Kategoriler',      path: '/categories',       icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
      { id: 'customers',        label: 'Müşteriler',       path: '/customers',        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { id: 'merchant-account', label: 'Hesabım',          path: '/account',          icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    ],
  },
  {
    section: 'Entegrasyonlar',
    groups: [
      {
        id: 'efatura', label: 'E-Arşiv / E-Fatura', emoji: '🧾',
        children: [
          { label: 'Hepsiburada Faturam',  slug: 'hepsi-efatura' },
          { label: 'Trendyol E-Faturam',   slug: 'trendyol-efatura', badge: '⚠' },
        ],
      },
      {
        id: 'muhasebe', label: 'Ön Muhasebe', emoji: '📊',
        children: [
          { label: 'Paraşüt',     slug: 'parasut' },
          { label: 'KolayBi',     slug: 'kolaybi' },
          { label: 'Logo İşbaşı', slug: 'logo-isbasi' },
          { label: 'Bizimhesap',  slug: 'bizimhesap' },
        ],
      },
      {
        id: 'pazaryeri', label: 'Pazaryeri', emoji: '🛒',
        children: [
          { label: 'Trendyol',    slug: 'trendyol' },
          { label: 'Hepsiburada', slug: 'hepsiburada' },
          { label: 'Amazon',      slug: 'amazon' },
        ],
      },
      {
        id: 'eticaret', label: 'E-Ticaret', emoji: '🏪',
        children: [
          { label: 'İkas',     slug: 'ikas' },
          { label: 'Ticimax',  slug: 'ticimax' },
          { label: 'İdeasoft', slug: 'ideasoft' },
          { label: 'Shopify',  slug: 'shopify' },
        ],
      },
      {
        id: 'kargo', label: 'Kargo', emoji: '📦',
        children: [
          { label: 'Aras Kargo',    slug: 'aras-kargo' },
          { label: 'DHL Türkiye',   slug: 'dhl' },
          { label: 'FedEx',         slug: 'fedex' },
          { label: 'UPS',           slug: 'ups' },
          { label: 'PTT Kargo',     slug: 'ptt-kargo' },
          { label: 'Hepsijet',      slug: 'hepsijet' },
          { label: 'Sürat Kargo',   slug: 'surat-kargo' },
          { label: 'Kolay Gelsin',  slug: 'kolay-gelsin' },
          { label: 'Yurtiçi Kargo', slug: 'yurtici-kargo' },
        ],
      },
      {
        id: 'depo', label: 'Depo / Fulfilment', emoji: '🏭',
        children: [{ label: 'Hepsilojistik', slug: 'hepsilojistik' }],
      },
    ],
  },
  {
    section: 'Yardım',
    items: [
      { id: 'egitim', label: 'Eğitim Videoları', path: '/egitim', icon: 'M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z' },
      { id: 'destek', label: 'Destek',           path: '/destek',  icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
];

type NavGroupType = {
  id: string;
  label: string;
  emoji: string;
  children: { label: string; slug: string; badge?: string }[];
};

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

function NavGroup({ group }: { group: NavGroupType }) {
  const location = useLocation();
  const isActive = location.pathname === '/integrations' &&
    !!new URLSearchParams(location.search).get('slug') &&
    group.children.some((c: { slug: string }) => c.slug === new URLSearchParams(location.search).get('slug'));

  const [open, setOpen] = useState<boolean>(!!isActive);

  return (
    <div className={`nav-group${isActive ? ' has-active' : ''}`}>
      <button className="nav-group-header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="nav-group-emoji">{group.emoji}</span>
        <span className="nav-group-label">{group.label}</span>
        <svg className="nav-group-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" width={14} height={14}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div className={`nav-group-children${open ? ' open' : ''}`}>
        {group.children.map(child => (
          <NavLink
            key={child.slug}
            to={`/integrations?slug=${child.slug}`}
            className={({ isActive: a }) => {
              const slugMatch = new URLSearchParams(location.search).get('slug') === child.slug && location.pathname === '/integrations';
              return `nav-subitem${(a || slugMatch) ? ' active' : ''}`;
            }}
          >
            {child.label}
            {'badge' in child && child.badge && <span className="nav-subitem-badge">{child.badge}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      <div className={`sidebar-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">E</div>
            <div>
              <div className="logo-text">
                Entegrasyon<span>Entegrasyon Platformu</span>
              </div>
            </div>
          </div>
          <button className="sidebar-close" onClick={onClose}>×</button>
        </div>

        <div className="sidebar-store">
          <div className="store-avatar">T</div>
          <div>
            <div className="store-name">Teknoloji A.Ş.</div>
            <div className="store-plan">Pro Plan · 6 aktif</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-scroll-area">
            {NAV.filter(s => s.section !== '').map(section => (
              <div key={section.section} className="nav-section">
                {section.section && <div className="nav-label">{section.section}</div>}
                {'items' in section && section.items?.map(item => (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    onClick={onClose}
                  >
                    <NavIcon d={item.icon} />
                    <div className="nav-item-labels">
                      <span className="nav-item-label">{item.label}</span>
                    </div>
                  </NavLink>
                ))}
                {'groups' in section && section.groups?.map(group => (
                  <NavGroup key={group.id} group={group} />
                ))}
              </div>
            ))}
          </div>

          <div className="nav-section nav-section-bottom">
            <NavLink to="/settings" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={onClose}>
              <NavIcon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <div className="nav-item-labels"><span className="nav-item-label">Ayarlar</span></div>
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <NavLink to="/" className="nav-item" onClick={onClose}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Çıkış Yap</span>
          </NavLink>
        </div>
      </aside>
    </>
  );
}
