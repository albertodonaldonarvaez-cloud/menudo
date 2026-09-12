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

// ── Estado de edición de orden existente ──
let editingOrderId       = null;    // ID de la orden que se está editando (null = orden nueva)
let originalItemsSnapshot = '[]';   // JSON snapshot para detectar CUALQUIER cambio



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
    const serverP  = storeConfig.products?.[key];
    const defaultP = DEFAULT_STORE_DATA.products[key];
    const p = serverP ? { ...defaultP, ...serverP } : defaultP;
    if (!p || p.enabled === false) return '';
    const isKilo = defaultP?.calcMode === 'kilo';
    return `
      <button class="pos-btn${isKilo ? ' pos-btn-kilo' : ''}" id="posbtn-${key}" onclick="addToTicket('${key}')">
        <div class="pos-btn-qty-badge${isKilo ? ' pos-btn-qty-libre' : ''}" id="posbadge-${key}">0</div>
        <div class="pos-btn-emoji">${p.emoji || '🍽️'}</div>
        <div class="pos-btn-name">${p.title}</div>
        ${isKilo
          ? `<div class="pos-btn-price pos-libre-label">🔢 $${Number(p.price).toLocaleString('es-MX')}/kg</div>`
          : `<div class="pos-btn-price">$${Number(p.price).toLocaleString('es-MX')}</div>
             ${p.priceNote ? `<div class="pos-btn-note">${p.priceNote}</div>` : ''}`
        }
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
  const serverP  = storeConfig.products?.[key];
  const defaultP = DEFAULT_STORE_DATA.products[key];
  // Fusión: datos del servidor + propiedades de código (calcMode, etc.) del default
  const p = serverP ? { ...defaultP, ...serverP } : defaultP;
  if (!p) return;

  // calcMode se lee siempre del DEFAULT (propiedad de código, no configurable por el admin)
  const calcMode = defaultP?.calcMode;
  if (calcMode === 'kilo') {
    openKiloModal(key);
    return;
  }

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
  const isEditing = !!editingOrderId;
  const currentSnap = JSON.stringify(ticket.map(t => ({k:t.key,q:t.qty,p:t.price})));
  const hasChanges = isEditing && currentSnap !== originalItemsSnapshot;

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

  // ── Botones según modo ──
  const enviarWrap = document.getElementById('enviarWrap');
  if (enviarWrap) {
    if (isEditing) {
      // Modo edición: mostrar botones de Enviar (si hay nuevos) + Cobrar + Cancelar
      enviarWrap.innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <button class="enviar-btn" onclick="sendEditedToKitchen()" ${!hasChanges ? 'disabled' : ''}
            style="flex:1;background:linear-gradient(135deg,#D97706,#B45309);padding:12px;font-size:0.9rem">
            <i class="fa-solid fa-fire-burner"></i> Actualizar cocina
          </button>
          <button class="enviar-btn" onclick="cobrarEditingOrder()"
            style="flex:1;padding:12px;font-size:0.9rem" ${ticket.length === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-circle-check"></i> Cobrar $${total.toLocaleString('es-MX')}
          </button>
        </div>
        <button class="enviar-btn" onclick="cancelEditing()"
          style="background:#6B7280;padding:10px;font-size:0.82rem">
          <i class="fa-solid fa-xmark"></i> Nueva orden
        </button>`;
    } else {
      // Modo normal
      enviarWrap.innerHTML = `
        <button class="enviar-btn" id="enviarCocinaBtn" onclick="sendToKitchenPrimary()" ${ticket.length === 0 ? 'disabled' : ''}>
          <i class="fa-solid fa-fire-burner"></i> Enviar a Cocina
        </button>`;
    }
  }

  updateBadges();
  updateMobileTabBadge();
  updateLibreBadge();

  // Actualizar label del meta bar
  const metaLabel = document.getElementById('editingLabel');
  if (metaLabel) {
    if (isEditing) {
      const order = pendingOrders.find(o => o.id === editingOrderId);
      metaLabel.textContent = `✏️ Editando: ${order?.clientName || ''}`;
      metaLabel.style.display = 'block';
    } else {
      metaLabel.style.display = 'none';
    }
  }
}

