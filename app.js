'use strict';
/**
 * APP.JS — Menú Digital (lado público) v2.2
 * 3 productos activos: menudo, tacos de barbacoa, quesadillas de barbacoa
 * (birria y refresco deshabilitados — enabled:false en data.js)
 * Auto-detecta abierto/cerrado según horario configurado en admin.
 */

const PRODUCT_KEYS_PUBLIC = ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan'];
const STORAGE_KEY = 'menudo_store_config_v2';
let storeData = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
let statusTimer = null;


// ── Migración de datos ───────────────────────────────────────
function migrateData(data) {
  if (!data) return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
  if (data.products && data.products.menudo !== undefined) {
    return ensureAllFields(data);
  }
  // Formato viejo — preservar nombre/slogan del negocio
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
  // Asegurar que todos los productos por defecto existen
  Object.keys(def.products).forEach(k => {
    if (!data.products[k]) data.products[k] = JSON.parse(JSON.stringify(def.products[k]));
  });
  if (!Array.isArray(data.caja))   data.caja   = [];
  if (!Array.isArray(data.promos)) data.promos = JSON.parse(JSON.stringify(def.promos));
  return data;
}

// ── Carga de datos del servidor ──────────────────────────────
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
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { return migrateData(JSON.parse(saved)); } catch { /* ignorar */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
}

// ── Auto abierto / cerrado ───────────────────────────────────
function checkIsOpen(schedule) {
  if (!schedule || !Array.isArray(schedule.days)) return false;
  const now = new Date();
  const day = now.getDay();
  if (!schedule.days.includes(day)) return false;
  const [oh, om] = (schedule.openTime  || '00:00').split(':').map(Number);
  const [ch, cm] = (schedule.closeTime || '23:59').split(':').map(Number);
  const nowMin   = now.getHours() * 60 + now.getMinutes();
  return nowMin >= (oh * 60 + om) && nowMin < (ch * 60 + cm);
}

function updateStatusBadge() {
  const badge    = document.getElementById('statusBadge');
  const statusTxt = document.getElementById('statusText');
  const headSched = document.getElementById('headerSchedule');
  const footSched = document.getElementById('footerSchedule');
  if (!badge) return;

  const isOpen   = checkIsOpen(storeData.schedule);
  const schedTxt = storeData.schedule?.displayText || '';

  badge.className = 'status-pill ' + (isOpen ? '' : 'closed');
  if (statusTxt) statusTxt.textContent = isOpen ? 'Abierto Ahora' : 'Cerrado Ahora';
  if (headSched) headSched.innerHTML = schedTxt
    ? `<i class="fa-regular fa-clock"></i> ${schedTxt}`
    : `<i class="fa-regular fa-clock"></i>`;
  if (footSched) footSched.textContent = schedTxt ? '📅 ' + schedTxt : '';
}

// ── Renderizado de una card de producto ──────────────────────
function fmt(price, priceNote) {
  const n = Number(price);
  if (!n) return priceNote || '';
  return `$${n.toFixed(2).replace(/\.00$/, '')}${priceNote ? ' <small>' + priceNote + '</small>' : ''}`;
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

  const defaultImg = DEFAULT_STORE_DATA.products[key]?.image || '';
  const imgSrc = p.image || defaultImg;
  const priceHtml = fmt(p.price, p.priceNote);

  container.innerHTML = `
    <article class="product-card">
      <div class="product-card-img-wrap">
        <img
          class="product-card-img"
          src="${imgSrc}"
          alt="${p.title}"
          loading="lazy"
          onerror="this.src='${defaultImg}'"
        >
        <div class="product-card-overlay"></div>
        <div class="product-card-emoji">${p.emoji || ''}</div>
      </div>
      <div class="product-card-body">
        <div class="product-card-header">
          <h2 class="product-card-title">${p.title}</h2>
          ${priceHtml ? `<div class="product-card-price">${priceHtml}</div>` : ''}
        </div>
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
        <p class="product-card-desc">${p.description}</p>
      </div>
    </article>
  `;
}

function renderAllProducts() {
  PRODUCT_KEYS_PUBLIC.forEach(renderProductCard);
}

