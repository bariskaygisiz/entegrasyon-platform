/* ===================================
   DYNAMIC SIDEBAR NAV
   Accordion menu — auto active detection
   =================================== */

(function () {
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';
  const currentSlug = new URLSearchParams(window.location.search).get('slug') || '';

  /* ---- NAV STRUCTURE ---- */
  const NAV = [
    {
      section: 'Genel',
      items: [
        {
          id: 'dashboard', label: 'Anasayfa', href: 'dashboard.html',
          icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
        },
        {
          id: 'orders', label: 'Siparişler', href: 'orders.html',
          icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'
        },
        {
          id: 'products', label: 'Ürünler', href: 'products.html',
          icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
        },
        {
          id: 'categories', label: 'Kategoriler', href: 'categories.html',
          icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
        },
        {
          id: 'customers', label: 'Müşteriler', href: 'customers.html',
          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
        },
        {
          id: 'merchant-account', label: 'Hesabım', href: 'merchant-account.html',
          icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
        },
      ]
    },
    {
      section: 'Entegrasyonlar',
      groups: [
        {
          id: 'efatura',
          label: 'E-Arşiv / E-Fatura',
          emoji: '🧾',
          children: [
            { id: 'hepsi-efatura',    label: 'Hepsiburada Faturam',  slug: 'hepsi-efatura' },
            { id: 'trendyol-efatura', label: 'Trendyol E-Faturam',   slug: 'trendyol-efatura', badge: '⚠' },
          ]
        },
        {
          id: 'muhasebe',
          label: 'Ön Muhasebe',
          emoji: '📊',
          children: [
            { id: 'parasut',     label: 'Paraşüt',     slug: 'parasut' },
            { id: 'kolaybi',     label: 'KolayBi',     slug: 'kolaybi' },
            { id: 'logo-isbasi', label: 'Logo İşbaşı', slug: 'logo-isbasi' },
            { id: 'bizimhesap', label: 'Bizimhesap',   slug: 'bizimhesap' },
          ]
        },
        {
          id: 'pazaryeri',
          label: 'Pazaryeri',
          emoji: '🛒',
          children: [
            { id: 'trendyol',    label: 'Trendyol',    slug: 'trendyol' },
            { id: 'hepsiburada', label: 'Hepsiburada', slug: 'hepsiburada' },
            { id: 'amazon',      label: 'Amazon',      slug: 'amazon' },
          ]
        },
        {
          id: 'eticaret',
          label: 'E-Ticaret',
          emoji: '🏪',
          children: [
            { id: 'ikas',     label: 'İkas',     slug: 'ikas' },
            { id: 'ticimax',  label: 'Ticimax',  slug: 'ticimax' },
            { id: 'ideasoft', label: 'İdeasoft', slug: 'ideasoft' },
            { id: 'shopify',  label: 'Shopify',  slug: 'shopify' },
          ]
        },
        {
          id: 'kargo',
          label: 'Kargo',
          emoji: '📦',
          children: [
            { id: 'aras-kargo',    label: 'Aras Kargo',    slug: 'aras-kargo' },
            { id: 'dhl',           label: 'DHL Türkiye',   slug: 'dhl' },
            { id: 'fedex',         label: 'FedEx',         slug: 'fedex' },
            { id: 'ups',           label: 'UPS',           slug: 'ups' },
            { id: 'ptt-kargo',     label: 'PTT Kargo',     slug: 'ptt-kargo' },
            { id: 'hepsijet',      label: 'Hepsijet',      slug: 'hepsijet' },
            { id: 'surat-kargo',   label: 'Sürat Kargo',   slug: 'surat-kargo' },
            { id: 'kolay-gelsin',  label: 'Kolay Gelsin',  slug: 'kolay-gelsin' },
            { id: 'kolay-gonderi', label: 'Kolay Gönderi', slug: 'kolay-gonderi' },
            { id: 'yurtici-kargo', label: 'Yurtiçi Kargo', slug: 'yurtici-kargo' },
          ]
        },
        {
          id: 'depo',
          label: 'Depo / Fulfilment',
          emoji: '🏭',
          children: [
            { id: 'hepsilojistik', label: 'Hepsilojistik', slug: 'hepsilojistik' },
          ]
        },
      ]
    },
    {
      section: 'Yardım',
      items: [
        {
          id: 'egitim', label: 'Eğitim Videoları', href: 'egitim.html',
          icon: 'M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z'
        },
        {
          id: 'destek', label: 'Destek', href: 'destek.html',
          icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        },
      ]
    },
    {
      section: '',
      bottom: true,
      items: [
        {
          id: 'settings', label: 'Ayarlar', href: 'settings.html',
          icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
        },
      ]
    }
  ];

  /* ---- ACTIVE DETECTION ---- */
  function isItemActive(item) {
    return currentFile === item.href;
  }

  function isChildActive(child) {
    return currentFile === 'integration-detail.html' && currentSlug === child.slug;
  }

  function isGroupActive(group) {
    return group.children.some(c => isChildActive(c));
  }

  /* ---- RENDER ---- */
  function icon(d) {
    return `<svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}"/></svg>`;
  }

  function buildItem(item) {
    const active = isItemActive(item);
    return `<a href="${item.href}" class="nav-item${active ? ' active' : ''}">
      ${icon(item.icon)}
      <div class="nav-item-labels">
        <span class="nav-item-label">${item.label}</span>
        ${item.sublabel ? `<span class="nav-item-sublabel">${item.sublabel}</span>` : ''}
      </div>
    </a>`;
  }

  function buildGroup(group) {
    const gActive = isGroupActive(group);
    const childrenHTML = group.children.map(child => {
      const active = isChildActive(child);
      return `<a href="integration-detail.html?slug=${child.slug}" class="nav-subitem${active ? ' active' : ''}">
        ${child.label}
        ${child.badge ? `<span class="nav-subitem-badge">${child.badge}</span>` : ''}
      </a>`;
    }).join('');

    return `<div class="nav-group${gActive ? ' has-active' : ''}">
      <button class="nav-group-header" onclick="__navToggle(this)" aria-expanded="${gActive}">
        <span class="nav-group-emoji">${group.emoji}</span>
        <span class="nav-group-label">${group.label}</span>
        <svg class="nav-group-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      <div class="nav-group-children${gActive ? ' open' : ''}">
        ${childrenHTML}
      </div>
    </div>`;
  }

  function buildNav() {
    const mainSections = NAV.filter(s => !s.bottom);
    const bottomSections = NAV.filter(s => s.bottom);

    const mainHTML = mainSections.map(section => {
      const itemsHTML = (section.items || []).map(buildItem).join('');
      const groupsHTML = (section.groups || []).map(buildGroup).join('');
      return `<div class="nav-section">
        ${section.section ? `<div class="nav-label">${section.section}</div>` : ''}
        ${itemsHTML}${groupsHTML}
      </div>`;
    }).join('');

    const bottomHTML = bottomSections.map(section => {
      const itemsHTML = (section.items || []).map(buildItem).join('');
      return `<div class="nav-section nav-section-bottom">
        ${itemsHTML}
      </div>`;
    }).join('');

    return `<div class="nav-scroll-area">${mainHTML}</div>${bottomHTML}`;
  }

  /* ---- TOGGLE ---- */
  window.__navToggle = function (btn) {
    const children = btn.nextElementSibling;
    const open = children.classList.contains('open');
    children.classList.toggle('open', !open);
    btn.setAttribute('aria-expanded', String(!open));
  };

  /* ---- INIT ---- */
  function init() {
    const el = document.getElementById('sidebarNav');
    if (el) el.innerHTML = buildNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
