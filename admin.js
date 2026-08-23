/**
 * LÓGICA DEL PANEL DE ADMINISTRACIÓN (admin.js)
 * Administra títulos de platillos, guisados, fotos reales, descripciones, precios, datos,
 * carteles para mesas (3x Hoja) y volantes publicitarios para calle (4x Hoja).
 */

const STORAGE_KEY = 'menudo_store_config_v1';
let storeData = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));

/** Carga config del servidor → localStorage → defaults */
async function loadStoreDataAsync() {
  try {
    const res = await fetch('/api/config', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.business) {
        if (!data.titles)       data.titles       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.titles));
        if (!data.images)       data.images       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.images));
        if (!data.descriptions) data.descriptions = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.descriptions));
        if (!data.business.address) data.business.address = DEFAULT_STORE_DATA.business.address;
        if (!data.combos)       data.combos       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.combos));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    console.warn('Servidor no disponible, usando localStorage:', e);
  }
  // Fallback localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.titles)       parsed.titles       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.titles));
      if (!parsed.images)       parsed.images       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.images));
      if (!parsed.descriptions) parsed.descriptions = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.descriptions));
      if (!parsed.business.address) parsed.business.address = DEFAULT_STORE_DATA.business.address;
      if (!parsed.combos)       parsed.combos       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.combos));
      return parsed;
    } catch (e) { /* ignorar */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
}

/** Guarda en localStorage Y en el servidor para sincronizar todos los dispositivos */
function saveStoreData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storeData));
  // Guardar en servidor → todos los celulares verán el cambio al recargar
  fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storeData)
  })
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
  .catch(e => console.warn('No se pudo sincronizar al servidor:', e));

  populateAdminForm();
  populateTitlesAndDescriptionsForm();
  renderAdminGuisados();
  renderAdminCombos();
  renderImagePreviews();
  populatePrintTargets();
}

document.addEventListener('DOMContentLoaded', async () => {
  storeData = await loadStoreDataAsync();
  initTabs();
  renderAdminGuisados();
  renderAdminCombos();
  populateAdminForm();
  populateTitlesAndDescriptionsForm();
  renderImagePreviews();
  initAdminEvents();
  initQRCode();
  populatePrintTargets();
});

// ==========================================
// TABS DE NAVEGACIÓN
// ==========================================
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

// ==========================================
// TÍTULOS, FOTOS REALES & DESCRIPCIONES
// ==========================================
function renderImagePreviews() {
  const keys = ['menudo', 'gorditas', 'burritos', 'cafeOlla', 'refresco'];
  keys.forEach(k => {
    const el = document.getElementById(`prev-${k}`);
    if (el) {
      el.src = (storeData.images && storeData.images[k]) || DEFAULT_STORE_DATA.images[k];
    }
  });
}

function populateTitlesAndDescriptionsForm() {
  const t = (storeData.titles) || DEFAULT_STORE_DATA.titles;
  const d = (storeData.descriptions) || DEFAULT_STORE_DATA.descriptions;
  
  // Títulos
  if (document.getElementById('title-menudo')) document.getElementById('title-menudo').value = t.menudo || '';
  if (document.getElementById('title-gorditas')) document.getElementById('title-gorditas').value = t.gorditas || '';
  if (document.getElementById('title-burritos')) document.getElementById('title-burritos').value = t.burritos || '';
  if (document.getElementById('title-cafeOlla')) document.getElementById('title-cafeOlla').value = t.cafeOlla || '';
  if (document.getElementById('title-refresco')) document.getElementById('title-refresco').value = t.refresco || '';

  // Descripciones
  if (document.getElementById('desc-menudo')) document.getElementById('desc-menudo').value = d.menudo || '';
  if (document.getElementById('desc-gorditas')) document.getElementById('desc-gorditas').value = d.gorditas || '';
  if (document.getElementById('desc-burritos')) document.getElementById('desc-burritos').value = d.burritos || '';
  if (document.getElementById('desc-cafeOlla')) document.getElementById('desc-cafeOlla').value = d.cafeOlla || '';
  if (document.getElementById('desc-refresco')) document.getElementById('desc-refresco').value = d.refresco || '';
}

