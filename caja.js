'use strict';
/**
 * CAJA.JS — Terminal POS v2.4
 * Flujo: Enviar a Cocina → queda en "Por Cobrar" → se cobra después.
 * Soporta múltiples órdenes simultáneas y tipo Aquí/Para Llevar.
 */

const PRODUCT_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan'];

let storeConfig       = {};
let ticket            = [];         // [{ key, title, emoji, price, priceNote, qty }]
let orderType         = 'aqui';     // 'aqui' | 'llevar'
let mobileTab         = 'productos';// 'productos' | 'ticket' | 'cobrar'
let pendingOrders     = [];         // órdenes pendientes de cobro
let selectedPendingId = null;       // orden seleccionada en "Por Cobrar"
let pendingPayMethod  = 'efectivo'; // método de pago en "Por Cobrar"
let pendingPollTimer  = null;

// ── Tabs móvil (3 tabs) ───────────────────────────────────────
function switchMobileTab(tab) {
  mobileTab = tab;
  const left  = document.getElementById('posLeftPanel');
  const right = document.getElementById('posRightPanel');
  const tProd = document.getElementById('mtabProductos');
  const tTick = document.getElementById('mtabTicket');
  const tCobr = document.getElementById('mtabCobrar');

  if (!left || !right) return;

  left.classList.toggle('mobile-hidden', tab !== 'productos');
  right.classList.toggle('mobile-hidden', tab === 'productos');

  // Mostrar sección correcta en el panel derecho
  const newOrderSection  = document.getElementById('newOrderSection');
  const porCobrarSection = document.getElementById('porCobrarSection');

  if (newOrderSection)  newOrderSection.classList.toggle('mobile-hidden-section',  tab === 'cobrar');
  if (porCobrarSection) porCobrarSection.classList.toggle('mobile-hidden-section', tab !== 'cobrar');

  tProd?.classList.toggle('active', tab === 'productos');
  tTick?.classList.toggle('active', tab === 'ticket');
  tCobr?.classList.toggle('active', tab === 'cobrar');
}

function updateMobileTabBadge() {
  const badge = document.getElementById('mtabBadge');
  if (!badge) return;
  const total = ticket.reduce((s, t) => s + t.qty, 0);
  badge.textContent = total;
  badge.classList.toggle('show', total > 0);
}

