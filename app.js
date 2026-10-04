'use strict';
/**
 * APP.JS - Menú Digital (lado público) v3.0
 * Todas las secciones y la navegación por categorías se generan
 * dinámicamente desde la configuración del servidor (/api/config),
 * así que cualquier cambio de precio/texto/foto en el Admin se refleja aquí.
 * Auto-detecta abierto/cerrado según horario configurado en admin.
 */

const PRODUCT_KEYS_PUBLIC = ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan', 'carlota', 'arrozconleche'];
const STORAGE_KEY = 'menudo_store_config_v2';
const CONFIG_REFRESH_MS = 5 * 60 * 1000;
let storeData = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
let statusTimer = null;
let lastConfigJson = '';

// Categorías del menú público (en orden de aparición)
const MENU_CATEGORIES = [
  { id: 'platillos', emoji: '🍽️', label: 'Platillos',      subtitle: 'Recién hechos y bien calientitos',        layout: 'grid' },
  { id: 'bebidas',   emoji: '☕',  label: 'Bebidas y pan',  subtitle: 'Para acompañar tu comida',                layout: 'compact' },
  { id: 'postres',   emoji: '🍰', label: 'Postres',        subtitle: 'El toque dulce para cerrar con broche de oro', layout: 'compact' },
  { id: 'extras',    emoji: '✨', label: 'Más opciones',   subtitle: 'Productos adicionales del día',           layout: 'grid' },
  { id: 'promos',    emoji: '🎉', label: 'Promos',         subtitle: '¡Aprovecha nuestros paquetes especiales!', layout: 'promos' }
];

const KEY_CATEGORY = {
  menudo: 'platillos', birria: 'platillos', tacos: 'platillos', quesadillas: 'platillos',
  refresco: 'bebidas', cafe: 'bebidas', pan: 'bebidas',
  carlota: 'postres', arrozconleche: 'postres'
};