// ── Productos Extra (dinámicos) ───────────────────────────────
function renderExtraProductsPublic() {
  const extras = (storeData.extraProducts || []).filter(ep => ep.enabled);
  // Agrega una sección al final del main para los extras activos
  const existing = document.getElementById('section-extras');
  if (!extras.length) {
    if (existing) existing.style.display = 'none';
    return;
  }

  let section = existing;
  if (!section) {
    section = document.createElement('section');
    section.id = 'section-extras';
    section.className = 'menu-section';
    section.setAttribute('data-product', 'extras');
    section.innerHTML = `
      <div class="section-title">
        <div class="title-left">
          <h2><span class="section-emoji">🍽️</span> Más opciones</h2>
          <p class="section-subtitle">Productos adicionales del día</p>
        </div>
      </div>
      <div id="card-extras"></div>
    `;
    document.querySelector('main.main-content')?.appendChild(section);
  }

  section.style.display = '';
  const container = document.getElementById('card-extras');
  if (!container) return;

  container.innerHTML = extras.map(ep => `
    <article class="promo-pub-card">
      <div class="promo-pub-icon">${ep.emoji || '🍽️'}</div>
      <div class="promo-pub-body">
        <div class="promo-pub-header">
          <h3 class="promo-pub-title">${ep.title}</h3>
          <span class="promo-pub-price">$${Number(ep.price).toLocaleString('es-MX')}${ep.priceNote ? ' <small>' + ep.priceNote + '</small>' : ''}</span>
        </div>
        ${ep.description ? `<p class="promo-pub-desc">${ep.description}</p>` : ''}
      </div>
    </article>
  `).join('');
}

// ── Renderizado de Promos (array independiente) ──────────────
function renderPromos() {
  const container = document.getElementById('card-promos');
  const section   = document.getElementById('section-promos');
  if (!container || !section) return;

  const promos = (storeData.promos || []).filter(p => p.enabled);

  if (!promos.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  container.innerHTML = promos.map(p => `
    <article class="promo-pub-card">
      <div class="promo-pub-icon">🎉</div>
      <div class="promo-pub-body">
        <div class="promo-pub-header">
          <h3 class="promo-pub-title">${p.title}</h3>
          <span class="promo-pub-price">$${Number(p.price).toLocaleString('es-MX')}</span>
        </div>
        ${p.description ? `<p class="promo-pub-desc">${p.description}</p>` : ''}
      </div>
    </article>
  `).join('');
}

// ── Cabecera del negocio ─────────────────────────────────────
function updateBusinessHeader() {
  const b = storeData.business || {};
  const titleEl    = document.getElementById('pageTitle');
  const nameEl     = document.getElementById('businessName');
  const slogEl     = document.getElementById('businessSlogan');
  const footerName = document.getElementById('footerBusinessName');
  if (titleEl)    titleEl.textContent    = b.name   || 'Menú Digital';
  if (nameEl)     nameEl.textContent     = b.name   || 'Birriería & Antojitos';
  if (slogEl)     slogEl.textContent     = b.slogan || '';
  if (footerName) footerName.textContent = b.name   || 'Birriería & Antojitos';
}

// ── Navegación por categorías ────────────────────────────────
function initCategoryNav() {
  const buttons = document.querySelectorAll('.cat-tab');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterSections(btn.dataset.category);

      // Scroll suave a la primera sección visible
      const first = document.querySelector('.menu-section[style!="display: none;"]');
      if (first && btn.dataset.category !== 'all') {
        const target = document.getElementById(`section-${btn.dataset.category}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function filterSections(category) {
  const sections = document.querySelectorAll('.menu-section');
  sections.forEach(s => {
    const key  = s.dataset.product;
    const prod = storeData.products?.[key];
    if (!prod?.enabled) { s.style.display = 'none'; return; }
    s.style.display = (category === 'all' || category === key) ? '' : 'none';
  });
}

// ── Arranque ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  storeData = await loadStoreDataAsync();
  updateBusinessHeader();
  renderAllProducts();
  renderPromos();
  renderExtraProductsPublic();
  updateStatusBadge();
  initCategoryNav();

  statusTimer = setInterval(updateStatusBadge, 60 * 1000);
});
