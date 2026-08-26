'use strict';
/**
 * ADMIN.JS — Panel de Administración v2.0
 * Gestión de productos, horario automático y módulo de caja/ventas.
 */

const STORAGE_KEY = 'menudo_store_config_v2';
let storeData = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));

const PRODUCT_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas'];

// ── Migración ─────────────────────────────────────────────────
function migrateData(data) {
  if (!data) return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
  if (data.products && data.products.menudo !== undefined) {
    return ensureAllFields(data);
  }
  const fresh = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
  if (data.business) {
    fresh.business.name   = data.business.name   || fresh.business.name;
    fresh.business.slogan = data.business.slogan || fresh.business.slogan;
  }
  return fresh;
}

function ensureAllFields(data) {
  const def = DEFAULT_STORE_DATA;
  if (!data.schedule || !Array.isArray(data.schedule.days)) {
    data.schedule = JSON.parse(JSON.stringify(def.schedule));
  }
  PRODUCT_KEYS.forEach(k => {
    if (!data.products[k]) data.products[k] = JSON.parse(JSON.stringify(def.products[k]));
    if (typeof data.products[k].enabled === 'undefined') data.products[k].enabled = true;
  });
  if (!Array.isArray(data.caja)) data.caja = [];
  return data;
}

// ── Carga del servidor ────────────────────────────────────────
async function loadStoreDataAsync() {
  try {
    const res = await fetch('/api/config', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    if (res.status === 401) { window.location.href = '/login'; return DEFAULT_STORE_DATA; }
    if (res.ok) {
      const raw = await res.json();
      if (raw && Object.keys(raw).length > 0) {
        const migrated = migrateData(raw);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.warn('Servidor no disponible, usando localStorage:', e);
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { try { return migrateData(JSON.parse(saved)); } catch { /* */ } }
  return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
}

// ── Guardar en servidor ───────────────────────────────────────
function saveStoreData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storeData));
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(storeData)
  })
  .then(r => {
    if (r.status === 401) { window.location.href = '/login'; return; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  })
  .catch(e => console.warn('No se pudo sincronizar al servidor:', e));
}

