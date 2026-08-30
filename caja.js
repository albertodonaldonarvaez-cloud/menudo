'use strict';
/**
 * CAJA.JS — Terminal POS v2.2
 * Rediseñado: badge en botones, animación de total, IDs nuevos.
 * v2.2: botones de precio libre (Menudo Suelto, Barbacoa Suelta)
 */

const PRODUCT_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan'];

let storeConfig   = {};
let ticket        = [];       // [{ key, title, emoji, price, priceNote, qty }]
let paymentMethod = 'efectivo';
let mobileTab     = 'productos'; // 'productos' | 'ticket'

// ── Tabs móvil ────────────────────────────────────────────────
function switchMobileTab(tab) {
  mobileTab = tab;
  const left  = document.getElementById('posLeftPanel');
  const right = document.getElementById('posRightPanel');
  const tProd = document.getElementById('mtabProductos');
  const tTick = document.getElementById('mtabTicket');

  if (!left || !right) return;

  if (tab === 'productos') {
    left.classList.remove('mobile-hidden');
    right.classList.add('mobile-hidden');
    tProd?.classList.add('active');
    tTick?.classList.remove('active');
  } else {
    left.classList.add('mobile-hidden');
    right.classList.remove('mobile-hidden');
    tTick?.classList.add('active');
    tProd?.classList.remove('active');
  }
}

function updateMobileTabBadge() {
  const badge = document.getElementById('mtabBadge');
  if (!badge) return;
  const total = ticket.reduce((s, t) => s + t.qty, 0);
  badge.textContent = total;
  badge.classList.toggle('show', total > 0);
}

// ── Config ────────────────────────────────────────────────────
async function loadConfig() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.products) return data;
    }
  } catch { /* offline */ }
  return { products: DEFAULT_STORE_DATA.products, business: DEFAULT_STORE_DATA.business };
}

// ── Reloj ─────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('posClock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

// ── Renderizado de botones de producto ────────────────────────
function renderProductButtons() {
  const grid = document.getElementById('posProductsGrid');
  if (!grid) return;

  // Botones de productos fijos
  const productBtns = PRODUCT_KEYS.map(key => {
    const p = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
    if (!p?.enabled) return '';
    return `
      <button class="pos-btn" id="posbtn-${key}" onclick="addToTicket('${key}')">
        <div class="pos-btn-qty-badge" id="posbadge-${key}">0</div>
        <div class="pos-btn-emoji">${p.emoji || '🍽️'}</div>
        <div class="pos-btn-name">${p.title}</div>
        <div class="pos-btn-price">$${p.price}</div>
        ${p.priceNote ? `<div class="pos-btn-note">${p.priceNote}</div>` : ''}
      </button>
    `;
  }).join('');

  // Botones de precio libre (Menudo Suelto + Barbacoa Suelta)
  const libreBtns = `
    <button class="pos-btn pos-btn-libre" onclick="openPriceModal('menudo')">
      <div class="pos-btn-qty-badge" id="posbadge-libre-menudo">0</div>
      <div class="pos-btn-emoji">🍲</div>
      <div class="pos-btn-name">Menudo Suelto</div>
      <div class="pos-btn-price">Precio libre ✏️</div>
    </button>
    <button class="pos-btn pos-btn-libre pos-btn-libre-barb" onclick="openPriceModal('barbacoa')">
      <div class="pos-btn-qty-badge" id="posbadge-libre-barbacoa">0</div>
      <div class="pos-btn-emoji">🥩</div>
      <div class="pos-btn-name">Barbacoa Suelta</div>
      <div class="pos-btn-price">Precio libre ✏️</div>
    </button>
  `;

  // Botones de promos dinámicas
  const activePromos = (storeConfig.promos || DEFAULT_STORE_DATA.promos || []).filter(p => p.enabled);
  const promoBtns = activePromos.length ? `
    <div class="pos-promos-divider" style="grid-column:1/-1;">
      <i class="fa-solid fa-tags"></i> Promos del Día
    </div>
    ${activePromos.map(p => `
      <button class="pos-btn pos-btn-promo" id="posbtn-${p.id}" onclick="addPromoToTicket('${p.id}')">
        <div class="pos-btn-qty-badge" id="posbadge-${p.id}">0</div>
        <div class="pos-btn-emoji">🎉</div>
        <div class="pos-btn-name">${p.title}</div>
        <div class="pos-btn-price">$${Number(p.price).toLocaleString('es-MX')}</div>
      </button>
    `).join('')}
  ` : '';

  grid.innerHTML = productBtns + libreBtns + promoBtns;
}