function updateCobrarBadge() {
  const tabBadge = document.getElementById('mtabCobrarBadge');
  const secCount = document.getElementById('porCobrarCount');
  const n = pendingOrders.length;
  if (tabBadge) { tabBadge.textContent = n; tabBadge.classList.toggle('show', n > 0); }
  if (secCount) { secCount.textContent = n; secCount.classList.toggle('show', n > 0); }
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
  el.textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Tipo de orden ─────────────────────────────────────────────
function setOrderType(type) {
  orderType = type;
  document.getElementById('btnTypeAqui')?.classList.toggle('active', type === 'aqui');
  document.getElementById('btnTypeLlevar')?.classList.toggle('active', type === 'llevar');
}

// ── Renderizado de botones de producto ────────────────────────
function renderProductButtons() {
  const grid = document.getElementById('posProductsGrid');
  if (!grid) return;

  const productBtns = PRODUCT_KEYS.map(key => {
    const p = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
    if (!p || p.enabled === false) return '';
    return `
      <button class="pos-btn" id="posbtn-${key}" onclick="addToTicket('${key}')">
        <div class="pos-btn-qty-badge" id="posbadge-${key}">0</div>
        <div class="pos-btn-emoji">${p.emoji || '🍽️'}</div>
        <div class="pos-btn-name">${p.title}</div>
        <div class="pos-btn-price">$${Number(p.price).toLocaleString('es-MX')}</div>
        ${p.priceNote ? `<div class="pos-btn-note">${p.priceNote}</div>` : ''}
      </button>`;
  }).join('');

  const extraProds = (storeConfig.extraProducts || DEFAULT_STORE_DATA.extraProducts || []).filter(ep => ep.enabled);
  const extraBtns = extraProds.map(ep => `
    <button class="pos-btn" id="posbtn-${ep.id}" onclick="addExtraToTicket('${ep.id}')">
      <div class="pos-btn-qty-badge" id="posbadge-${ep.id}">0</div>
      <div class="pos-btn-emoji">${ep.emoji || '🍽️'}</div>
      <div class="pos-btn-name">${ep.title}</div>
      <div class="pos-btn-price">$${Number(ep.price).toLocaleString('es-MX')}</div>
      ${ep.priceNote ? `<div class="pos-btn-note">${ep.priceNote}</div>` : ''}
    </button>`).join('');

  const libreBtns = `
    <button class="pos-btn pos-btn-libre" onclick="openPriceModal('menudo')">
      <div class="pos-btn-qty-badge pos-btn-qty-libre" id="badgeLibreMenudo">0</div>
      <div class="pos-btn-emoji">🍲</div>
      <div class="pos-btn-name">Menudo Suelto</div>
      <div class="pos-btn-price pos-libre-label">Precio libre</div>
    </button>
    <button class="pos-btn pos-btn-libre-barb" onclick="openPriceModal('barbacoa')">
      <div class="pos-btn-qty-badge pos-btn-qty-libre" id="badgeLibreBarb">0</div>
      <div class="pos-btn-emoji">🥩</div>
      <div class="pos-btn-name">Barbacoa Suelta</div>
      <div class="pos-btn-price pos-libre-label">Precio libre</div>
    </button>`;

  const activePromos = (storeConfig.promos || DEFAULT_STORE_DATA.promos || []).filter(p => p.enabled);
  const promoBtns = activePromos.length ? `
    <div class="pos-promo-divider"><span>🎉 Promos</span></div>
    ${activePromos.map(p => `
      <button class="pos-btn pos-btn-promo" id="posbtn-${p.id}" onclick="addPromoToTicket('${p.id}')">
        <div class="pos-btn-qty-badge" id="posbadge-${p.id}">0</div>
        <div class="pos-btn-emoji">🎉</div>
        <div class="pos-btn-name">${p.title}</div>
        <div class="pos-btn-price">$${Number(p.price).toLocaleString('es-MX')}</div>
      </button>`).join('')}
  ` : '';

  grid.innerHTML = productBtns + extraBtns + libreBtns + promoBtns;
}

// ── Modal de precio libre ─────────────────────────────────────
const LIBRE_CONFIG = {
  menudo:   { prefix: 'menudo_libre', title: 'Menudo Suelto',   emoji: '🍲', badgeId: 'badgeLibreMenudo', label: 'kg / porción' },
  barbacoa: { prefix: 'barb_libre',   title: 'Barbacoa Suelta', emoji: '🥩', badgeId: 'badgeLibreBarb',   label: 'kg / porción' }
};
let _currentLibreType = 'menudo';

function openPriceModal(type) {
  _currentLibreType = type;
  const cfg   = LIBRE_CONFIG[type];
  const modal = document.getElementById('priceModal');
  const input = document.getElementById('priceModalInput');
  if (!modal || !cfg) return;
  document.getElementById('priceModalLabel').textContent = cfg.label;
  document.getElementById('priceModalEmoji').textContent = cfg.emoji;
  if (input) { input.value = ''; }
  modal.classList.remove('hidden');
  setTimeout(() => input?.focus(), 100);
}

function closePriceModal(e) {
  if (!e || e.target === document.getElementById('priceModal')) {
    document.getElementById('priceModal')?.classList.add('hidden');
  }
}

function confirmPriceModal() {
  const input = document.getElementById('priceModalInput');
  const price = parseFloat(input?.value);
  if (!price || price <= 0) { input?.focus(); return; }
  const cfg = LIBRE_CONFIG[_currentLibreType];
  ticket.push({
    key:       cfg.prefix + '_' + Date.now(),
    title:     cfg.title,
    emoji:     cfg.emoji,
    price,
    priceNote: '',
    qty:       1
  });
  document.getElementById('priceModal')?.classList.add('hidden');
  renderTicket();
  if (mobileTab === 'productos') switchMobileTab('ticket');
}

function updateLibreBadge() {
  Object.values(LIBRE_CONFIG).forEach(cfg => {
    const badge = document.getElementById(cfg.badgeId);
    if (!badge) return;
    const count = ticket.filter(t => t.key.startsWith(cfg.prefix)).length;
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
  });
}

// ── Ticket ────────────────────────────────────────────────────
function addToTicket(key) {
  const p = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
  if (!p) return;
  const existing = ticket.find(t => t.key === key);
  if (existing) { existing.qty++; }
  else { ticket.push({ key, title: p.title, emoji: p.emoji || '', price: Number(p.price) || 0, priceNote: p.priceNote || '', qty: 1 }); }
  renderTicket();
  flashBtn(key);
}

function addPromoToTicket(id) {
  const p = (storeConfig.promos || []).find(pr => pr.id === id);
  if (!p) return;
  const existing = ticket.find(t => t.key === id);
  if (existing) { existing.qty++; }
  else { ticket.push({ key: id, title: p.title, emoji: '🎉', price: Number(p.price) || 0, priceNote: '', qty: 1 }); }
  renderTicket();
  flashBtn(id);
}

function addExtraToTicket(id) {
  const ep = (storeConfig.extraProducts || []).find(e => e.id === id);
  if (!ep) return;
  const existing = ticket.find(t => t.key === id);
  if (existing) { existing.qty++; }
  else { ticket.push({ key: id, title: ep.title, emoji: ep.emoji || '🍽️', price: Number(ep.price) || 0, priceNote: ep.priceNote || '', qty: 1 }); }
  renderTicket();
  flashBtn(id);
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
  return ticket.reduce((s, t) => s + t.price * t.qty, 0);
}

function flashBtn(key) {
  const btn = document.getElementById(`posbtn-${key}`);
  if (!btn) return;
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 300);
}

