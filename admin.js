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
// TAB: ANALÍTICA DE VENTAS
// ════════════════════════════════════════════════════════════════

/** Carga transacciones del servidor y renderiza toda la analítica */
async function loadAnalytics() {
  const monthEl = document.getElementById('analyticsMonth');
  const month   = monthEl?.value || new Date().toISOString().slice(0, 7);
  if (monthEl && !monthEl.value) monthEl.value = month;

  try {
    const [monthRes, allRes] = await Promise.all([
      fetch(`/api/transactions?month=${month}`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
      fetch('/api/transactions', { cache: 'no-store', headers: { Accept: 'application/json' } })
    ]);
    if (monthRes.status === 401 || allRes.status === 401) { window.location.href = '/login'; return; }
    const monthTxs = monthRes.ok ? await monthRes.json() : [];
    const allTxs   = allRes.ok  ? await allRes.json()   : [];

    renderKpis(monthTxs, allTxs);
    renderHourChart(monthTxs);
    renderProductBreakdown(monthTxs);
    renderDailyTable(monthTxs);
    renderTransactionList(monthTxs);
  } catch (e) {
    console.error('Error cargando analítica:', e);
    showToast('❌ No se pudo cargar la analítica. Verifica conexión.');
  }
}

function renderKpis(monthTxs, allTxs) {
  const monthTotal  = monthTxs.reduce((s, t) => s + (t.total || 0), 0);
  const allTotal    = allTxs.reduce((s, t) => s + (t.total || 0), 0);
  const avg         = monthTxs.length ? monthTotal / monthTxs.length : 0;
  setText('kpiMonth',   `$${monthTotal.toLocaleString('es-MX')}`);
  setText('kpiTotal',   `$${allTotal.toLocaleString('es-MX')}`);
  setText('kpiAvg',     `$${Math.round(avg).toLocaleString('es-MX')}`);
  setText('kpiClients', monthTxs.length);
}

function renderHourChart(txs) {
  const el = document.getElementById('analyticsHours');
  if (!el) return;
  if (!txs.length) { el.innerHTML = '<p style="color:#9CA3AF;text-align:center;padding:16px;">Sin datos para este mes.</p>'; return; }

  // Contar clientes por hora
  const counts = Array(24).fill(0);
  txs.forEach(t => { if (t.hour >= 0 && t.hour <= 23) counts[t.hour]++; });
  const max = Math.max(...counts, 1);

  // Solo mostrar horas con actividad (o rango 6-18)
  const hours = [];
  for (let h = 6; h <= 18; h++) hours.push(h);

  el.innerHTML = `
    <div class="hours-chart">
      ${hours.map(h => {
        const c    = counts[h];
        const pct  = Math.round((c / max) * 100);
        const label = h >= 12 ? `${h === 12 ? 12 : h - 12}PM` : `${h}AM`;
        return `
          <div class="hour-bar-wrap" title="${label}: ${c} clientes">
            <div class="hour-bar-track">
              <div class="hour-bar-fill ${c > 0 ? (pct >= 80 ? 'bar-hot' : pct >= 40 ? 'bar-mid' : 'bar-low') : ''}"
                style="height:${pct}%"></div>
            </div>
            <div class="hour-bar-label">${label}</div>
            ${c > 0 ? `<div class="hour-bar-count">${c}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderProductBreakdown(txs) {
  const el = document.getElementById('analyticsProducts');
  if (!el) return;
  if (!txs.length) { el.innerHTML = '<p style="color:#9CA3AF;text-align:center;padding:16px;">Sin datos.</p>'; return; }

  const totals = {};
  const qtys   = {};
  txs.forEach(t => {
    (t.items || []).forEach(item => {
      totals[item.key] = (totals[item.key] || 0) + (item.subtotal || 0);
      qtys[item.key]   = (qtys[item.key]   || 0) + (item.qty     || 0);
    });
  });

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0) || 1;
  const sym = storeData.business?.currencySymbol || '$';

  el.innerHTML = `
    <div class="product-breakdown">
      ${PRODUCT_KEYS.map(key => {
        const p    = storeData.products?.[key];
        const amt  = totals[key]  || 0;
        const qty  = qtys[key]    || 0;
        const pct  = Math.round((amt / grandTotal) * 100);
        if (!qty) return '';
        return `
          <div class="prod-breakdown-row">
            <div class="prod-breakdown-label">
              <span>${p?.emoji || ''} ${p?.title || key}</span>
              <span class="prod-breakdown-qty">${qty} uds.</span>
            </div>
            <div class="prod-breakdown-bar-wrap">
              <div class="prod-breakdown-bar" style="width:${pct}%"></div>
            </div>
            <div class="prod-breakdown-right">
              <span class="prod-breakdown-pct">${pct}%</span>
              <span class="prod-breakdown-total">${sym}${amt.toLocaleString('es-MX')}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDailyTable(txs) {
  const tbody = document.getElementById('analyticsDailyBody');
  if (!tbody) return;
  if (!txs.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9CA3AF;padding:20px;">Sin ventas en este mes.</td></tr>';
    return;
  }

  // Agrupar por fecha
  const byDate = {};
  txs.forEach(t => {
    if (!byDate[t.date]) byDate[t.date] = { date: t.date, txs: [] };
    byDate[t.date].txs.push(t);
  });

  const sym = storeData.business?.currencySymbol || '$';
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  tbody.innerHTML = Object.values(byDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(day => {
      const total  = day.txs.reduce((s, t) => s + (t.total || 0), 0);
      const avg    = day.txs.length ? Math.round(total / day.txs.length) : 0;
      const d      = new Date(day.date + 'T12:00:00');
      const label  = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
      return `
        <tr>
          <td style="font-weight:600;">${label}</td>
          <td>${day.txs.length}</td>
          <td>${sym}${avg.toLocaleString('es-MX')}</td>
          <td style="font-weight:700;color:var(--color-primary);">${sym}${total.toLocaleString('es-MX')}</td>
        </tr>
      `;
    }).join('');
}

function renderTransactionList(txs) {
  const el = document.getElementById('analyticsTransactions');
  if (!el) return;
  if (!txs.length) {
    el.innerHTML = '<p style="color:#9CA3AF;text-align:center;padding:16px;">Sin transacciones este mes.</p>';
    return;
  }

  const sym = storeData.business?.currencySymbol || '$';
  const methodLabel = { efectivo: '💵', tarjeta: '💳', transferencia: '📱' };

  el.innerHTML = `
    <div class="tx-list">
      ${txs.slice(0, 100).map(t => {
        const ts    = new Date(t.timestamp);
        const time  = ts.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const icon  = methodLabel[t.paymentMethod] || '💰';
        const items = (t.items || []).map(i => `${i.qty}× ${storeData.products?.[i.key]?.emoji || ''} ${i.title || i.key}`).join(', ');
        return `
          <div class="tx-row">
            <div class="tx-time">${time}</div>
            <div class="tx-items">${items}</div>
            <div class="tx-method">${icon}</div>
            <div class="tx-total">${sym}${(t.total||0).toLocaleString('es-MX')}</div>
            <button class="tx-delete-btn" onclick="deleteTx('${t.id}')" title="Eliminar">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
      }).join('')}
      ${txs.length > 100 ? `<p style="text-align:center;color:#9CA3AF;font-size:0.8rem;padding:8px;">Mostrando primeras 100 de ${txs.length} transacciones.</p>` : ''}
    </div>
  `;
}

async function deleteTx(id) {
  if (!confirm('¿Eliminar esta transacción?')) return;
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) throw new Error();
    loadAnalytics();
    showToast('Transacción eliminada');
  } catch {
    showToast('❌ Error al eliminar');
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
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

  // Analítica
  loadAnalytics();
  document.getElementById('analyticsMonth')?.addEventListener('change', loadAnalytics);
});