// ── Modal de precio libre ─────────────────────────────────────
const LIBRE_CONFIG = {
  menudo:   { prefix: 'menudo_libre',  title: 'Menudo Suelto',   emoji: '🍲', badgeId: 'posbadge-libre-menudo',   label: 'Menudo Suelto — ingresa el precio' },
  barbacoa: { prefix: 'barb_libre',    title: 'Barbacoa Suelta', emoji: '🥩', badgeId: 'posbadge-libre-barbacoa', label: 'Barbacoa Suelta — ingresa el precio' }
};
let _currentLibreType = 'menudo';

function openPriceModal(type) {
  _currentLibreType = type || 'menudo';
  const cfg   = LIBRE_CONFIG[_currentLibreType];
  const modal = document.getElementById('priceModal');
  const input = document.getElementById('priceModalInput');
  if (!modal || !input) return;
  // Actualizar label y emoji del modal
  const labelEl = document.getElementById('priceModalLabel');
  const emojiEl = document.getElementById('priceModalEmoji');
  if (labelEl) labelEl.textContent = cfg.label;
  if (emojiEl) emojiEl.textContent = cfg.emoji;
  input.value = '';
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 80);
}

function closePriceModal(e) {
  if (e && e.target !== document.getElementById('priceModal')) return;
  document.getElementById('priceModal')?.classList.add('hidden');
}

function confirmPriceModal() {
  const input = document.getElementById('priceModalInput');
  const price = parseFloat(input?.value);
  if (!price || price <= 0) { input?.focus(); input?.select(); return; }

  document.getElementById('priceModal')?.classList.add('hidden');

  const cfg = LIBRE_CONFIG[_currentLibreType];
  ticket.push({
    key:       `${cfg.prefix}_${Date.now()}`,
    title:     cfg.title,
    emoji:     cfg.emoji,
    price,
    priceNote: '',
    qty:       1
  });

  renderTicket();
  if (window.innerWidth < 640) switchMobileTab('ticket');
}