function saveTitlesAndDescriptions(e) {
  e.preventDefault();

  if (!storeData.titles) storeData.titles = {};
  if (!storeData.descriptions) storeData.descriptions = {};
  
  // Guardar Títulos
  storeData.titles.menudo = document.getElementById('title-menudo').value.trim() || DEFAULT_STORE_DATA.titles.menudo;
  storeData.titles.gorditas = document.getElementById('title-gorditas').value.trim() || DEFAULT_STORE_DATA.titles.gorditas;
  storeData.titles.burritos = document.getElementById('title-burritos').value.trim() || DEFAULT_STORE_DATA.titles.burritos;
  storeData.titles.cafeOlla = document.getElementById('title-cafeOlla').value.trim() || DEFAULT_STORE_DATA.titles.cafeOlla;
  storeData.titles.refresco = document.getElementById('title-refresco').value.trim() || DEFAULT_STORE_DATA.titles.refresco;

  // Guardar Descripciones
  storeData.descriptions.menudo = document.getElementById('desc-menudo').value.trim();
  storeData.descriptions.gorditas = document.getElementById('desc-gorditas').value.trim();
  storeData.descriptions.burritos = document.getElementById('desc-burritos').value.trim();
  storeData.descriptions.cafeOlla = document.getElementById('desc-cafeOlla').value.trim();
  storeData.descriptions.refresco = document.getElementById('desc-refresco').value.trim();

  saveStoreData();
  showToast('¡Títulos y descripciones guardados con éxito!');
}

function handleImageUpload(event, key) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    
    if (!storeData.images) storeData.images = {};
    storeData.images[key] = dataUrl;

    saveStoreData();
    showToast(`¡Foto de ${getDishName(key)} actualizada con éxito!`);
  };
  reader.readAsDataURL(file);
}

function resetSingleImage(key) {
  if (confirm(`¿Restablecer la foto predeterminada para ${getDishName(key)}?`)) {
    if (!storeData.images) storeData.images = {};
    storeData.images[key] = DEFAULT_STORE_DATA.images[key];
    saveStoreData();
    showToast(`Foto de ${getDishName(key)} restablecida`);
  }
}

function getDishName(key) {
  const names = {
    menudo: 'Menudo',
    gorditas: 'Gorditas',
    burritos: 'Burritos',
    cafeOlla: 'Café de Olla',
    refresco: 'Refrescos'
  };
  return names[key] || 'platillo';
}

