'use strict';
/**
 * CAJA.JS — Terminal POS v2.1
 * Rediseñado: badge en botones, animación de total, IDs nuevos.
 */

const PRODUCT_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas'];

let storeConfig   = {};
let ticket        = [];       // [{ key, title, emoji, price, priceNote, qty }]
let paymentMethod = 'efectivo';

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

  grid.innerHTML = PRODUCT_KEYS.map(key => {
    const p = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
    if (!p?.enabled) return '';

    return `
      <button class="pos-btn" id="posbtn-${key}" onclick="addToTicket('${key}')">
        <div class="pos-btn-qty-badge" id="posbadge-${key}">0</div>
        <div class="pos-btn-emoji">${p.emoji || '🍽️'}</div>
        <div class="pos-btn-name">${p.title}</div>
        <div class="pos-btn-price">$${p.price}${p.priceNote ? '' : ''}</div>
        ${p.priceNote ? `<div class="pos-btn-note">${p.priceNote}</div>` : ''}
      </button>
    `;
  }).join('');
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