// ════════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════════
function initTabs() {
  const tabs = document.querySelectorAll('.dashboard-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

// ════════════════════════════════════════════════════════════════
// TAB: PRODUCTOS
// ════════════════════════════════════════════════════════════════
const PRODUCT_NAMES = {
  menudo:      '🍲 Menudo Tradicional',
  birria:      '🥩 Birria de Res',
  tacos:       '🌮 Tacos de Birria',
  quesadillas: '🧀 Quesadilla Gigante de Birria'
};

function renderProductEditors() {
  const container = document.getElementById('productEditorContainer');
  if (!container) return;
  container.innerHTML = PRODUCT_KEYS.map(key => {
    const p = storeData.products[key];
    return `
      <div class="admin-panel-card" style="margin-bottom:24px;">
        <div class="card-header-styled" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <h3 style="margin:0;">${PRODUCT_NAMES[key]}</h3>
          <label class="switch-label" title="${p.enabled ? 'Visible en menú' : 'Oculto en menú'}">
            <input type="checkbox" ${p.enabled ? 'checked' : ''}
              onchange="toggleProductEnabled('${key}', this.checked)">
            <span class="switch-slider"></span>
          </label>
        </div>
        <div class="product-editor-body">
          <!-- Foto -->
          <div class="photo-preview-wrap">
            <img id="prev-${key}" src="${p.image || DEFAULT_STORE_DATA.products[key].image}"
              alt="${p.title}" onerror="this.src='${DEFAULT_STORE_DATA.products[key].image}'">
          </div>
          <div class="dish-editor-controls" style="flex:1;min-width:220px;">
            <!-- Subir foto -->
            <div class="photo-card-actions" style="margin-bottom:10px;">
              <label class="btn-upload-file">
                <i class="fa-solid fa-camera"></i> Subir Foto
                <input type="file" accept="image/*" onchange="handleImageUpload(event,'${key}')" style="display:none;">
              </label>
              <button type="button" class="btn-reset-img" onclick="resetSingleImage('${key}')" title="Foto predeterminada">
                <i class="fa-solid fa-rotate-left"></i>
              </button>
            </div>
            <!-- Título -->
            <div class="field-item">
              <label>Título</label>
              <input type="text" id="pt-${key}" class="form-input" value="${p.title}">
            </div>
            <!-- Precio -->
            <div style="display:flex;gap:10px;">
              <div class="field-item" style="flex:1;">
                <label>Precio ($)</label>
                <input type="number" id="pp-${key}" class="form-input" value="${p.price}" min="0" step="0.5">
              </div>
              <div class="field-item" style="flex:1;">
                <label>Nota precio (ej: "por taco")</label>
                <input type="text" id="pn-${key}" class="form-input" value="${p.priceNote || ''}" placeholder="Opcional">
              </div>
            </div>
            <!-- Badge -->
            <div class="field-item">
              <label>Etiqueta / Badge</label>
              <input type="text" id="pb-${key}" class="form-input" value="${p.badge || ''}" placeholder="Ej: 🍵 Incluye consomé">
            </div>
            <!-- Descripción -->
            <div class="field-item">
              <label>Descripción</label>
              <textarea id="pd-${key}" class="form-input" rows="3">${p.description}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleProductEnabled(key, enabled) {
  if (storeData.products[key]) storeData.products[key].enabled = enabled;
}

function saveProductosForm() {
  PRODUCT_KEYS.forEach(key => {
    const p = storeData.products[key];
    p.title       = document.getElementById(`pt-${key}`)?.value.trim() || p.title;
    p.price       = Number(document.getElementById(`pp-${key}`)?.value) || p.price;
    p.priceNote   = document.getElementById(`pn-${key}`)?.value.trim() || '';
    p.badge       = document.getElementById(`pb-${key}`)?.value.trim() || '';
    p.description = document.getElementById(`pd-${key}`)?.value.trim() || p.description;
  });
  saveStoreData();
  showToast('✅ Productos guardados');
}

// ════════════════════════════════════════════════════════════════
// IMÁGENES (upload con compresión)
// ════════════════════════════════════════════════════════════════
function compressImage(file, maxW, maxH, q) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Error')), 'image/jpeg', q);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function handleImageUpload(event, key) {
  const file = event.target.files[0];
  if (!file) return;
  showToast('⏳ Procesando imagen...');
  try {
    const compressed = await compressImage(file, 1200, 1200, 0.82);
    const dataUrl    = await blobToDataUrl(compressed);
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ key, image: dataUrl })
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    storeData.products[key].image = data.url + '?t=' + Date.now();
    const prev = document.getElementById(`prev-${key}`);
    if (prev) prev.src = storeData.products[key].image;
    saveStoreData();
    showToast(`✅ Foto de ${PRODUCT_NAMES[key]} actualizada`);
  } catch (e) {
    console.error(e);
    showToast('❌ Error al subir imagen. Intenta de nuevo.');
  }
}

function resetSingleImage(key) {
  if (confirm(`¿Restablecer la foto predeterminada de ${PRODUCT_NAMES[key]}?`)) {
    storeData.products[key].image = DEFAULT_STORE_DATA.products[key].image;
    const prev = document.getElementById(`prev-${key}`);
    if (prev) prev.src = storeData.products[key].image;
    saveStoreData();
    showToast('Foto restablecida');
  }
}

// ════════════════════════════════════════════════════════════════
// TAB: HORARIO
// ════════════════════════════════════════════════════════════════
function populateScheduleForm() {
  const s = storeData.schedule || DEFAULT_STORE_DATA.schedule;
  // Marcar días
  [0,1,2,3,4,5,6].forEach(d => {
    const el = document.getElementById(`day${d}`);
    if (el) el.checked = Array.isArray(s.days) && s.days.includes(d);
  });
  const openEl    = document.getElementById('scheduleOpen');
  const closeEl   = document.getElementById('scheduleClose');
  const displayEl = document.getElementById('scheduleDisplay');
  if (openEl)    openEl.value    = s.openTime    || '08:00';
  if (closeEl)   closeEl.value   = s.closeTime   || '14:00';
  if (displayEl) displayEl.value = s.displayText || '';
  updateSchedulePreview();
}

function checkIsOpenNow(schedule) {
  if (!schedule || !Array.isArray(schedule.days)) return false;
  const now = new Date();
  const day = now.getDay();
  if (!schedule.days.includes(day)) return false;
  const [oh, om] = (schedule.openTime  || '00:00').split(':').map(Number);
  const [ch, cm] = (schedule.closeTime || '23:59').split(':').map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= (oh * 60 + om) && nowMin < (ch * 60 + cm);
}

function updateSchedulePreview() {
  const previewEl = document.getElementById('previewStatus');
  if (!previewEl) return;
  const tempSchedule = readScheduleFromForm();
  const isOpen = checkIsOpenNow(tempSchedule);
  previewEl.innerHTML = isOpen
    ? '<span style="color:#16A34A;font-weight:700;">🟢 ABIERTO ahora</span>'
    : '<span style="color:#DC2626;font-weight:700;">🔴 CERRADO ahora</span>';
}

function readScheduleFromForm() {
  const days = [];
  [0,1,2,3,4,5,6].forEach(d => {
    const el = document.getElementById(`day${d}`);
    if (el?.checked) days.push(d);
  });
  return {
    days,
    openTime:    document.getElementById('scheduleOpen')?.value  || '08:00',
    closeTime:   document.getElementById('scheduleClose')?.value || '14:00',
    displayText: document.getElementById('scheduleDisplay')?.value.trim() || ''
  };
}

function saveScheduleForm(e) {
  e.preventDefault();
  storeData.schedule = readScheduleFromForm();
  saveStoreData();
  updateSchedulePreview();
  showToast('✅ Horario guardado. Se aplica automáticamente en el menú.');
}

// ════════════════════════════════════════════════════════════════
// TAB: NEGOCIO
// ════════════════════════════════════════════════════════════════
function populateNegocioForm() {
  const b = storeData.business || {};
  const nameEl   = document.getElementById('adminName');
  const sloganEl = document.getElementById('adminSlogan');
  if (nameEl)   nameEl.value   = b.name   || '';
  if (sloganEl) sloganEl.value = b.slogan || '';
}

function saveNegocioForm(e) {
  e.preventDefault();
  storeData.business.name   = document.getElementById('adminName')?.value.trim()   || storeData.business.name;
  storeData.business.slogan = document.getElementById('adminSlogan')?.value.trim() || '';
  saveStoreData();
  showToast('✅ Datos del negocio guardados');
}

// ════════════════════════════════════════════════════════════════
// TAB: CARTELES & QR
// ════════════════════════════════════════════════════════════════
function getMenuUrl() {
  return window.location.origin + '/';
}

function initQRCode() {
  const qrInput = document.getElementById('customQrUrl');
  if (qrInput && !qrInput.value) qrInput.value = getMenuUrl();
  const url = qrInput?.value || getMenuUrl();
  const qrOpts = (w) => ({ text: url, width: w, height: w, colorDark: '#C84B31', colorLight: '#FFFFFF', correctLevel: QRCode.CorrectLevel.H });

  const box = document.getElementById('qrcodeBox');
  if (box) { box.innerHTML = ''; new QRCode(box, qrOpts(160)); }
  ['printQrImage1','printQrImage2','printQrImage3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; new QRCode(el, qrOpts(125)); }
  });
  ['flyerQr1','flyerQr2','flyerQr3','flyerQr4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; new QRCode(el, qrOpts(105)); }
  });
  populatePrintTitles();
}

function populatePrintTitles() {
  const p = storeData.products;
  ['.chip-title-menudo','.flyer-title-menudo']
    .forEach(s => document.querySelectorAll(s).forEach(el => el.textContent = p?.menudo?.title  || 'Menudo'));
  ['.chip-title-birria','.flyer-title-birria']
    .forEach(s => document.querySelectorAll(s).forEach(el => el.textContent = p?.birria?.title  || 'Birria de Res'));
  ['.chip-title-tacos','.flyer-title-tacos']
    .forEach(s => document.querySelectorAll(s).forEach(el => el.textContent = p?.tacos?.title   || 'Tacos de Birria'));
  ['.chip-title-quesadillas','.flyer-title-quesadillas']
    .forEach(s => document.querySelectorAll(s).forEach(el => el.textContent = p?.quesadillas?.title || 'Quesadillas'));
}

function printTableCards() {
  document.body.classList.remove('print-flyers-mode');
  document.body.classList.add('print-tables-mode');
  window.print();
}

function printStreetFlyers() {
  document.body.classList.remove('print-tables-mode');
  document.body.classList.add('print-flyers-mode');
  window.print();
}

// ════════════════════════════════════════════════════════════════
// TAB: CAJA / VENTAS
// ════════════════════════════════════════════════════════════════
function renderCajaForm() {
  const tbody = document.getElementById('cajaTableBody');
  if (!tbody) return;

  // Fecha de hoy por defecto
  const dateInput = document.getElementById('cajaDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  tbody.innerHTML = PRODUCT_KEYS.map(key => {
    const p = storeData.products[key];
    if (!p) return '';
    const price = Number(p.price) || 0;
    return `
      <tr>
        <td>${p.emoji || ''} ${p.title}</td>
        <td>${storeData.business.currencySymbol}${price}${p.priceNote ? ' <small>'+p.priceNote+'</small>' : ''}</td>
        <td>
          <input type="number" class="caja-qty-input" id="cajaqty-${key}"
            min="0" value="0" data-price="${price}"
            oninput="recalculateCaja()">
        </td>
        <td class="caja-sub" id="cajasub-${key}">$0</td>
      </tr>
    `;
  }).join('');
}

function recalculateCaja() {
  let total = 0;
  PRODUCT_KEYS.forEach(key => {
    const qtyEl = document.getElementById(`cajaqty-${key}`);
    const subEl = document.getElementById(`cajasub-${key}`);
    if (!qtyEl || !subEl) return;
    const qty   = Math.max(0, parseInt(qtyEl.value) || 0);
    const price = parseFloat(qtyEl.dataset.price) || 0;
    const sub   = qty * price;
    total += sub;
    subEl.textContent = `$${sub.toLocaleString('es-MX')}`;
  });
  const totalEl = document.getElementById('cajaTotalDisplay');
  if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-MX')}`;
}

function saveCajaEntry(e) {
  e.preventDefault();
  const dateVal = document.getElementById('cajaDate')?.value;
  if (!dateVal) { showToast('❌ Selecciona una fecha'); return; }

  // Comprobar si ya existe un corte para esa fecha
  const existing = storeData.caja.findIndex(c => c.date === dateVal);

  const sales = {};
  let total = 0;
  PRODUCT_KEYS.forEach(key => {
    const p     = storeData.products[key];
    const qty   = Math.max(0, parseInt(document.getElementById(`cajaqty-${key}`)?.value) || 0);
    const price = Number(p?.price) || 0;
    const sub   = qty * price;
    total += sub;
    sales[key] = { qty, price, subtotal: sub, title: p?.title || key };
  });

  const d = new Date(dateVal + 'T12:00:00');
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dateDisplay = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;

  const entry = {
    id:          'k_' + Date.now(),
    date:        dateVal,
    dateDisplay,
    sales,
    total,
    notes:       document.getElementById('cajaNotes')?.value.trim() || ''
  };

  if (existing >= 0) {
    if (!confirm(`Ya existe un corte para ${dateDisplay}. ¿Sobreescribirlo?`)) return;
    storeData.caja[existing] = entry;
  } else {
    storeData.caja.unshift(entry); // más reciente primero
  }

  saveStoreData();
  renderCajaHistorial();
  renderCajaStats();

  // Reset form
  document.getElementById('cajaForm')?.reset();
  const dateInput = document.getElementById('cajaDate');
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  renderCajaForm(); // recarga la tabla con precios actuales

  showToast(`✅ Corte del ${dateDisplay} guardado — Total: $${total.toLocaleString('es-MX')}`);
}

function deleteCajaEntry(id) {
  const entry = storeData.caja.find(c => c.id === id);
  if (!entry) return;
  if (!confirm(`¿Eliminar el corte del ${entry.dateDisplay}?`)) return;
  storeData.caja = storeData.caja.filter(c => c.id !== id);
  saveStoreData();
  renderCajaHistorial();
  renderCajaStats();
  showToast('Corte eliminado');
}

function renderCajaStats() {
  const row = document.getElementById('cajaStatsRow');
  if (!row || !storeData.caja.length) { if (row) row.innerHTML = ''; return; }

  const totalGeneral = storeData.caja.reduce((s, c) => s + (c.total || 0), 0);
  const thisMonth    = new Date().toISOString().slice(0, 7);
  const totalMes     = storeData.caja
    .filter(c => c.date.startsWith(thisMonth))
    .reduce((s, c) => s + (c.total || 0), 0);
  const numCortes    = storeData.caja.length;

  row.innerHTML = `
    <div class="caja-stat-card">
      <div class="caja-stat-icon">📅</div>
      <div class="caja-stat-label">Total del mes</div>
      <div class="caja-stat-value">$${totalMes.toLocaleString('es-MX')}</div>
    </div>
    <div class="caja-stat-card">
      <div class="caja-stat-icon">💰</div>
      <div class="caja-stat-label">Total histórico</div>
      <div class="caja-stat-value">$${totalGeneral.toLocaleString('es-MX')}</div>
    </div>
    <div class="caja-stat-card">
      <div class="caja-stat-icon">📋</div>
      <div class="caja-stat-label">Días registrados</div>
      <div class="caja-stat-value">${numCortes}</div>
    </div>
  `;
}

function renderCajaHistorial() {
  const container = document.getElementById('cajaHistorial');
  if (!container) return;

  if (!storeData.caja.length) {
    container.innerHTML = '<p style="text-align:center; color:#9CA3AF; padding:24px;">Aún no hay cortes guardados. ¡Registra las ventas de hoy!</p>';
    return;
  }

  container.innerHTML = storeData.caja.map(entry => {
    const sym = storeData.business.currencySymbol || '$';
    const rows = PRODUCT_KEYS.map(key => {
      const s = entry.sales?.[key];
      if (!s || s.qty === 0) return '';
      return `
        <tr>
          <td>${storeData.products[key]?.emoji || ''} ${s.title || key}</td>
          <td>${sym}${s.price}</td>
          <td>${s.qty}</td>
          <td>${sym}${s.subtotal.toLocaleString('es-MX')}</td>
        </tr>
      `;
    }).join('');

    return `
      <div class="caja-entry-card">
        <div class="caja-entry-header">
          <div>
            <span class="caja-entry-date">${entry.dateDisplay}</span>
            ${entry.notes ? `<span class="caja-entry-notes">${entry.notes}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="caja-entry-total">${sym}${(entry.total||0).toLocaleString('es-MX')}</span>
            <button class="btn-del-guisado" onclick="deleteCajaEntry('${entry.id}')" title="Eliminar corte">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
        ${rows ? `
          <table class="caja-detail-table">
            <tr><th>Producto</th><th>Precio</th><th>Cant.</th><th>Subtotal</th></tr>
            ${rows}
          </table>` : ''}
      </div>
    `;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════
let toastTimer = null;
function showToast(msg) {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  storeData = await loadStoreDataAsync();

  initTabs();

  // Productos
  renderProductEditors();
  document.getElementById('productosForm')?.addEventListener('submit', e => {
    e.preventDefault();
    saveProductosForm();
  });

  // Horario
  populateScheduleForm();
  document.getElementById('scheduleForm')?.addEventListener('submit', saveScheduleForm);
  // Preview en tiempo real al cambiar cualquier campo del horario
  document.querySelectorAll('#daysSelector input, #scheduleOpen, #scheduleClose')
    .forEach(el => el.addEventListener('change', updateSchedulePreview));

  // Negocio
  populateNegocioForm();
  document.getElementById('negocioForm')?.addEventListener('submit', saveNegocioForm);

  // QR
  document.getElementById('customQrUrl')?.addEventListener('input', initQRCode);
  document.getElementById('printTableCardsBtn')?.addEventListener('click', printTableCards);
  document.getElementById('printStreetFlyersBtn')?.addEventListener('click', printStreetFlyers);
  initQRCode();

  // Caja
  renderCajaForm();
  renderCajaStats();
  renderCajaHistorial();
  document.getElementById('cajaForm')?.addEventListener('submit', saveCajaEntry);
});
