/* ===================================
   APP.JS — ENTEGRASYON DEMO
   =================================== */

// ---- SIDEBAR ----
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  const closeBtn = document.getElementById('sidebarClose');
  if (!sidebar) return;

  function open() {
    sidebar.classList.add('open');
    overlay && overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    sidebar.classList.remove('open');
    overlay && overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger && hamburger.addEventListener('click', open);
  closeBtn && closeBtn.addEventListener('click', close);
  overlay && overlay.addEventListener('click', close);
}

// ---- TABS ----
function initTabs() {
  document.querySelectorAll('.tabs').forEach(tabsEl => {
    tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        const parent = btn.closest('[data-tabs-container]') || document;
        tabsEl.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetEl = parent.querySelector('#' + target);
        targetEl && targetEl.classList.add('active');
      });
    });
  });
}

// ---- STATUS TABS ----
function initStatusTabs() {
  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('.status-tabs');
      group.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.status;
      filterOrders(filter);
    });
  });
}

function filterOrders(status) {
  document.querySelectorAll('tr[data-status]').forEach(row => {
    if (status === 'all') {
      row.style.display = '';
    } else {
      row.style.display = row.dataset.status === status ? '' : 'none';
    }
  });
}

// ---- MODALS ----
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}
function initModals() {
  document.querySelectorAll('[data-modal-open]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.modalOpen));
  });
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modalClose));
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });
}

// ---- DROPDOWNS ----
function initDropdowns() {
  document.querySelectorAll('[data-dropdown-toggle]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const menuId = btn.dataset.dropdownToggle;
      const menu = document.getElementById(menuId);
      const isOpen = menu.classList.contains('open');
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
      if (!isOpen) menu.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
  });
}

// ---- TOAST ----
let toastId = 0;
function showToast(title, msg, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
  const id = 'toast-' + (++toastId);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = id;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;margin-left:8px;line-height:1;padding:2px">×</button>
  `;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(20px)'; toast.style.transition = 'all 0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// ---- SEARCH TABLE ----
function initTableSearch() {
  document.querySelectorAll('[data-search-table]').forEach(input => {
    const tableId = input.dataset.searchTable;
    input.addEventListener('input', () => {
      const query = input.value.toLowerCase();
      const table = document.getElementById(tableId);
      if (!table) return;
      table.querySelectorAll('tbody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
      });
    });
  });
}

// ---- TOGGLE SWITCHES ----
function initToggles() {
  document.querySelectorAll('.toggle-action').forEach(toggle => {
    toggle.addEventListener('change', function() {
      const action = this.dataset.action;
      const label = this.closest('.toggle').nextElementSibling;
      if (this.checked) {
        showToast('Bağlantı aktif', action + ' senkronizasyonu başlatıldı.', 'success');
      } else {
        showToast('Bağlantı pasif', action + ' entegrasyonu duraklatıldı.', 'warning');
      }
    });
  });
}

// ---- SYNC ANIMATE ----
function initSyncButtons() {
  document.querySelectorAll('.btn-sync').forEach(btn => {
    btn.addEventListener('click', function() {
      const originalText = this.innerHTML;
      this.innerHTML = '<span class="spin" style="display:inline-block;animation:spin 1s linear infinite">↻</span> Senkronize ediliyor...';
      this.disabled = true;
      const platform = this.dataset.platform || 'Platform';
      setTimeout(() => {
        this.innerHTML = originalText;
        this.disabled = false;
        showToast('Senkronizasyon tamam', platform + ' verileri güncellendi.', 'success');
      }, 2000);
    });
  });
}

// ---- BULK CHECKBOX ----
function initBulkSelect() {
  const checkAll = document.getElementById('checkAll');
  if (!checkAll) return;
  checkAll.addEventListener('change', function() {
    document.querySelectorAll('.row-check').forEach(c => c.checked = this.checked);
    updateBulkBar();
  });
  document.querySelectorAll('.row-check').forEach(c => {
    c.addEventListener('change', updateBulkBar);
  });
}

function updateBulkBar() {
  const checked = document.querySelectorAll('.row-check:checked').length;
  const bar = document.getElementById('bulkBar');
  if (!bar) return;
  if (checked > 0) {
    bar.style.display = 'flex';
    const countEl = bar.querySelector('.bulk-count');
    if (countEl) countEl.textContent = checked + ' öğe seçildi';
  } else {
    bar.style.display = 'none';
  }
}

// ---- CHARTS (Chart.js) ----
function initRevenueChart() {
  const canvas = document.getElementById('revenueChart');
  if (!canvas || !window.Chart) return;
  const labels = ['1 May', '5 May', '10 May', '15 May', '20 May', '22 May'];
  const data = [18400, 22100, 19800, 31200, 27600, 24900];
  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Gelir (₺)',
        data,
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79,70,229,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#4F46E5',
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ₺' + ctx.raw.toLocaleString('tr-TR')
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94A3B8' } },
        y: {
          grid: { color: '#F1F5F9' },
          ticks: {
            font: { size: 11 }, color: '#94A3B8',
            callback: v => '₺' + (v/1000).toFixed(0) + 'K'
          }
        }
      }
    }
  });
}

function initOrdersChart() {
  const canvas = document.getElementById('ordersChart');
  if (!canvas || !window.Chart) return;
  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Trendyol', 'Site', 'Hepsiburada', 'N11'],
      datasets: [{
        data: [58, 22, 14, 6],
        backgroundColor: ['#F27A1A', '#4F46E5', '#FF6000', '#7B2D8B'],
        borderWidth: 0,
        hoverOffset: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 }
        },
        tooltip: {
          callbacks: { label: ctx => ' ' + ctx.label + ': %' + ctx.raw }
        }
      }
    }
  });
}

// ---- CSS SPIN KEYFRAME ----
const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(spinStyle);

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initTabs();
  initStatusTabs();
  initModals();
  initDropdowns();
  initTableSearch();
  initToggles();
  initSyncButtons();
  initBulkSelect();
  initRevenueChart();
  initOrdersChart();
});