// ── Selector de copias ────────────────────────────────────────
function setCopies(n, btn) {
  document.getElementById('printCopies').value = n;
  document.querySelectorAll('.copies-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Nombre del cliente ────────────────────────────────────────
function getClientName() {
  return (document.getElementById('clientNameInput')?.value || '').trim();
}

// ── Cargar orden pendiente al ticket ──────────────────────────
function selectPendingOrder(id) {
  const order = pendingOrders.find(o => o.id === id);
  if (!order) return;

  // Si ya la estamos editando, deseleccionar
  if (editingOrderId === id) {
    cancelEditing();
    return;
  }

  // Cargar ítems al ticket
  editingOrderId    = id;
  ticket            = (order.items || []).map(it => ({
    key:       it.key,
    title:     it.title,
    emoji:     it.emoji || '',
    price:     Number(it.price),
    priceNote: it.priceNote || '',
    qty:       it.qty
  }));
  originalItemsSnapshot = JSON.stringify(ticket.map(t => ({k:t.key,q:t.qty,p:t.price})));
  orderType         = order.orderType || 'aqui';
  pendingPayMethod  = 'efectivo';

  // Mostrar nombre del cliente
  const nameInput = document.getElementById('clientNameInput');
  if (nameInput) { nameInput.value = order.clientName || ''; nameInput.disabled = true; }

  setOrderType(orderType);
  renderTicket();

  // Highlight en la lista
  selectedPendingId = id;
  renderPendingOrders();

  // En móvil: cambiar al tab de ticket
  if (window.innerWidth < 640) switchMobileTab('ticket');
}

// ── Enviar ítems nuevos a cocina (PATCH) ──────────────────────
async function sendEditedToKitchen() {
  if (!editingOrderId) return;
  const currentSnap = JSON.stringify(ticket.map(t => ({k:t.key,q:t.qty,p:t.price})));
  if (currentSnap === originalItemsSnapshot) return; // sin cambios
  const total = getTotal();

  try {
    const res = await fetch(`/api/orders/${editingOrderId}/items`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({
        items: ticket.map(t => ({ key: t.key, title: t.title, emoji: t.emoji, qty: t.qty, price: t.price, subtotal: t.price * t.qty })),
        total
      })
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (res.ok) {
      showPosToast('🍳 Cocina verá los cambios');
      originalItemsSnapshot = JSON.stringify(ticket.map(t => ({k:t.key,q:t.qty,p:t.price})));

      renderTicket();
      await loadPendingOrders();
    } else {
      const err = await res.json().catch(() => ({}));
      showPosToast(`❌ ${err.error || 'Error al guardar'}`);
    }
  } catch (e) { showPosToast('❌ Sin conexión'); }
}

// ── Cobrar orden editada → abre modal de pago ────────────────
async function cobrarEditingOrder() {
  if (!editingOrderId || ticket.length === 0) return;

  // Primero guardar cambios si los hay
  const currentSnap = JSON.stringify(ticket.map(t => ({k:t.key,q:t.qty,p:t.price})));
  if (currentSnap !== originalItemsSnapshot) {
    const total = getTotal();
    try {
      await fetch(`/api/orders/${editingOrderId}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          items: ticket.map(t => ({ key: t.key, title: t.title, emoji: t.emoji, qty: t.qty, price: t.price, subtotal: t.price * t.qty })),
          total
        })
      });
      originalItemsSnapshot = currentSnap;
    } catch { /* continuar a cobrar */ }
  }

  // Abrir modal de cobro
  openPayModal();
}

// ── Modal de Cobro ────────────────────────────────────────────
let payModalMethod = 'efectivo';

function openPayModal() {
  const total = getTotal();
  const order = pendingOrders.find(o => o.id === editingOrderId);
  const name  = order?.clientName || getClientName() || 'Cliente';

  // Header
  document.getElementById('payModalHeader').textContent = `💰 Cobrar: ${name} — $${total.toLocaleString('es-MX')}`;

  // Reset
  payModalMethod = 'efectivo';
  document.getElementById('pmEfectivo').classList.add('active');
  document.getElementById('pmTarjeta').classList.remove('active');
  document.getElementById('pmTransfer').classList.remove('active');
  document.getElementById('payCashSection').style.display = '';
  document.getElementById('payCashInput').value = '';
  document.getElementById('payConfirmBtn').disabled = false;
  document.getElementById('payConfirmLabel').textContent = `Confirmar cobro $${total.toLocaleString('es-MX')}`;
  calcChange();

  // Mostrar
  document.getElementById('payModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('payCashInput')?.focus(), 200);
}

function closePayModal() {
  document.getElementById('payModal').classList.add('hidden');
}

function setPayMethod(method) {
  payModalMethod = method;
  document.getElementById('pmEfectivo').classList.toggle('active', method === 'efectivo');
  document.getElementById('pmTarjeta').classList.toggle('active', method === 'tarjeta');
  document.getElementById('pmTransfer').classList.toggle('active', method === 'transferencia');
  document.getElementById('payCashSection').style.display = method === 'efectivo' ? '' : 'none';
}

function setQuickBill(amount) {
  document.getElementById('payCashInput').value = amount;
  calcChange();
}

function calcChange() {
  const total    = getTotal();
  const received = parseFloat(document.getElementById('payCashInput')?.value) || 0;
  const change   = received - total;
  const display  = document.getElementById('payChangeDisplay');
  const amountEl = document.getElementById('payChangeAmount');

  if (received === 0) {
    display.className = 'pay-change-display zero';
    amountEl.textContent = '$0';
  } else if (change >= 0) {
    display.className = 'pay-change-display positive';
    amountEl.textContent = `$${change.toLocaleString('es-MX')}`;
  } else {
    display.className = 'pay-change-display negative';
    amountEl.textContent = `-$${Math.abs(change).toLocaleString('es-MX')}`;
  }
}

async function confirmPay() {
  if (!editingOrderId) return;
  const orderId = editingOrderId;
  const total   = getTotal();
  const btn     = document.getElementById('payConfirmBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cobrando...'; }

  try {
    const res = await fetch(`/api/orders/${orderId}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ paymentMethod: payModalMethod })
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (res.ok) {
      const order = pendingOrders.find(o => o.id === orderId);
      const received = parseFloat(document.getElementById('payCashInput')?.value) || 0;
      const change = received - total;
      let msg = `✅ Cobrado: ${order?.clientName || ''} — $${total.toLocaleString('es-MX')}`;
      if (payModalMethod === 'efectivo' && received > total) {
        msg += ` · Cambio: $${change.toLocaleString('es-MX')}`;
      }

      // Guardar datos del ticket para imprimir
      const ticketData = {
        orderId,
        clientName: order?.clientName || '',
        items: [...ticket],
        total,
        payMethod: payModalMethod,
        received: payModalMethod === 'efectivo' ? received : total,
        change: payModalMethod === 'efectivo' ? Math.max(0, change) : 0,
        timestamp: new Date().toISOString()
      };

      // Enviar ticket al servidor para que la app lo imprima
      try {
        await fetch('/api/print-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ticketData)
        });
      } catch { /* no importa si falla */ }

      showPosToast(msg);
      closePayModal();
      cancelEditing();
      await loadPendingOrders();
    } else {
      const err = await res.json().catch(() => ({}));
      showPosToast(`❌ ${err.error || 'Error al cobrar'}`);
    }
  } catch (e) { showPosToast('❌ Sin conexión'); }
  finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span id="payConfirmLabel">Confirmar cobro</span>'; }
  }
}



// ── Cancelar edición → volver a modo nueva orden ─────────────
function cancelEditing() {
  editingOrderId       = null;
  originalItemsSnapshot = '[]';
  selectedPendingId    = null;

  ticket = [];
  const nameInput = document.getElementById('clientNameInput');
  if (nameInput) { nameInput.value = ''; nameInput.disabled = false; }
  setOrderType('aqui');
  renderTicket();
  renderPendingOrders();
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

    const copies = parseInt(document.getElementById('printCopies')?.value) || 1;

    const res = await fetch('/api/orders', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ clientName: name, orderType, items, total: getTotal(), printCopies: copies })
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
    selectedPendingId = null;
    return;
  }

  function timeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso)) / 60000);
    return m < 1 ? 'ahora' : `${m} min`;
  }

  list.innerHTML = pendingOrders.map(o => {
    const isEditing  = o.id === editingOrderId;
    const typeLabel  = o.orderType === 'llevar' ? '🛍️ Llevar' : '🍽️ Aquí';
    const itemsText  = (o.items || []).map(it => `${it.qty}× ${it.title}`).join(' · ');
    return `
      <div class="pending-card${isEditing ? ' selected' : ''}" onclick="selectPendingOrder('${o.id}')">
        <div class="pending-card-top">
          <span class="pending-type ${o.orderType === 'llevar' ? 'llevar' : 'aqui'}">${typeLabel}</span>
          <span class="pending-time">${timeAgo(o.timestamp)}</span>
        </div>
        <div class="pending-name"><i class="fa-solid fa-user"></i> ${o.clientName || 'Cliente'}</div>
        <div class="pending-items">${itemsText}</div>
        <div class="pending-total">$${Number(o.total).toLocaleString('es-MX')}</div>
      </div>`;
  }).join('');
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