// ── Utilidades ──
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(n) {
  const sym = storeData.business?.currencySymbol || '$';
  const num = Number(n) || 0;
  return sym + num.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function emojiPlaceholder(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#FFF4E5'/><stop offset='1' stop-color='#FFEDE9'/></linearGradient></defs><rect width='160' height='100' fill='url(#g)'/><text x='80' y='64' font-size='44' text-anchor='middle'>${emoji || '🍽️'}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ── Migración de datos ──
function migrateData(data) {
  if (!data) return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
  if (data.products && data.products.menudo !== undefined) {
    return ensureAllFields(data);
  }
  // Formato viejo - preservar nombre/slogan del negocio
  const fresh = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
  if (data.business) {
    fresh.business.name   = data.business.name   || fresh.business.name;
    fresh.business.slogan = data.business.slogan || fresh.business.slogan;
  }
  return fresh;
}

function ensureAllFields(data) {
  const def = DEFAULT_STORE_DATA;
  if (!data.business) data.business = JSON.parse(JSON.stringify(def.business));
  if (!data.schedule || !Array.isArray(data.schedule.days)) {
    data.schedule = JSON.parse(JSON.stringify(def.schedule));
  }
  // Asegurar que todos los productos por defecto existen
  Object.keys(def.products).forEach(k => {
    if (!data.products[k]) data.products[k] = JSON.parse(JSON.stringify(def.products[k]));
  });
  if (!Array.isArray(data.caja))          data.caja          = [];
  if (!Array.isArray(data.promos))        data.promos        = JSON.parse(JSON.stringify(def.promos));
  if (!Array.isArray(data.extraProducts)) data.extraProducts = [];
  return data;
}

// ── Carga de datos del servidor ──
async function fetchServerConfig() {
  const res = await fetch('/api/config', { cache: 'no-store' });
  if (!res.ok) return null;
  const raw = await res.json();
  if (!raw || Object.keys(raw).length === 0) return null;
  return raw;
}

async function loadStoreDataAsync() {
  try {
    const raw = await fetchServerConfig();
    if (raw) {
      lastConfigJson = JSON.stringify(raw);
      const migrated = migrateData(raw);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch { /* cuota */ }
      return migrated;
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

// ── Auto abierto / cerrado ──
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
  const badge     = document.getElementById('statusBadge');
  const statusTxt = document.getElementById('statusText');
  const headSched = document.getElementById('headerSchedule');
  const heroSched = document.getElementById('heroSchedule');
  const footSched = document.getElementById('footerSchedule');
  if (!badge) return;

  const isOpen   = checkIsOpen(storeData.schedule);
  const schedTxt = storeData.schedule?.displayText || '';

  badge.className = 'pm-status ' + (isOpen ? 'is-open' : 'is-closed');
  if (statusTxt) statusTxt.textContent = isOpen ? 'Abierto ahora' : 'Cerrado ahora';
  if (headSched) headSched.innerHTML = `<i class="fa-regular fa-clock"></i> ${escapeHtml(schedTxt)}`;
  if (heroSched) {
    heroSched.hidden = !schedTxt;
    heroSched.innerHTML = `<i class="fa-regular fa-calendar"></i> ${escapeHtml(schedTxt)}`;
  }
  if (footSched) footSched.textContent = schedTxt ? '🕐 ' + schedTxt : '';
}

// ── Construcción del modelo del menú ──
function normalizeItem(p, key, isExtra) {
  const def = (!isExtra && DEFAULT_STORE_DATA.products[key]) || {};
  return {
    key,
    isExtra,
    emoji:       p.emoji || def.emoji || '🍽️',
    title:       p.title || def.title || '',
    description: p.description || '',
    price:       Number(p.price) || 0,
    priceNote:   p.priceNote || '',
    badge:       p.badge || '',
    image:       p.image || def.image || '',
    fallbackImg: def.image || '',
    category:    p.category || def.category || '',
    calcMode:    p.calcMode || def.calcMode || ''
  };
}

function categoryForItem(item) {
  const c = String(item.category || '').toLowerCase();
  if (c === 'postre' || c === 'postres') return 'postres';
  if (c === 'bebida' || c === 'bebidas') return 'bebidas';
  if (item.isExtra) return 'extras';
  return KEY_CATEGORY[item.key] || 'platillos';
}

function buildMenuModel() {
  const groups = {};
  MENU_CATEGORIES.forEach(c => { groups[c.id] = []; });

  PRODUCT_KEYS_PUBLIC.forEach(key => {
    const p = storeData.products?.[key];
    if (!p || p.enabled === false) return;
    const item = normalizeItem(p, key, false);
    groups[categoryForItem(item)].push(item);
  });

  (storeData.extraProducts || []).forEach((ep, i) => {
    if (!ep || ep.enabled === false) return;
    const item = normalizeItem(ep, ep.id || `extra-${i}`, true);
    groups[categoryForItem(item)].push(item);
  });

  groups.promos = (storeData.promos || []).filter(pr => pr && pr.enabled !== false);
  return groups;
}

// ── Renderizado ──
function priceBlock(item) {
  if (item.calcMode === 'kilo') {
    return `
      <div class="pm-price">
        <span class="pm-price-amount">${escapeHtml(money(item.price))}</span>
        <span class="pm-price-unit">/ kg</span>
      </div>`;
  }
  if (!item.price) {
    return item.priceNote
      ? `<div class="pm-price"><span class="pm-price-unit">${escapeHtml(item.priceNote)}</span></div>`
      : '';
  }
  return `
    <div class="pm-price">
      <span class="pm-price-amount">${escapeHtml(money(item.price))}</span>
      ${item.priceNote ? `<span class="pm-price-unit">${escapeHtml(item.priceNote)}</span>` : ''}
    </div>`;
}

function imgTag(item, cls) {
  const placeholder = emojiPlaceholder(item.emoji);
  const src = item.image || item.fallbackImg || placeholder;
  const fallback = (item.fallbackImg && item.fallbackImg !== src) ? item.fallbackImg : '';
  return `<img class="${cls}" src="${escapeHtml(src)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"
            data-fallback="${escapeHtml(fallback)}" data-placeholder="${escapeHtml(placeholder)}">`;
}

function renderCard(item) {
  const isKilo = item.calcMode === 'kilo';
  return `
    <article class="pm-card${isKilo ? ' pm-card--featured' : ''}">
      <div class="pm-card-media">
        ${imgTag(item, 'pm-card-img')}
        <span class="pm-card-emoji" aria-hidden="true">${escapeHtml(item.emoji)}</span>
        ${item.badge ? `<span class="pm-badge">${escapeHtml(item.badge)}</span>` : ''}
      </div>
      <div class="pm-card-body">
        <h3 class="pm-card-title">${escapeHtml(item.title)}</h3>
        ${item.description ? `<p class="pm-card-desc">${escapeHtml(item.description)}</p>` : ''}
        <div class="pm-card-footer">
          ${priceBlock(item)}
          ${isKilo ? `<span class="pm-kilo-note"><i class="fa-solid fa-scale-balanced"></i> Pídela por monto o por kilo</span>` : ''}
        </div>
      </div>
    </article>`;
}

function renderCompactCard(item) {
  const isKilo = item.calcMode === 'kilo';
  return `
    <article class="pm-mini">
      <div class="pm-mini-media">
        ${imgTag(item, 'pm-mini-img')}
      </div>
      <div class="pm-mini-body">
        <h3 class="pm-mini-title"><span aria-hidden="true">${escapeHtml(item.emoji)}</span> ${escapeHtml(item.title)}</h3>
        ${item.description ? `<p class="pm-mini-desc">${escapeHtml(item.description)}</p>` : ''}
        <div class="pm-mini-footer">
          ${priceBlock(item)}
          ${item.badge ? `<span class="pm-mini-badge">${escapeHtml(item.badge)}</span>` : ''}
        </div>
        ${isKilo ? `<span class="pm-kilo-note"><i class="fa-solid fa-scale-balanced"></i> Pídela por monto o por kilo</span>` : ''}
      </div>
    </article>`;
}

function renderPromoCard(pr) {
  const price = Number(pr.price) || 0;
  return `
    <article class="pm-promo">
      <div class="pm-promo-icon" aria-hidden="true">${escapeHtml(pr.emoji || '🎉')}</div>
      <div class="pm-promo-body">
        <h3 class="pm-promo-title">${escapeHtml(pr.title || 'Promo')}</h3>
        ${pr.description ? `<p class="pm-promo-desc">${escapeHtml(pr.description)}</p>` : ''}
      </div>
      ${price ? `<div class="pm-promo-price">${escapeHtml(money(price))}</div>` : ''}
    </article>`;
}

function renderMenu() {
  const main = document.getElementById('menuMain');
  const track = document.getElementById('categoryNavTrack');
  if (!main) return;

  const groups = buildMenuModel();
  const visible = MENU_CATEGORIES.filter(c => groups[c.id] && groups[c.id].length);

  if (!visible.length) {
    main.innerHTML = `
      <div class="pm-empty">
        <div class="pm-empty-emoji">🍽️</div>
        <p>Estamos actualizando nuestro menú. ¡Pregunta a tu mesero por los platillos del día!</p>
      </div>`;
    if (track) track.innerHTML = '';
    return;
  }

  main.innerHTML = visible.map(cat => {
    const items = groups[cat.id];
    let body;
    if (cat.layout === 'promos')       body = `<div class="pm-promo-list">${items.map(renderPromoCard).join('')}</div>`;
    else if (cat.layout === 'compact') body = `<div class="pm-mini-list">${items.map(renderCompactCard).join('')}</div>`;
    else                               body = `<div class="pm-grid">${items.map(renderCard).join('')}</div>`;
    return `
      <section class="pm-section pm-section--${cat.id}" id="section-${cat.id}" data-category="${cat.id}">
        <header class="pm-section-head">
          <span class="pm-section-emoji" aria-hidden="true">${cat.emoji}</span>
          <div>
            <h2 class="pm-section-title">${escapeHtml(cat.label)}</h2>
            <p class="pm-section-sub">${escapeHtml(cat.subtitle)}</p>
          </div>
          <span class="pm-section-count">${items.length}</span>
        </header>
        ${body}
      </section>`;
  }).join('');

  if (track) {
    track.innerHTML = visible.map((cat, i) => `
      <button type="button" class="pm-tab${i === 0 ? ' active' : ''}" data-target="section-${cat.id}" role="tab">
        <span class="pm-tab-emoji" aria-hidden="true">${cat.emoji}</span> ${escapeHtml(cat.label)}
      </button>`).join('');
  }

  bindImageFallbacks(main);
  bindCategoryNav();
}

function bindImageFallbacks(root) {
  root.querySelectorAll('img[data-placeholder]').forEach(img => {
    img.addEventListener('error', function onErr() {
      const fb = img.dataset.fallback;
      if (fb && img.src !== fb) {
        img.dataset.fallback = '';
        img.src = fb;
        return;
      }
      img.removeEventListener('error', onErr);
      img.src = img.dataset.placeholder;
    });
  });
}

// ── Cabecera del negocio ──
function updateBusinessHeader() {
  const b = storeData.business || {};
  const defName = DEFAULT_STORE_DATA.business?.name || 'Barbacoa & Antojitos';
  const name = b.name || defName;
  const titleEl    = document.getElementById('pageTitle');
  const nameEl     = document.getElementById('businessName');
  const slogEl     = document.getElementById('businessSlogan');
  const footerName = document.getElementById('footerBusinessName');
  if (titleEl)    titleEl.textContent    = `${name} · Menú Digital`;
  if (nameEl)     nameEl.textContent     = name;
  if (slogEl) {
    slogEl.textContent = b.slogan || '';
    slogEl.hidden = !b.slogan;
  }
  if (footerName) footerName.textContent = name;
}

// ── Navegación por categorías ──
let navScrollHandler = null;

function getNavOffset() {
  const nav = document.getElementById('categoryNav');
  return (nav ? nav.offsetHeight : 0) + 12;
}

function setActiveTab(targetId) {
  const track = document.getElementById('categoryNavTrack');
  if (!track) return;
  track.querySelectorAll('.pm-tab').forEach(btn => {
    const on = btn.dataset.target === targetId;
    if (on && !btn.classList.contains('active')) {
      // Mantener visible el tab activo dentro de la barra horizontal
      const left = btn.offsetLeft - (track.clientWidth - btn.offsetWidth) / 2;
      track.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    }
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

function bindCategoryNav() {
  const track = document.getElementById('categoryNavTrack');
  if (!track) return;

  let clickLock = 0;
  track.querySelectorAll('.pm-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      setActiveTab(btn.dataset.target);
      clickLock = Date.now() + 800;
      const y = target.getBoundingClientRect().top + window.scrollY - getNavOffset();
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    });
  });

  if (navScrollHandler) window.removeEventListener('scroll', navScrollHandler);
  let ticking = false;
  navScrollHandler = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (Date.now() < clickLock) return;
      const sections = Array.from(document.querySelectorAll('.pm-section'));
      if (!sections.length) return;
      const line = getNavOffset() + 40;
      let current = sections[0].id;
      sections.forEach(s => { if (s.getBoundingClientRect().top <= line) current = s.id; });
      // Al llegar al final de la página, activar la última sección
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1].id;
      }
      setActiveTab(current);
    });
  };
  window.addEventListener('scroll', navScrollHandler, { passive: true });
}

// ── Refresco silencioso de configuración (cambios del admin) ──
async function refreshConfig() {
  try {
    const raw = await fetchServerConfig();
    if (!raw) return;
    const json = JSON.stringify(raw);
    if (json === lastConfigJson) return;
    lastConfigJson = json;
    storeData = migrateData(raw);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(storeData)); } catch { /* cuota */ }
    updateBusinessHeader();
    renderMenu();
    updateStatusBadge();
  } catch { /* sin conexión: conservar lo mostrado */ }
}

// ── Arranque ──
document.addEventListener('DOMContentLoaded', async () => {
  storeData = await loadStoreDataAsync();
  updateBusinessHeader();
  renderMenu();
  updateStatusBadge();

  statusTimer = setInterval(updateStatusBadge, 60 * 1000);
  setInterval(refreshConfig, CONFIG_REFRESH_MS);
});