// ==========================================
// GUISADOS DEL DÍA (COMPARTIDOS)
// ==========================================
function renderAdminGuisados() {
  const container = document.getElementById('adminGuisadosList');
  if (!container) return;

  if (!storeData.guisados || storeData.guisados.length === 0) {
    container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">No tienes ningún guisado registrado. Agrega uno arriba.</p>`;
    return;
  }

  container.innerHTML = storeData.guisados.map(g => `
    <div class="admin-guisado-row">
      <div class="admin-guisado-title">
        <strong>${g.name}</strong>
        <span class="guisado-status-tag" style="margin-left: 8px;">
          ${g.available ? '<i class="fa-solid fa-check" style="color:var(--color-accent-green-dark)"></i> Disponible' : '<i class="fa-solid fa-ban" style="color:var(--color-danger)"></i> Agotado'}
        </span>
      </div>
      <div class="admin-guisado-controls">
        <label class="switch-label" title="${g.available ? 'Disponible' : 'Agotado'}">
          <input type="checkbox" ${g.available ? 'checked' : ''} onchange="toggleGuisadoAvailability('${g.id}')">
          <span class="switch-slider"></span>
        </label>
        <button type="button" class="btn-del-guisado" onclick="deleteGuisado('${g.id}')" title="Eliminar guisado">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function toggleGuisadoAvailability(id) {
  const g = storeData.guisados.find(x => x.id === id);
  if (g) {
    g.available = !g.available;
    saveStoreData();
    showToast(`Guisado "${g.name}" ${g.available ? 'marcado como Disponible' : 'marcado como Agotado'}`);
  }
}

function addGuisado(name) {
  const newId = 'g_' + Date.now();
  storeData.guisados.push({
    id: newId,
    name: name.trim(),
    available: true
  });
  saveStoreData();
  showToast(`¡Guisado "${name}" agregado con éxito!`);
}

function deleteGuisado(id) {
  const g = storeData.guisados.find(x => x.id === id);
  if (confirm(`¿Estás seguro de eliminar el guisado "${g ? g.name : ''}"?`)) {
    storeData.guisados = storeData.guisados.filter(x => x.id !== id);
    saveStoreData();
    showToast('Guisado eliminado');
  }
}

// ==========================================
// PRECIOS & DATOS DEL NEGOCIO
// ==========================================
function populateAdminForm() {
  const b = storeData.business;
  const p = storeData.prices;

  // Precios
  document.getElementById('priceMenudo').value = p.menudo;
  document.getElementById('priceGordita').value = p.gordita;
  document.getElementById('priceBurrito').value = p.burrito;
  document.getElementById('priceCafe').value = p.cafeOlla;
  document.getElementById('priceRefresco').value = p.refresco;

  // Datos
  document.getElementById('adminName').value = b.name;
  document.getElementById('adminSlogan').value = b.slogan;
  document.getElementById('adminStatus').value = b.isOpen ? 'open' : 'closed';
  document.getElementById('adminSchedule').value = b.schedule;
  if (document.getElementById('adminAddress')) {
    document.getElementById('adminAddress').value = b.address || '';
  }
}

function populatePrintTargets() {
  const b = storeData.business;
  const p = storeData.prices;
  const t = (storeData.titles) || DEFAULT_STORE_DATA.titles;

  // Datos de Negocio
  document.querySelectorAll('.printNameTarget').forEach(el => el.textContent = b.name);
  document.querySelectorAll('.printSloganTarget').forEach(el => el.textContent = b.slogan);
  document.querySelectorAll('.printScheduleTarget').forEach(el => el.textContent = b.schedule);
  document.querySelectorAll('.printAddressTarget').forEach(el => el.textContent = `📍 ${b.address || '¡Visítanos!'}`);

  // Precios
  document.querySelectorAll('.printMenudoPriceTarget').forEach(el => el.textContent = `$${p.menudo}`);
  document.querySelectorAll('.printGorditaPriceTarget').forEach(el => el.textContent = `$${p.gordita} c/u`);
  document.querySelectorAll('.printBurritoPriceTarget').forEach(el => el.textContent = `$${p.burrito} c/u`);
  document.querySelectorAll('.printCafePriceTarget').forEach(el => el.textContent = `$${p.cafeOlla}`);

  // Títulos en Carteles de Mesa
  document.querySelectorAll('.chip-title-menudo').forEach(el => el.textContent = `🍲 ${t.menudo || 'Menudo'}`);
  document.querySelectorAll('.chip-title-gorditas').forEach(el => el.textContent = `🫓 ${t.gorditas || 'Gorditas'}`);
  document.querySelectorAll('.chip-title-burritos').forEach(el => el.textContent = `🌯 ${t.burritos || 'Burritos'}`);
  document.querySelectorAll('.chip-title-cafe').forEach(el => el.textContent = `☕ ${t.cafeOlla || 'Café de Olla'}`);
  document.querySelectorAll('.chip-title-refresco').forEach(el => el.textContent = `🧊 ${t.refresco || 'Refrescos'}`);

  // Títulos en Volantes de Calle
  document.querySelectorAll('.flyer-title-menudo').forEach(el => el.textContent = t.menudo || 'Menudo Tradicional');
  document.querySelectorAll('.flyer-title-gorditas').forEach(el => el.textContent = t.gorditas || 'Gorditas de Guisado');
  document.querySelectorAll('.flyer-title-burritos').forEach(el => el.textContent = t.burritos || 'Burritos Norteños');
  document.querySelectorAll('.flyer-title-cafe').forEach(el => el.textContent = t.cafeOlla || 'Café de Olla');
}

function saveAdminPricesAndData(e) {
  e.preventDefault();

  // Guardar Precios
  storeData.prices.menudo = Number(document.getElementById('priceMenudo').value) || 0;
  storeData.prices.gordita = Number(document.getElementById('priceGordita').value) || 0;
  storeData.prices.burrito = Number(document.getElementById('priceBurrito').value) || 0;
  storeData.prices.cafeOlla = Number(document.getElementById('priceCafe').value) || 0;
  storeData.prices.refresco = Number(document.getElementById('priceRefresco').value) || 0;

  // Guardar Datos
  storeData.business.name = document.getElementById('adminName').value.trim();
  storeData.business.slogan = document.getElementById('adminSlogan').value.trim();
  storeData.business.isOpen = document.getElementById('adminStatus').value === 'open';
  storeData.business.schedule = document.getElementById('adminSchedule').value.trim();
  if (document.getElementById('adminAddress')) {
    storeData.business.address = document.getElementById('adminAddress').value.trim();
  }

  saveStoreData();
  showToast('¡Precios y datos del negocio guardados!');
}

function resetToDefault() {
  if (confirm('¿Deseas restablecer todos los títulos, precios, fotos, descripciones y guisados a los valores de fábrica?')) {
    storeData = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
    saveStoreData();
    showToast('Valores originales restablecidos');
    initQRCode();
  }
}

// ==========================================
// CÓDIGOS QR (CARTELES DE MESA & VOLANTES)
// ==========================================
function getMenuUrl() {
  const currentUrl = window.location.href;
  return currentUrl.replace('admin.html', 'index.html');
}

function initQRCode() {
  const qrContainer = document.getElementById('qrcodeBox');
  const qrInput = document.getElementById('customQrUrl');

  if (!qrInput.value) {
    qrInput.value = getMenuUrl();
  }

  const urlToUse = qrInput.value || getMenuUrl();

  // 1. Preview en pantalla
  if (qrContainer) {
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: urlToUse,
      width: 160,
      height: 160,
      colorDark: "#C84B31",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  // 2. Carteles de Mesa (3x Hoja)
  ['printQrImage1', 'printQrImage2', 'printQrImage3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '';
      new QRCode(el, {
        text: urlToUse,
        width: 125,
        height: 125,
        colorDark: "#1E2022",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  });

  // 3. Volantes de Calle (4x Hoja)
  ['flyerQr1', 'flyerQr2', 'flyerQr3', 'flyerQr4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = '';
      new QRCode(el, {
        text: urlToUse,
        width: 105,
        height: 105,
        colorDark: "#1E2022",
        colorLight: "#FFFFFF",
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  });
}

// ==========================================
// COMBOS ESPECIALES — CRUD
// ==========================================
function renderAdminCombos() {
  const container = document.getElementById('adminCombosList');
  if (!container) return;

  if (!storeData.combos) storeData.combos = [];

  if (storeData.combos.length === 0) {
    container.innerHTML = `<p style="color:#888;text-align:center;padding:24px;">Aún no tienes combos. Usa el formulario de arriba para agregar el primero.</p>`;
    return;
  }

  container.innerHTML = storeData.combos.map(combo => {
    const includesHtml = (combo.includes || []).map(item => `<li>${item}</li>`).join('');
    const badgeText = combo.badge ? `<span class="admin-combo-badge">${combo.badge}</span>` : '<span style="color:#aaa;font-size:0.8rem;">Sin etiqueta</span>';
    return `
      <div class="admin-combo-row">
        <div class="admin-combo-info">
          <div class="admin-combo-top">
            <strong class="admin-combo-name">🎁 ${combo.name}</strong>
            ${badgeText}
            <span class="admin-combo-price">$${combo.price} MXN</span>
          </div>
          ${combo.description ? `<p class="admin-combo-desc">${combo.description}</p>` : ''}
          <ul class="admin-combo-includes">${includesHtml}</ul>
        </div>
        <div class="admin-combo-controls">
          <label class="switch-label" title="${combo.available ? 'Disponible' : 'No disponible'}">
            <input type="checkbox" ${combo.available ? 'checked' : ''} onchange="toggleComboAvailability('${combo.id}')">
            <span class="switch-slider"></span>
          </label>
          <button type="button" class="btn-del-guisado" onclick="deleteCombo('${combo.id}')" title="Eliminar combo">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function addCombo({ name, price, description, badge, includes }) {
  if (!storeData.combos) storeData.combos = [];
  storeData.combos.push({
    id: 'c_' + Date.now(),
    name,
    price,
    description: description || '',
    badge: badge || '',
    includes: includes || [],
    available: true
  });
  saveStoreData();
  showToast(`¡Combo "${name}" agregado con éxito!`);
}

function toggleComboAvailability(id) {
  const combo = storeData.combos.find(c => c.id === id);
  if (combo) {
    combo.available = !combo.available;
    saveStoreData();
    showToast(`Combo "${combo.name}" ${combo.available ? 'activado' : 'desactivado'}`);
  }
}

function deleteCombo(id) {
  const combo = storeData.combos.find(c => c.id === id);
  if (confirm(`¿Eliminar el combo "${combo ? combo.name : ''}"?`)) {
    storeData.combos = storeData.combos.filter(c => c.id !== id);
    saveStoreData();
    showToast('Combo eliminado');
  }
}

// ==========================================
// ACCIONES DE IMPRESIÓN SEPARADAS
// ==========================================
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

// ==========================================
// EVENT LISTENERS
// ==========================================
function initAdminEvents() {
  // Formulario Agregar Guisado
  document.getElementById('addGuisadoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newGuisadoName');
    if (input.value.trim()) {
      addGuisado(input.value);
      input.value = '';
    }
  });

  // Formulario Agregar Combo
  document.getElementById('addComboForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name  = document.getElementById('newComboName').value.trim();
    const price = Number(document.getElementById('newComboPrice').value) || 0;
    const desc  = document.getElementById('newComboDesc').value.trim();
    const badge = document.getElementById('newComboBadge').value.trim();
    const raw   = document.getElementById('newComboIncludes').value;
    const includes = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (name && price > 0) {
      addCombo({ name, price, description: desc, badge, includes });
      document.getElementById('addComboForm').reset();
    }
  });

  // Formulario Títulos & Descripciones
  document.getElementById('descriptionsForm').addEventListener('submit', saveTitlesAndDescriptions);

  // Formulario Precios & Datos
  document.getElementById('adminPricesForm').addEventListener('submit', saveAdminPricesAndData);

  // Botón Restablecer
  document.getElementById('resetDataBtn').addEventListener('click', resetToDefault);

  // URL del QR
  document.getElementById('customQrUrl').addEventListener('input', () => {
    initQRCode();
  });

  // Imprimir Carteles de Mesa (3x Hoja)
  document.getElementById('printTableCardsBtn').addEventListener('click', printTableCards);

  // Imprimir Volantes de Calle (4x Hoja)
  document.getElementById('printStreetFlyersBtn').addEventListener('click', printStreetFlyers);
}

// Toast notification
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toast.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2300);
}
