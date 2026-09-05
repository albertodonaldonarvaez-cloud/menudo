'use strict';
/**
 * COCINA.JS v2.5.1
 * Cola de pedidos pendientes de cobro.
 * Las ordenes aparecen cuando el cajero las envia desde el POS
 * y desaparecen automaticamente cuando se cobran — sin acciones de cocina.
 */

let businessName = 'Barbacoa & Antojitos';
const POLL_MS    = 8000;

// -- Reloj -------------------------------------------------------
function updateClock() {
  const el = document.getElementById('cocinaClock');
  if (el) el.textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// -- Tiempo relativo ---------------------------------------------
function timeAgo(isoStr) {
  const mins = Math.floor((Date.now() - new Date(isoStr)) / 60000);
  if (mins < 1)  return 'ahora';
  if (mins === 1) return 'hace 1 min';
  return `hace ${mins} min`;
}
function isLate(isoStr) {
  return (Date.now() - new Date(isoStr)) > 15 * 60 * 1000;
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// -- Tarjeta de orden --------------------------------------------
function renderCard(order) {
  const late      = isLate(order.timestamp);
  const ago       = timeAgo(order.timestamp);
  const isLlevar  = order.orderType === 'llevar';
  const typeLabel = isLlevar ? '🛍️ Para Llevar' : '🍽️ Aqui';
  const typeCls   = isLlevar ? 'order-type-llevar' : 'order-type-aqui';

  const itemsHtml = (order.items || []).map(it => `
    <li>
      <span class="order-item-qty">${it.qty}x</span>
      <span class="order-item-name">${it.emoji ? it.emoji + ' ' : ''}${escHtml(it.title)}</span>
    </li>
  `).join('');

  return `
    <div class="order-card${isLlevar ? ' card-llevar' : ''}" id="card-${order.id}">
      <div class="order-card-header">
        <span class="order-num">#${order.num || '-'}</span>
        <span class="order-time${late ? ' late' : ''}">${ago}</span>
      </div>
      <div class="order-type-tag ${typeCls}">${typeLabel}</div>
      <div class="order-client"><i class="fa-solid fa-user"></i> ${escHtml(order.clientName || 'Cliente')}</div>
      <ul class="order-items">${itemsHtml}</ul>
      <div class="order-actions">
        <button class="order-btn btn-print" onclick="printOrder('${order.id}')" title="Imprimir ticket">
          <i class="fa-solid fa-print"></i> Imprimir
        </button>
      </div>
    </div>
  `;
}

// -- Render de la cola -------------------------------------------
function renderQueue(data) {
  // pendingPayment = ordenes de hoy aun sin cobrar (desaparecen al cobrar en POS)
  const pending = (data.pendingPayment || []);
  const body    = document.getElementById('queueBody');
  const count   = document.getElementById('queueCount');
  if (!body) return;

  count.textContent = pending.length;

  if (!pending.length) {
    body.innerHTML = '<div class="queue-empty">Sin pedidos pendientes 🎉</div>';
    return;
  }

  // Mas antiguo arriba
  body.innerHTML = [...pending]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map(renderCard)
    .join('');
}

// -- API ---------------------------------------------------------
async function fetchOrders() {
  try {
    const res = await fetch('/api/orders', { cache: 'no-store' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    if (!res.ok) return;
    renderQueue(await res.json());
  } catch (e) {
    console.warn('Poll error:', e);
  }
}

// -- Impresion ---------------------------------------------------
async function printOrder(id) {
  const all = await fetch('/api/orders', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
  if (!all) return;
  const order = [...(all.active || []), ...(all.pendingPayment || [])].find(o => o.id === id);
  if (!order) return;

  const now = new Date(order.timestamp).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  const itemsHtml = (order.items || []).map(it => `
    <div class="print-row">
      <span class="print-qty">${it.qty}x</span>
      <span>${escHtml(it.title)}</span>
    </div>
  `).join('');

  document.getElementById('printArea').innerHTML = `
    <div class="print-header">
      <div class="print-business">${escHtml(businessName)}</div>
      <div>${now}</div>
      <div>Orden #${order.num || '-'}</div>
    </div>
    <div class="print-client">👤 ${escHtml(order.clientName || 'Cliente')}</div>
    <div class="print-divider"></div>
    ${itemsHtml}
    <div class="print-divider"></div>
    ${order.total ? `<div class="print-total">Total: $${Number(order.total).toLocaleString('es-MX')}</div>` : ''}
    <div class="print-footer">¡Gracias por su preferencia!</div>
  `;
  window.print();
}

// -- Init --------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
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

  await fetchOrders();
  setInterval(fetchOrders, POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fetchOrders();
  });
});