// ── Modal Editar Orden ─────────────────────────────────────────
let editOrderId   = null;
let editItems     = [];   // copia editable de los items

function openEditModal(orderId) {
  const order = pendingOrders.find(o => o.id === orderId);
  if (!order) return;
  editOrderId = orderId;
  editItems   = order.items.map(it => ({ ...it })); // copia profunda
  renderEditModal(order);
  document.getElementById('editOrderModal')?.classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editOrderModal')?.classList.add('hidden');
  editOrderId = null;
  editItems   = [];
}

function renderEditModal(order) {
  // Header
  const clientEl = document.getElementById('editModalClient');
  if (clientEl) clientEl.textContent = order.clientName || 'Cliente';

  // Lista de items
  renderEditItems();

  // Grid de productos para agregar
  renderEditAddGrid();
}

function renderEditItems() {
  const list = document.getElementById('editItemsList');
  if (!list) return;

  if (editItems.length === 0) {
    list.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;text-align:center;padding:12px;">Sin ítems — agrega productos abajo</div>';
    updateEditTotal();
    return;
  }

  list.innerHTML = editItems.map((it, idx) => `
    <div class="edit-item-row">
      <span style="font-size:1.2rem">${it.emoji || '🍽️'}</span>
      <div style="flex:1;min-width:0">
        <div class="edit-item-name">${it.title}</div>
        ${it.priceNote ? `<div class="edit-item-note">${it.priceNote}</div>` : ''}
      </div>
      <span class="edit-item-price">$${(Number(it.price) * it.qty).toLocaleString('es-MX')}</span>
      <div class="edit-qty-ctrl">
        <button class="eq-del" onclick="changeEditQty(${idx},-1)" title="Quitar">
          ${it.qty === 1 ? '<i class="fa-solid fa-trash" style="font-size:0.7rem"></i>' : '−'}
        </button>
        <span class="edit-qty-num">${it.qty}</span>
        <button onclick="changeEditQty(${idx},1)">+</button>
      </div>
    </div>`).join('');

  updateEditTotal();
}

