'use strict';
/**
 * COCINA.JS — Módulo de Cocina v1.0
 * Muestra órdenes en tiempo real, cambia estados e imprime tickets.
 */

let businessName = 'Barbacoa & Antojitos';
let pollTimer    = null;
const POLL_MS    = 8000;

// ── Reloj ─────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('cocinaClock');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Tiempo relativo ───────────────────────────────────────────
function timeAgo(isoStr) {
  const mins = Math.floor((Date.now() - new Date(isoStr)) / 60000);
  if (mins < 1)  return 'ahora';
  if (mins === 1) return 'hace 1 min';
  return `hace ${mins} min`;
}

function isLate(isoStr) {
  return (Date.now() - new Date(isoStr)) > 15 * 60 * 1000; // > 15 min
}

// ── Render de una tarjeta de orden ───────────────────────────
function renderCard(order) {
  const status = order.status;
  const late   = isLate(order.timestamp);
  const ago    = timeAgo(order.timestamp);

  const payIcons = { efectivo: '💵', tarjeta: '💳', transferencia: '📱' };
  const payLabel = order.paymentMethod
    ? `${payIcons[order.paymentMethod] || ''} ${order.paymentMethod}`
    : '';

  const itemsHtml = (order.items || []).map(it => `
    <li>
      <span class="order-item-qty">${it.qty}x</span>
      <span class="order-item-name">${it.emoji ? it.emoji + ' ' : ''}${it.title}</span>
    </li>
  `).join('');

  // Botones según estado
  let actionBtns = '';
  if (status === 'pendiente') {
    actionBtns = `
      <button class="order-btn btn-print"  onclick="printOrder('${order.id}')" title="Imprimir ticket"><i class="fa-solid fa-print"></i></button>
      <button class="order-btn btn-prep"   onclick="setStatus('${order.id}','en_prep')"><i class="fa-solid fa-fire"></i> En Prep</button>
    `;
  } else if (status === 'en_prep') {
    actionBtns = `
      <button class="order-btn btn-print"  onclick="printOrder('${order.id}')" title="Imprimir ticket"><i class="fa-solid fa-print"></i></button>
      <button class="order-btn btn-back"   onclick="setStatus('${order.id}','pendiente')" title="Regresar a pendiente"><i class="fa-solid fa-rotate-left"></i></button>
      <button class="order-btn btn-done"   onclick="setStatus('${order.id}','listo')"><i class="fa-solid fa-check"></i> Listo</button>
    `;
  } else {
    actionBtns = `
      <button class="order-btn btn-print"  onclick="printOrder('${order.id}')" title="Imprimir ticket"><i class="fa-solid fa-print"></i></button>
    `;
  }

  return `
    <div class="order-card" id="card-${order.id}">
      <div class="order-card-header">
        <span class="order-num">#${order.num || '–'}</span>
        <span class="order-time${late ? ' late' : ''}">${ago}</span>
      </div>
      <div class="order-client"><i class="fa-solid fa-user"></i> ${escHtml(order.clientName || 'Cliente')}</div>
      <ul class="order-items">${itemsHtml}</ul>
      ${order.total ? `<div class="order-total">Total: $${Number(order.total).toLocaleString('es-MX')}</div>` : ''}
      ${payLabel ? `<div class="order-payment">${payLabel}</div>` : ''}
      <div class="order-actions">${actionBtns}</div>
    </div>
  `;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Renderizado del tablero ───────────────────────────────────
function renderBoard(data) {
  const { active = [], doneToday = [] } = data;

  const pendiente = active.filter(o => o.status === 'pendiente');
  const enPrep    = active.filter(o => o.status === 'en_prep');

  setCol('listPendiente', 'cntPendiente', pendiente, 'Sin órdenes pendientes');
  setCol('listEnPrep',    'cntEnPrep',    enPrep,    'Nada en preparación');
  setCol('listListos',    'cntListos',    doneToday, 'Nada listo aún');
}

function setCol(listId, countId, orders, emptyMsg) {
  const list  = document.getElementById(listId);
  const count = document.getElementById(countId);
  if (!list) return;
  count.textContent = orders.length;
  if (orders.length === 0) {
    list.innerHTML = `<div class="col-empty">${emptyMsg}</div>`;
    return;
  }
  // Más reciente abajo (FIFO)
  list.innerHTML = orders
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(renderCard)
    .join('');
}

// ── API ───────────────────────────────────────────────────────
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders', { cache: 'no-store' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) return;
    const data = await res.json();
    renderBoard(data);
  } catch (e) {
    console.warn('Poll error:', e);
  }
}

async function setStatus(id, status) {
  const card = document.getElementById(`card-${id}`);
  if (card) card.style.opacity = '0.5';
  try {
    await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    await fetchOrders(); // refresca de inmediato
  } catch (e) {
    console.warn('Status update error:', e);
    if (card) card.style.opacity = '1';
  }
}

// ── Impresión ─────────────────────────────────────────────────
async function printOrder(id) {
  // Busca la orden en el DOM ya renderizado,
  // o hace una llamada a la API para obtener todas y buscarla
  const all = await fetch('/api/orders', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
  if (!all) return;

  const order = [...(all.active || []), ...(all.doneToday || [])].find(o => o.id === id);
  if (!order) return;

  const now = new Date(order.timestamp).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const itemsHtml = (order.items || []).map(it => `
    <div class="print-row">
      <span class="print-qty">${it.qty}x</span>
      <span>${it.title}</span>
    </div>
  `).join('');

  document.getElementById('printArea').innerHTML = `
    <div class="print-header">
      <div class="print-business">${escHtml(businessName)}</div>
      <div>${now}</div>
      <div>Orden #${order.num || '–'}</div>
    </div>
    <div class="print-client">👤 ${escHtml(order.clientName || 'Cliente')}</div>
    <div class="print-divider"></div>
    ${itemsHtml}
    <div class="print-divider"></div>
    ${order.total ? `<div class="print-total">Total: $${Number(order.total).toLocaleString('es-MX')}</div>` : ''}
    ${order.paymentMethod ? `<div class="print-footer">${order.paymentMethod.toUpperCase()}</div>` : ''}
    <div class="print-footer">¡Gracias por su preferencia!</div>
  `;

  window.print();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Nombre del negocio
  try {
    const cfg = await fetch('/api/config', { cache: 'no-store' }).then(r => r.json());
    if (cfg?.business?.name) {
      businessName = cfg.business.name;
      const el = document.getElementById('cocinaBusName');
      if (el) el.textContent = '🍳 ' + cfg.business.name;
    }
  } catch {}

  updateClock();
  setInterval(updateClock, 30_000);

  // Primera carga y polling
  await fetchOrders();
  pollTimer = setInterval(fetchOrders, POLL_MS);

  // Refresca al volver a enfocar la pestaña
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fetchOrders();
  });
});
