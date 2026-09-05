'use strict';
/**
 * COCINA.JS v2.5
 * Cola simple de pedidos pendientes.
 * Solo muestra lo que hay que preparar; al marcar Listo desaparece de la pantalla.
 */

let businessName = 'Barbacoa & Antojitos';
let pollTimer    = null;
const POLL_MS    = 8000;

// ── Reloj ─────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('cocinaClock');
  if (el) el.textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Tiempo relativo ───────────────────────────────────────────
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

// ── Tarjeta de orden ──────────────────────────────────────────
function renderCard(order) {
  const late      = isLate(order.timestamp);
  const ago       = timeAgo(order.timestamp);
  const isLlevar  = order.orderType === 'llevar';
  const typeLabel = isLlevar ? '🛍️ Para Llevar' : '🍽️ Aquí';
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
        <span class="order-num">#${order.num || '–'}</span>
        <span class="order-time${late ? ' late' : ''}">${ago}</span>
      </div>
      <div class="order-type-tag ${typeCls}">${typeLabel}</div>
      <div class="order-client"><i class="fa-solid fa-user"></i> ${escHtml(order.clientName || 'Cliente')}</div>
      <ul class="order-items">${itemsHtml}</ul>
      <div class="order-actions">
        <button class="order-btn btn-print" onclick="printOrder('${order.id}')" title="Imprimir ticket">
          <i class="fa-solid fa-print"></i>
        </button>
        <button class="order-btn btn-done" onclick="markDone('${order.id}')">
          <i class="fa-solid fa-check"></i> Listo — quitar de cola
        </button>
      </div>
    </div>
  `;
}

// ── Render de la cola ─────────────────────────────────────────
function renderQueue(data) {
  const pending = (data.active || []).filter(o => o.status === 'pendiente' || o.status === 'en_prep');
  const body    = document.getElementById('queueBody');
  const count   = document.getElementById('queueCount');
  if (!body) return;

  count.textContent = pending.length;

  if (!pending.length) {
    body.innerHTML = '<div class="queue-empty">Sin pedidos pendientes 🎉</div>';
    return;
  }

  // Más antiguo arriba (el que lleva más esperando)
  body.innerHTML = pending
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
    renderQueue(await res.json());
  } catch (e) {
    console.warn('Poll error:', e);
  }
}

async function markDone(id) {
  // Feedback visual inmediato
  const card = document.getElementById(`card-${id}`);
  if (card) {
    card.style.transition = 'opacity 0.3s, transform 0.3s';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(0.95)';
  }
  try {
    await fetch(`/api/orders/${id}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'listo' })
    });
  } catch (e) {
    console.warn('Error al marcar listo:', e);
  }
  // Refresca tras la animación
  setTimeout(fetchOrders, 350);
}

// ── Impresión ─────────────────────────────────────────────────
async function printOrder(id) {
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
      <span>${escHtml(it.title)}</span>
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
    <div class="print-footer">¡Gracias por su preferencia!</div>
  `;
  window.print();
}

// ── Init ──────────────────────────────────────────────────────
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
  pollTimer = setInterval(fetchOrders, POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') fetchOrders();
  });
});