function changeEditQty(idx, delta) {
  if (editItems[idx].qty + delta <= 0) {
    editItems.splice(idx, 1);
  } else {
    editItems[idx].qty += delta;
  }
  renderEditItems();
}

function renderEditAddGrid() {
  const grid = document.getElementById('editAddGrid');
  if (!grid) return;

  const productBtns = PRODUCT_KEYS.map(key => {
    const serverP  = storeConfig.products?.[key];
    const defaultP = DEFAULT_STORE_DATA.products[key];
    const p = serverP ? { ...defaultP, ...serverP } : defaultP;
    if (!p || p.enabled === false) return '';
    return `<button class="edit-add-btn" onclick="addProductToEdit('${key}')">
      <span class="ea-emoji">${p.emoji || '🍽️'}</span>
      <span class="ea-name">${p.title}</span>
      <span class="ea-price">$${Number(p.price).toLocaleString('es-MX')}</span>
    </button>`;
  }).join('');

  const extras = (storeConfig.extraProducts || DEFAULT_STORE_DATA.extraProducts || [])
    .filter(ep => ep.enabled)
    .map(ep => `<button class="edit-add-btn" onclick="addExtraToEdit('${ep.id}')">
      <span class="ea-emoji">${ep.emoji || '🍽️'}</span>
      <span class="ea-name">${ep.title}</span>
      <span class="ea-price">$${Number(ep.price).toLocaleString('es-MX')}</span>
    </button>`).join('');

  grid.innerHTML = productBtns + extras;
}