function updateBadges() {
  PRODUCT_KEYS.forEach(key => {
    const badge = document.getElementById(`posbadge-${key}`);
    if (!badge) return;
    const item = ticket.find(t => t.key === key);
    const count = item ? item.qty : 0;
    badge.textContent = count;
    badge.classList.toggle('show', count > 0);
  });
}

function renderTicket() {
  const list    = document.getElementById('ticketList');
  const totalEl = document.getElementById('ticketTotal');
  const sendBtn = document.getElementById('enviarCocinaBtn');
  const total   = getTotal();

  if (list) {
    if (ticket.length === 0) {
      list.innerHTML = `<div class="ticket-empty"><i class="fa-regular fa-receipt"></i><span>Ticket vacío<br>Toca un producto</span></div>`;
    } else {
      list.innerHTML = ticket.map(t => `
        <div class="ticket-row">
          <span class="ticket-emoji">${t.emoji}</span>
          <div class="ticket-info">
            <span class="ticket-name">${t.title}</span>
            ${t.priceNote ? `<span class="ticket-note">${t.priceNote}</span>` : ''}
          </div>
          <div class="ticket-qty-ctrl">
            <button onclick="changeQty('${t.key}',-1)">−</button>
            <span>${t.qty}</span>
            <button onclick="changeQty('${t.key}',1)">+</button>
          </div>
          <span class="ticket-sub">$${(t.price * t.qty).toLocaleString('es-MX')}</span>
        </div>`).join('');
    }
  }

  if (totalEl) {
    totalEl.textContent = `$${total.toLocaleString('es-MX')}`;
    if (ticket.length > 0) {
      totalEl.classList.add('pop');
      setTimeout(() => totalEl.classList.remove('pop'), 300);
    }
  }

  if (sendBtn) sendBtn.disabled = ticket.length === 0;

  updateBadges();
  updateMobileTabBadge();
  updateLibreBadge();
}

// ── Nombre del cliente ────────────────────────────────────────
function getClientName() {
  return (document.getElementById('clientNameInput')?.value || '').trim();
}

// ── ACCIÓN PRINCIPAL: Enviar a Cocina ─────────────────────────
async function sendToKitchenPrimary() {
  if (ticket.length === 0) return;

  const name = getClientName();
  if (!name) {
    const input = document.getElementById('clientNameInput');
    input?.focus();
    input?.classList.add('shake');
    setTimeout(() => input?.classList.remove('shake'), 500);
    showPosToast('⚠️ Escribe el nombre del cliente');
    return;
  }

  const btn = document.getElementById('enviarCocinaBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }

  try {
    const items = ticket.map(t => ({
      key:      t.key,
      title:    t.title,
      emoji:    t.emoji,
      qty:      t.qty,
      price:    t.price,
      subtotal: t.price * t.qty
    }));

    const res = await fetch('/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ clientName: name, orderType, items, total: getTotal() })
    });

    if (res.status === 401) { window.location.href = '/login'; return; }

    if (res.ok) {
      const { order } = await res.json();
      showPosToast(`✅ Orden #${order.num} de ${name} enviada a cocina`);
      // Limpiar ticket y nombre
      clearTicket();
      document.getElementById('clientNameInput').value = '';
      setOrderType('aqui'); // reset a "Aquí"
      // Recargar pendientes y volver a productos en móvil
      await loadPendingOrders();
      if (window.innerWidth < 640) switchMobileTab('productos');
    } else {
      const err = await res.json().catch(() => ({}));
      showPosToast(`❌ ${err.error || 'Error al enviar'}`);
    }
  } catch (e) {
    showPosToast('❌ Sin conexión con el servidor');
    console.warn(e);
  } finally {
    if (btn) {
      btn.disabled = ticket.length === 0;
      btn.innerHTML = '<i class="fa-solid fa-fire-burner"></i> Enviar a Cocina';
    }
  }
}

