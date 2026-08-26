'use strict';
/**
 * CAJA.JS — Terminal POS
 * Gestiona el ticket del cliente actual y envía la transacción al servidor.
 */

const PRODUCT_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas'];

let storeConfig    = {};  // config del servidor (precios, títulos, imágenes)
let ticket         = [];  // items del ticket actual  [{key, title, price, qty, emoji}]
let paymentMethod  = 'efectivo';

// ── Carga de config (precios actualizados) ───────────────────
async function loadConfig() {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.products) return data;
    }
  } catch { /* sin conexión: usar defaults */ }
  return { products: DEFAULT_STORE_DATA.products, business: DEFAULT_STORE_DATA.business };
}

// ── Reloj en tiempo real ─────────────────────────────────────
function updateClock() {
  const el = document.getElementById('posTime');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Renderizado de botones de productos ──────────────────────
function renderProductButtons() {
  const grid = document.getElementById('posProductsGrid');
  if (!grid) return;
  grid.innerHTML = PRODUCT_KEYS.map(key => {
    const p = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
    if (!p?.enabled) return '';
    const priceLabel = p.priceNote ? `$${p.price} ${p.priceNote}` : `$${p.price}`;
    return `
      <button class="pos-product-btn" onclick="addToTicket('${key}')" data-key="${key}">
        <div class="pos-prod-emoji">${p.emoji || '🍽️'}</div>
        <div class="pos-prod-name">${p.title}</div>
        <div class="pos-prod-price">${priceLabel}</div>
      </button>
    `;
  }).join('');
}

// ── Gestión del ticket ───────────────────────────────────────
function addToTicket(key) {
  const p = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
  if (!p) return;
  const existing = ticket.find(t => t.key === key);
  if (existing) {
    existing.qty++;
  } else {
    ticket.push({
      key,
      title: p.title,
      emoji: p.emoji || '',
      price: Number(p.price) || 0,
      priceNote: p.priceNote || '',
      qty: 1
    });
  }
  renderTicket();
  // Animación del botón
  const btn = document.querySelector(`[data-key="${key}"]`);
  if (btn) {
    btn.classList.add('pos-btn-flash');
    setTimeout(() => btn.classList.remove('pos-btn-flash'), 200);
  }
}

function changeQty(key, delta) {
  const item = ticket.find(t => t.key === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) ticket = ticket.filter(t => t.key !== key);
  renderTicket();
}

function clearTicket() {
  ticket = [];
  renderTicket();
}

function getTotal() {
  return ticket.reduce((sum, t) => sum + t.price * t.qty, 0);
}

function renderTicket() {
  const container = document.getElementById('posTicketItems');
  const totalEl   = document.getElementById('posTicketTotal');
  const cobrarBtn = document.getElementById('posCobrarBtn');
  const cobrarLbl = document.getElementById('posCobrarLabel');
  if (!container) return;

  const total = getTotal();

  if (ticket.length === 0) {
    container.innerHTML = '<p class="pos-ticket-empty">Sin artículos.<br>Toca un producto para agregar.</p>';
  } else {
    container.innerHTML = ticket.map(item => `
      <div class="pos-ticket-item">
        <div class="pos-ticket-item-info">
          <span class="pos-ticket-emoji">${item.emoji}</span>
          <div>
            <div class="pos-ticket-name">${item.title}</div>
            <div class="pos-ticket-unit">$${item.price}${item.priceNote ? ' '+item.priceNote : ''} c/u</div>
          </div>
        </div>
        <div class="pos-ticket-controls">
          <button class="pos-qty-btn" onclick="changeQty('${item.key}', -1)">−</button>
          <span class="pos-ticket-qty">${item.qty}</span>
          <button class="pos-qty-btn" onclick="changeQty('${item.key}', 1)">+</button>
          <span class="pos-ticket-sub">$${(item.price * item.qty).toLocaleString('es-MX')}</span>
        </div>
      </div>
    `).join('');
  }

  if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-MX')}`;
  if (cobrarBtn) cobrarBtn.disabled = ticket.length === 0;
  if (cobrarLbl) cobrarLbl.textContent = `Cobrar $${total.toLocaleString('es-MX')}`;
}

// ── Método de pago ───────────────────────────────────────────
function selectPayment(method, btn) {
  paymentMethod = method;
  document.querySelectorAll('.pos-pay-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── Completar venta ──────────────────────────────────────────
async function completeSale() {
  if (ticket.length === 0) return;

  const now   = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const total  = getTotal();

  const tx = {
    id:            'tx_' + Date.now(),
    timestamp:     now.toISOString(),
    date:          dateStr,
    hour:          now.getHours(),
    items:         ticket.map(t => ({
      key:         t.key,
      title:       t.title,
      price:       t.price,
      qty:         t.qty,
      subtotal:    t.price * t.qty
    })),
    total,
    paymentMethod
  };

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(tx)
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error('Error guardando transacción:', e);
    // Aunque falle el servidor, mostramos éxito (se perderá sync — offline fallback)
  }

  // Mostrar modal de confirmación
  const modalTotal  = document.getElementById('modalTotal');
  const modalMethod = document.getElementById('modalMethod');
  const modal       = document.getElementById('posModal');
  if (modalTotal)  modalTotal.textContent  = `$${total.toLocaleString('es-MX')}`;
  if (modalMethod) modalMethod.textContent  = {
    efectivo: '💵 Efectivo',
    tarjeta: '💳 Tarjeta',
    transferencia: '📱 Transferencia'
  }[paymentMethod] || paymentMethod;
  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('posModal');
  if (modal) modal.classList.add('hidden');
  clearTicket();
}

// ── Inicialización ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  storeConfig = await loadConfig();

  // Nombre del negocio en el header
  const nameEl = document.getElementById('posBusinessName');
  if (nameEl && storeConfig.business?.name) {
    nameEl.textContent = storeConfig.business.name + ' — Caja';
  }

  renderProductButtons();
  renderTicket();
  updateClock();
  setInterval(updateClock, 30 * 1000); // actualiza cada 30s
});