function addProductToEdit(key) {
  const serverP  = storeConfig.products?.[key];
  const defaultP = DEFAULT_STORE_DATA.products[key];
  const p = serverP ? { ...defaultP, ...serverP } : defaultP;
  if (!p) return;
  const existing = editItems.find(it => it.key === key);
  if (existing) { existing.qty++; }
  else { editItems.push({ key, title: p.title, emoji: p.emoji || '', price: Number(p.price) || 0, priceNote: p.priceNote || '', qty: 1 }); }
  renderEditItems();
}

function addExtraToEdit(id) {
  const ep = (storeConfig.extraProducts || []).find(e => e.id === id);
  if (!ep) return;
  const existing = editItems.find(it => it.key === id);
  if (existing) { existing.qty++; }
  else { editItems.push({ key: id, title: ep.title, emoji: ep.emoji || '', price: Number(ep.price) || 0, priceNote: ep.priceNote || '', qty: 1 }); }
  renderEditItems();
}

function updateEditTotal() {
  const total = editItems.reduce((s, it) => s + Number(it.price) * it.qty, 0);
  const el    = document.getElementById('editTotalDisplay');
  if (el) el.textContent = `$${total.toLocaleString('es-MX')}`;
  const btn = document.getElementById('editSaveBtn');
  if (btn) btn.disabled = editItems.length === 0;
}

async function saveEditedOrder(action = 'cocina') {
  if (!editOrderId || editItems.length === 0) return;
  const total      = editItems.reduce((s, it) => s + Number(it.price) * it.qty, 0);
  const savedId    = editOrderId;
  const allBtns    = [document.getElementById('editSaveBtn'), document.getElementById('editSaveCobrarBtn')];
  allBtns.forEach(b => { if (b) b.disabled = true; });

  try {
    const res = await fetch(`/api/orders/${savedId}/items`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify({ items: editItems, total })
    });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (res.ok) {
      closeEditModal();
      await loadPendingOrders();

      if (action === 'cobrar') {
        // Seleccionar la orden para cobro inmediato
        selectedPendingId = savedId;
        pendingPayMethod  = 'efectivo';
        renderPendingOrders();
        // En móvil: cambiar al tab de cobrar
        if (window.innerWidth < 640) switchMobileTab('cobrar');
        showPosToast('✅ Orden lista para cobrar');
      } else {
        showPosToast('🍳 Cocina verá los cambios en segundos');
      }
    } else {
      const err = await res.json().catch(() => ({}));
      showPosToast(`❌ ${err.error || 'Error al guardar'}`);
    }
  } catch (e) {
    showPosToast('❌ Sin conexión');
  } finally {
    allBtns.forEach(b => { if (b) b.disabled = false; });
  }
}


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

// ── Calculadora Barbacoa × Kilo ───────────────────────────────
let _kiloProductKey  = 'birria';
let _kiloMode        = 'kg';  // 'kg' | 'precio'