// ── Por Cobrar ────────────────────────────────────────────────
async function loadPendingOrders() {
  try {
    const res = await fetch('/api/orders', { cache: 'no-store' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) return;
    const data = await res.json();
    pendingOrders = data.pendingPayment || [];
    updateCobrarBadge();
    renderPendingOrders();
  } catch (e) {
    console.warn('Poll pending orders error:', e);
  }
}

function renderPendingOrders() {
  const list = document.getElementById('pendingOrdersList');
  if (!list) return;

  if (pendingOrders.length === 0) {
    list.innerHTML = `<div class="pending-empty"><i class="fa-solid fa-check-circle"></i><span>No hay órdenes<br>pendientes de cobro</span></div>`;
    document.getElementById('pendingPaySection')?.classList.add('hidden');
    selectedPendingId = null;
    return;
  }

  function timeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    return m < 1 ? 'ahora' : `${m} min`;
  }

  list.innerHTML = pendingOrders.map(o => {
    const isSelected = o.id === selectedPendingId;
    const typeLabel  = o.orderType === 'llevar' ? '🛍️ Para Llevar' : '🍽️ Aquí';
    const itemsText  = (o.items || []).slice(0, 3).map(it => `${it.qty}x ${it.title}`).join(' · ');
    return `
      <div class="pending-card${isSelected ? ' selected' : ''}" onclick="selectPendingOrder('${o.id}')">
        <div class="pending-card-top">
          <span class="pending-type ${o.orderType === 'llevar' ? 'llevar' : 'aqui'}">${typeLabel}</span>
          <span class="pending-time">${timeAgo(o.timestamp)}</span>
        </div>
        <div class="pending-name"><i class="fa-solid fa-user"></i> ${o.clientName || 'Cliente'}</div>
        <div class="pending-items">${itemsText}${(o.items||[]).length > 3 ? ' ...' : ''}</div>
        <div class="pending-total">$${Number(o.total).toLocaleString('es-MX')}</div>
      </div>`;
  }).join('');

  // Mostrar sección de pago si hay una orden seleccionada
  const paySection = document.getElementById('pendingPaySection');
  const selOrder   = pendingOrders.find(o => o.id === selectedPendingId);

  if (!selOrder) {
    paySection?.classList.add('hidden');
    return;
  }

  paySection?.classList.remove('hidden');
  const nameEl  = document.getElementById('payOrderName');
  const totalEl = document.getElementById('payOrderTotal');
  if (nameEl)  nameEl.textContent  = selOrder.clientName || 'Cliente';
  if (totalEl) totalEl.textContent = `$${Number(selOrder.total).toLocaleString('es-MX')}`;

  // Actualizar botones de método de pago
  ['efectivo','tarjeta','transferencia'].forEach(m => {
    document.getElementById(`pendPay${m.charAt(0).toUpperCase()+m.slice(1)}`)
      ?.classList.toggle('active', m === pendingPayMethod);
  });
}

function selectPendingOrder(id) {
  selectedPendingId = (selectedPendingId === id) ? null : id; // toggle
  pendingPayMethod  = 'efectivo';
  renderPendingOrders();
}

function selectPendingPayment(method, btn) {
  pendingPayMethod = method;
  document.querySelectorAll('.pending-pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function collectPayment() {
  if (!selectedPendingId) return;
  const order = pendingOrders.find(o => o.id === selectedPendingId);
  if (!order) return;

  const cobrarBtn = document.getElementById('cobrarPendienteBtn');
  if (cobrarBtn) { cobrarBtn.disabled = true; cobrarBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cobrando...'; }

  try {
    const res = await fetch(`/api/orders/${selectedPendingId}/pay`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ paymentMethod: pendingPayMethod })
    });

    if (res.status === 401) { window.location.href = '/login'; return; }

    if (res.ok) {
      showPosToast(`✅ Cobrado: ${order.clientName} — $${Number(order.total).toLocaleString('es-MX')}`);
      selectedPendingId = null;
      pendingPayMethod  = 'efectivo';
      await loadPendingOrders();
    } else {
      const err = await res.json().catch(() => ({}));
      showPosToast(`❌ ${err.error || 'Error al cobrar'}`);
    }
  } catch (e) {
    showPosToast('❌ Sin conexión');
    console.warn(e);
  } finally {
    if (cobrarBtn) {
      cobrarBtn.disabled = false;
      cobrarBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span id="cobrarPendienteLabel">Cobrar</span>';
    }
  }
}

// ── Toast del POS ─────────────────────────────────────────────
function showPosToast(msg) {
  let el = document.getElementById('posToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'posToast';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1F2937;color:#fff;padding:10px 20px;border-radius:12px;font-family:Outfit,sans-serif;font-size:0.9rem;font-weight:600;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  storeConfig = await loadConfig();

  const nameEl = document.getElementById('posBusinessName');
  if (nameEl && storeConfig.business?.name) nameEl.textContent = storeConfig.business.name;

  updateClock();
  setInterval(updateClock, 30_000);

  setOrderType('aqui');
  renderProductButtons();
  renderTicket();

  // Carga inicial de órdenes pendientes + polling cada 12s
  await loadPendingOrders();
  pendingPollTimer = setInterval(loadPendingOrders, 12_000);

  // Refresca al volver a enfocar la pestaña
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadPendingOrders();
  });

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW:', e));
  }
});
