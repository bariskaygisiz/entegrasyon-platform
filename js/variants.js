/* ===================================
   VARIANTS.JS — Ürün Varyant Yönetimi
   =================================== */

let variantOptions = [];
let variantData    = {};

const OPTION_PRESETS = ['Renk', 'Beden', 'Kapasite', 'Malzeme', 'Stil', 'Model'];

function toggleVariants(el) {
  const body = document.getElementById('variantsBody');
  body.style.display = el.checked ? 'block' : 'none';
  if (el.checked && variantOptions.length === 0) addVariantOption();
}

function addVariantOption() {
  if (variantOptions.length >= 3) {
    showToast('Uyarı', 'En fazla 3 seçenek ekleyebilirsiniz.', 'warning');
    return;
  }
  variantOptions.push({ id: Date.now(), name: '', values: [] });
  renderVariantOptions();
  updateAddOptBtn();
}

function removeVariantOption(id) {
  variantOptions = variantOptions.filter(o => o.id !== id);
  renderVariantOptions();
  renderVariantsTable();
  updateAddOptBtn();
}

function updateOptionName(id, val) {
  const opt = variantOptions.find(o => o.id === id);
  if (opt) { opt.name = val; renderVariantsTable(); }
}

function addOptionValue(id, input) {
  const val = input.value.trim();
  if (!val) return;
  const opt = variantOptions.find(o => o.id === id);
  if (opt && !opt.values.includes(val)) {
    opt.values.push(val);
    renderVariantOptions();
    renderVariantsTable();
  }
  // restore focus to new input
  setTimeout(() => {
    const inputs = document.querySelectorAll(`[data-opt="${id}"] .value-input`);
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 0);
}

function removeOptionValue(id, val) {
  const opt = variantOptions.find(o => o.id === id);
  if (opt) {
    opt.values = opt.values.filter(v => v !== val);
    renderVariantOptions();
    renderVariantsTable();
  }
}

function renderVariantOptions() {
  document.getElementById('optionsList').innerHTML = variantOptions.map(opt => `
    <div class="variant-opt-row" data-opt="${opt.id}" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:12px;font-weight:600;color:var(--text-muted);white-space:nowrap;">Seçenek adı</span>
        <input class="form-control" type="text" list="presets${opt.id}" placeholder="Renk, Beden, Kapasite..." value="${opt.name}"
          oninput="updateOptionName(${opt.id}, this.value)" style="max-width:200px;font-size:13px;">
        <datalist id="presets${opt.id}">${OPTION_PRESETS.map(p => `<option value="${p}">`).join('')}</datalist>
        <button onclick="removeVariantOption(${opt.id})" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;" title="Seçeneği sil">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
        ${opt.values.map(v => `
          <span class="tag" style="font-size:12px;">${v}
            <button onclick="removeOptionValue(${opt.id},'${v.replace(/'/g,"\\'")}')">×</button>
          </span>
        `).join('')}
        <input class="form-control value-input" type="text" placeholder="Değer ekle + Enter"
          onkeydown="if(event.key==='Enter'){event.preventDefault();addOptionValue(${opt.id},this);}"
          style="width:160px;padding:5px 10px;font-size:12px;">
      </div>
    </div>
  `).join('');
}

function updateAddOptBtn() {
  const btn = document.getElementById('addOptBtn');
  if (btn) btn.style.display = variantOptions.length >= 3 ? 'none' : 'inline-flex';
}

function getCombinations() {
  const filled = variantOptions.filter(o => o.name && o.values.length > 0);
  if (!filled.length) return [];
  let combos = [[]];
  for (const opt of filled) {
    combos = combos.flatMap(combo => opt.values.map(v => [...combo, v]));
  }
  return combos.map(combo => combo.join(' / '));
}

function renderVariantsTable() {
  const combos = getCombinations();
  const tableEl = document.getElementById('variantsTable');
  if (!combos.length) { tableEl.innerHTML = ''; return; }

  const basePrice = document.getElementById('fPrice')?.value || '';
  const baseSku   = document.getElementById('fSku')?.value   || '';

  tableEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-top:4px;border-top:1px solid var(--border-light);">
      <span style="font-size:12px;font-weight:700;color:var(--text-muted);">${combos.length} VARYANT OLUŞTURULDU</span>
      <button class="btn btn-ghost btn-sm" onclick="fillAllPrices()" style="font-size:11px;">Ana fiyatı uygula</button>
    </div>
    <div class="table-wrap" style="border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;">
      <table id="variantDataTable" style="margin:0;">
        <thead>
          <tr>
            <th style="width:160px;">Varyant</th>
            <th>Fiyat (₺)</th>
            <th>İndirimli (₺)</th>
            <th>Stok</th>
            <th>SKU</th>
            <th>Barkod</th>
          </tr>
        </thead>
        <tbody>
          ${combos.map((combo, i) => {
            const saved = variantData[combo] || {};
            return `<tr>
              <td><span style="font-size:13px;font-weight:600;">${combo}</span></td>
              <td><input class="form-control" type="number" style="width:100px;" placeholder="${basePrice || '0'}"
                value="${saved.price || ''}" onchange="saveVD('${combo}','price',this.value)"></td>
              <td><input class="form-control" type="number" style="width:100px;" placeholder="—"
                value="${saved.disc || ''}" onchange="saveVD('${combo}','disc',this.value)"></td>
              <td><input class="form-control" type="number" style="width:80px;" placeholder="0"
                value="${saved.stock || ''}" onchange="saveVD('${combo}','stock',this.value)"></td>
              <td><input class="form-control" type="text" style="width:120px;"
                placeholder="${baseSku ? baseSku + '-' + (i + 1) : 'SKU-' + (i + 1)}"
                value="${saved.sku || ''}" onchange="saveVD('${combo}','sku',this.value)"></td>
              <td><input class="form-control" type="text" style="width:140px;" placeholder="8680000000000"
                value="${saved.barcode || ''}" onchange="saveVD('${combo}','barcode',this.value)"></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function saveVD(combo, field, value) {
  if (!variantData[combo]) variantData[combo] = {};
  variantData[combo][field] = value;
}

function fillAllPrices() {
  const price = document.getElementById('fPrice')?.value || '';
  if (!price) { showToast('Uyarı', 'Önce ana fiyatı girin.', 'warning'); return; }
  document.querySelectorAll('#variantDataTable tbody tr').forEach(row => {
    const inp = row.cells[1]?.querySelector('input');
    if (inp && !inp.value) inp.value = price;
  });
  showToast('Güncellendi', 'Boş fiyat alanları ana fiyatla dolduruldu.', 'success');
}