function openKiloModal(key) {
  _kiloProductKey = key;
  _kiloMode       = 'kg';
  const p         = storeConfig.products?.[key] || DEFAULT_STORE_DATA.products[key];
  const modal     = document.getElementById('kiloModal');
  if (!modal || !p) return;

  document.getElementById('kiloProductName').textContent = `${p.emoji || '🥩'} ${p.title}`;
  document.getElementById('kiloPricePerKg').textContent  = `$${Number(p.price).toLocaleString('es-MX')} / kg`;
  document.getElementById('kiloInput').value = '';
  document.getElementById('kiloResult').textContent = '';
  document.getElementById('kiloModeKg').classList.add('active');
  document.getElementById('kiloModePrecio').classList.remove('active');
  document.getElementById('kiloInputLabel').textContent = 'Kilos a vender';
  document.getElementById('kiloInputUnit').textContent  = 'kg';

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('kiloInput')?.focus(), 100);
}

function closeKiloModal(e) {
  if (!e || e.target === document.getElementById('kiloModal')) {
    document.getElementById('kiloModal')?.classList.add('hidden');
  }
}

function setKiloMode(mode) {
  _kiloMode = mode;
  const labelEl = document.getElementById('kiloInputLabel');
  const unitEl  = document.getElementById('kiloInputUnit');
  document.getElementById('kiloModeKg')?.classList.toggle('active',     mode === 'kg');
  document.getElementById('kiloModePrecio')?.classList.toggle('active', mode === 'precio');
  if (mode === 'kg') {
    if (labelEl) labelEl.textContent = 'Kilos a vender';
    if (unitEl)  unitEl.textContent  = 'kg';
  } else {
    if (labelEl) labelEl.textContent = 'Precio a cobrar ($)';
    if (unitEl)  unitEl.textContent  = '$';
  }
  document.getElementById('kiloInput').value = '';
  document.getElementById('kiloResult').textContent = '';
}

function updateKiloCalc() {
  const p       = storeConfig.products?.[_kiloProductKey] || DEFAULT_STORE_DATA.products[_kiloProductKey];
  const priceKg = Number(p?.price) || 250;
  const val     = parseFloat(document.getElementById('kiloInput')?.value);
  const resultEl = document.getElementById('kiloResult');
  if (!resultEl) return;

  if (!val || val <= 0) { resultEl.textContent = ''; return; }

  if (_kiloMode === 'kg') {
    const total = (val * priceKg);
    resultEl.textContent = `→ Total: $${total % 1 === 0 ? total.toFixed(0) : total.toFixed(2)}`;
  } else {
    const grams = Math.round((val / priceKg) * 1000);
    const kgDisplay = (val / priceKg).toFixed(3).replace(/\.?0+$/, '');
    resultEl.textContent = `→ ${grams} gramos (${kgDisplay} kg)`;
  }
}

function confirmKiloModal() {
  const p       = storeConfig.products?.[_kiloProductKey] || DEFAULT_STORE_DATA.products[_kiloProductKey];
  const priceKg = Number(p?.price) || 250;
  const val     = parseFloat(document.getElementById('kiloInput')?.value);
  if (!val || val <= 0) { document.getElementById('kiloInput')?.focus(); return; }

  let finalPrice, label;
  if (_kiloMode === 'kg') {
    finalPrice = val * priceKg;
    const kgStr = val % 1 === 0 ? val.toFixed(0) : val.toFixed(3).replace(/\.?0+$/, '');
    label = `${p.title} (${kgStr} kg)`;
  } else {
    finalPrice = val;
    const grams = Math.round((val / priceKg) * 1000);
    label = `${p.title} (${grams} g)`;
  }

  ticket.push({
    key:       _kiloProductKey + '_kilo_' + Date.now(),
    title:     label,
    emoji:     p.emoji || '🥩',
    price:     parseFloat(finalPrice.toFixed(2)),
    priceNote: '',
    qty:       1
  });

  document.getElementById('kiloModal')?.classList.add('hidden');
  renderTicket();
  if (window.innerWidth < 640) switchMobileTab('ticket');
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