function updateLibreBadge() {
  Object.values(LIBRE_CONFIG).forEach(cfg => {
    const badge = document.getElementById(cfg.badgeId);
    if (!badge) return;
    const count = ticket
      .filter(t => t.key.startsWith(cfg.prefix))
      .reduce((s, t) => s + t.qty, 0);
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ── Ticket ────────────────────────────────────────────────────
function addToTicket(key) {
  const p = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
  if (!p) return;

  const existing = ticket.find(t => t.key === key);
  if (existing) {
    existing.qty++;
  } else {
    ticket.push({
      key,
      title:     p.title,
      emoji:     p.emoji || '',
      price:     Number(p.price) || 0,
      priceNote: p.priceNote || '',
      qty:       1
    });
  }

  renderTicket();
  flashBtn(key);
}

function addPromoToTicket(id) {
  const promos = storeConfig.promos || DEFAULT_STORE_DATA.promos || [];
  const p = promos.find(pr => pr.id === id);
  if (!p) return;

  const existing = ticket.find(t => t.key === id);
  if (existing) {
    existing.qty++;
  } else {
    ticket.push({
      key:      id,
      title:    p.title,
      emoji:    '🎉',
      price:    Number(p.price) || 0,
      priceNote: '',
      qty:      1
    });
  }

  renderTicket();
  flashBtn(id);
}

function changeQty(key, delta) {
  const item = ticket.find(t => t.key === key);
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  if (item.qty === 0) ticket = ticket.filter(t => t.key !== key);
  renderTicket();
}

function clearTicket() {
  ticket = [];
  renderTicket();
}

function getTotal() {
  return ticket.reduce((s, t) => s + t.price * t.qty, 0);
}

function flashBtn(key) {
  const btn = document.getElementById(`posbtn-${key}`);
  if (!btn) return;
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 160);
}

function updateBadges() {
  PRODUCT_KEYS.forEach(key => {
    const badge = document.getElementById(`posbadge-${key}`);
    if (!badge) return;
    const item = ticket.find(t => t.key === key);
    if (item && item.qty > 0) {
      badge.textContent = item.qty;
      badge.classList.add('show');
    } else {
      badge.classList.remove('show');
    }
  });
}

function renderTicket() {
  const list      = document.getElementById('ticketList');
  const totalEl   = document.getElementById('ticketTotal');
  const cobrarBtn = document.getElementById('cobrarBtn');
  const cobrarLbl = document.getElementById('cobrarLabel');
  if (!list) return;

  const total = getTotal();

  if (ticket.length === 0) {
    list.innerHTML = `
      <div class="ticket-empty">
        <i class="fa-regular fa-receipt"></i>
        <span>Ticket vacío<br>Toca un producto</span>
      </div>
    `;
  } else {
    list.innerHTML = ticket.map(item => `
      <div class="ticket-row">
        <div class="ticket-row-emoji">${item.emoji}</div>
        <div class="ticket-row-info">
          <div class="ticket-row-name">${item.title}</div>
          <div class="ticket-row-unit">$${item.price}${item.priceNote ? ' '+item.priceNote : ''} c/u</div>
        </div>
        <div class="ticket-row-ctrl">
          <button class="qty-btn minus" onclick="changeQty('${item.key}', -1)" title="Quitar uno">−</button>
          <span class="ticket-qty">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.key}', 1)" title="Agregar uno">+</button>
          <span class="ticket-sub">$${(item.price * item.qty).toLocaleString('es-MX')}</span>
        </div>
      </div>
    `).join('');
  }

  // Total con animación
  if (totalEl) {
    totalEl.textContent = `$${total.toLocaleString('es-MX')}`;
    totalEl.classList.remove('pop');
    void totalEl.offsetWidth; // reflow
    totalEl.classList.add('pop');
  }

  // Botón cobrar
  if (cobrarBtn) cobrarBtn.disabled = ticket.length === 0;
  if (cobrarLbl) cobrarLbl.textContent = ticket.length
    ? `Cobrar $${total.toLocaleString('es-MX')}`
    : 'Cobrar $0';

  updateBadges();
  updateMobileTabBadge();
  updateLibreBadge();
}

// ── Pago ──────────────────────────────────────────────────────
function selectPayment(method, btn) {
  paymentMethod = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── Completar venta ───────────────────────────────────────────
async function completeSale() {
  if (ticket.length === 0) return;
  const now   = new Date();
  const total = getTotal();

  const tx = {
    id:            'tx_' + Date.now(),
    timestamp:     now.toISOString(),
    date:          now.toISOString().slice(0, 10),
    hour:          now.getHours(),
    items:         ticket.map(t => ({
      key:      t.key,
      title:    t.title,
      price:    t.price,
      qty:      t.qty,
      subtotal: t.price * t.qty
    })),
    total,
    paymentMethod
  };

  // Enviar al servidor (sin bloquear la UI)
  fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(tx)
  }).then(r => {
    if (r.status === 401) window.location.href = '/login';
  }).catch(e => console.warn('Tx sync error:', e));

  // Mostrar modal
  const methodIcons = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', transferencia: '📱 Transferencia' };
  const amountEl = document.getElementById('modalAmount');
  const methodEl = document.getElementById('modalMethod');
  if (amountEl) amountEl.textContent = `$${total.toLocaleString('es-MX')}`;
  if (methodEl) methodEl.textContent = methodIcons[paymentMethod] || paymentMethod;

  const modal = document.getElementById('posModal');
  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('posModal');
  if (modal) modal.classList.add('hidden');
  clearTicket();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  storeConfig = await loadConfig();

  // Nombre del negocio
  const nameEl = document.getElementById('posBusinessName');
  if (nameEl && storeConfig.business?.name) {
    nameEl.textContent = storeConfig.business.name;
  }

  renderProductButtons();
  renderTicket();
  updateClock();
  setInterval(updateClock, 30_000);
});
