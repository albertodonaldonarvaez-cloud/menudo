'use strict';
/**
 * APP.JS — Menú Digital (lado público)
 * Carga config del servidor, renderiza productos y auto-detecta abierto/cerrado.
 */

const STORAGE_KEY = 'menudo_store_config_v2';
let storeData = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
let statusTimer = null;

// ── Migración de formato viejo al nuevo ──────────────────────
function migrateData(data) {
  if (!data) return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
  // Nuevo formato tiene `products`
  if (data.products && data.products.menudo !== undefined) {
    return ensureAllFields(data);
  }
  // Formato viejo — preservar nombre/slogan del negocio y resetear el resto
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
  Object.keys(def.products).forEach(k => {
    if (!data.products[k]) data.products[k] = JSON.parse(JSON.stringify(def.products[k]));
  });
  if (!Array.isArray(data.caja)) data.caja = [];
  return data;
}

// ── Carga de datos del servidor ───────────────────────────────
async function loadStoreDataAsync() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (res.ok) {
      const raw = await res.json();
      if (raw && Object.keys(raw).length > 0) {
        const migrated = migrateData(raw);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.warn('Servidor no disponible, usando caché local:', e);
  }
  // Fallback: localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return migrateData(JSON.parse(saved)); } catch { /* ignorar */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
}

// ── Auto abierto / cerrado ────────────────────────────────────
function checkIsOpen(schedule) {
  if (!schedule || !Array.isArray(schedule.days)) return false;
  const now  = new Date();
  const day  = now.getDay(); // 0=Dom … 6=Sáb
  if (!schedule.days.includes(day)) return false;

  const [oh, om] = (schedule.openTime  || '00:00').split(':').map(Number);
  const [ch, cm] = (schedule.closeTime || '23:59').split(':').map(Number);
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  return nowMin >= (oh * 60 + om) && nowMin < (ch * 60 + cm);
}

function updateStatusBadge() {
  const badge     = document.getElementById('statusBadge');
  const statusTxt = document.getElementById('statusText');
  const topSched  = document.getElementById('topSchedule');
  const footSched = document.getElementById('footerSchedule');
  if (!badge) return;

  const isOpen = checkIsOpen(storeData.schedule);
  const schedTxt = storeData.schedule?.displayText || '';

  badge.className = 'status-badge ' + (isOpen ? 'status-open' : 'status-closed');
  statusTxt.textContent = isOpen ? 'Abierto' : 'Cerrado';
  if (topSched)  topSched.textContent  = schedTxt;
  if (footSched) footSched.textContent = schedTxt ? '📅 ' + schedTxt : '';
}

// ── Renderizado de productos ──────────────────────────────────
function fmt(p, priceNote) {
  return `$${Number(p).toFixed(2).replace(/\.00$/, '')}${priceNote ? ' <small>' + priceNote + '</small>' : ''}`;
}

function renderProductCard(key) {
  const container = document.getElementById(`card-${key}`);
  if (!container) return;

  const p = storeData.products?.[key];
  if (!p || !p.enabled) {
    container.innerHTML = '';
    const section = document.getElementById(`section-${key}`);
    if (section) section.style.display = 'none';
    return;
  }

  const section = document.getElementById(`section-${key}`);
  if (section) section.style.display = '';

  container.innerHTML = `
    <article class="product-card">
      <div class="product-card-img-wrap">
        <img
          class="product-card-img"
          src="${p.image || DEFAULT_STORE_DATA.products[key].image}"
          alt="${p.title}"
          loading="lazy"
          onerror="this.src='${DEFAULT_STORE_DATA.products[key].image}'"
        >
        <div class="product-card-overlay"></div>
        <div class="product-card-emoji">${p.emoji || ''}</div>
      </div>
      <div class="product-card-body">
        <div class="product-card-header">
          <h2 class="product-card-title">${p.title}</h2>
          <div class="product-card-price">
            ${fmt(p.price, p.priceNote)}
          </div>
        </div>
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
        <p class="product-card-desc">${p.description}</p>
      </div>
    </article>
  `;
}

function renderAllProducts() {
  ['menudo', 'birria', 'tacos', 'quesadillas'].forEach(renderProductCard);
}

function updateBusinessHeader() {
  const b = storeData.business || {};
  const titleEl = document.getElementById('pageTitle');
  const nameEl  = document.getElementById('heroName');
  const slogEl  = document.getElementById('heroSlogan');
  if (titleEl) titleEl.textContent = b.name || 'Menú Digital';
  if (nameEl)  nameEl.textContent  = b.name || 'Birriería & Antojitos';
  if (slogEl)  slogEl.textContent  = b.slogan || '';
}

// ── Navegación por categorías ─────────────────────────────────
function initCategoryNav() {
  const buttons = document.querySelectorAll('.cat-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterSections(btn.dataset.category);
    });
  });
}

function filterSections(category) {
  const sections = document.querySelectorAll('.product-section');
  sections.forEach(s => {
    const key = s.dataset.product;
    const prod = storeData.products?.[key];
    if (!prod?.enabled) { s.style.display = 'none'; return; }
    if (category === 'all' || category === key) {
      s.style.display = '';
    } else {
      s.style.display = 'none';
    }
  });
}

// ── Arranque ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  storeData = await loadStoreDataAsync();
  updateBusinessHeader();
  renderAllProducts();
  updateStatusBadge();
  initCategoryNav();

  // Actualizar badge cada 60 segundos (detecta apertura/cierre en tiempo real)
  statusTimer = setInterval(updateStatusBadge, 60 * 1000);
});
