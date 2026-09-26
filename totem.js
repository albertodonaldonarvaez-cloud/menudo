/**
 * TOTEM.JS — Pantalla interactiva para clientes
 * Usa los mismos datos que el menú principal (precios, fotos, nombre)
 */
const T = {
  cfg: null,           // store config del servidor
  cart: [],            // [{key, title, emoji, qty, price, subtotal}]
  name: '',
  orderType: '',       // 'aqui' | 'llevar'
  idleTimer: null,
  doneTimer: null,
  doneCount: 0,
  PRODUCT_KEYS: ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan'],

  // ── Init ──────────────────────────────────────────────────────
  async init() {
    await this.loadConfig();
    this.setupIdle();
  },

  async loadConfig() {
    try {
      const r = await fetch('/api/config');
      if (r.ok) this.cfg = await r.json();
    } catch(e) { console.error('Config error:', e); }
    if (!this.cfg) this.cfg = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA : {};

    // Nombre del negocio
    const biz = this.cfg.business || {};
    document.getElementById('biz-name').textContent = biz.name || 'Barbacoa & Antojitos';
    document.getElementById('biz-slogan').textContent = biz.slogan || '';
  },

  // ── Navegación ────────────────────────────────────────────────
  go(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('v-' + view);
    if (el) el.classList.add('active');

    if (view === 'name') {
      setTimeout(() => document.getElementById('inp-name')?.focus(), 200);
    }
    if (view === 'menu') this.renderMenu();
    if (view === 'cart') this.renderCart();
    if (view === 'welcome') this.resetAll();
    this.resetIdle();
  },

  submitName() {
    const inp = document.getElementById('inp-name');
    const val = (inp?.value || '').trim();
    if (!val) { inp?.focus(); return; }
    this.name = val;
    this.go('type');
  },

  setType(type) {
    this.orderType = type;
    this.go('menu');
  },

  // ── Menú ──────────────────────────────────────────────────────
  renderMenu() {
    const grid = document.getElementById('menu-grid');
    const products = this.cfg?.products || {};
    const defaults = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA.products : {};
    let html = '';

    // Productos principales
    for (const key of this.PRODUCT_KEYS) {
      const p = { ...(defaults[key] || {}), ...(products[key] || {}) };
      if (p.enabled === false) continue;

      // Barbacoa por kilo solo disponible para llevar
      const isKilo = (defaults[key]?.calcMode === 'kilo');
      if (isKilo && this.orderType !== 'llevar') continue;

      const img = p.image || defaults[key]?.image || '';
      const emoji = p.emoji || '🍽️';
      const title = p.title || key;
      const price = Number(p.price) || 0;
      const note = p.priceNote || '';

      if (isKilo) {
        html += this.renderKiloCard(key, emoji, title, price, note, img);
      } else {
        const qty = this.getQty(key);
        html += this.renderItemCard(key, emoji, title, price, note, img, qty);
      }
    }

    // Productos extra
    const extras = this.cfg?.extraProducts || [];
    for (const ep of extras) {
      if (!ep.enabled || !ep.id) continue;
      const qty = this.getQty('extra_' + ep.id);
      html += this.renderItemCard('extra_' + ep.id, ep.emoji || '🍽️', ep.title || ep.id, Number(ep.price) || 0, ep.priceNote || '', ep.image || '', qty);
    }

    grid.innerHTML = html || '<div style="grid-column:1/-1;text-align:center;color:#666;padding:40px;">No hay productos disponibles</div>';
    this.updateTotal();
  },

  renderItemCard(key, emoji, title, price, note, img, qty) {
    const imgTag = img ? `<img class="menu-card-img" src="${img}" alt="${title}" onerror="this.style.display='none'">` : `<div class="menu-card-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">${emoji}</div>`;
    return `
      <div class="menu-card">
        ${imgTag}
        <div class="menu-card-body">
          <div class="menu-card-name">${emoji} ${title}</div>
          <div class="menu-card-price">$${price}${note ? ' <span class="menu-card-note">' + note + '</span>' : ''}</div>
          <div class="qty-row">
            <button class="qty-btn" onclick="T.changeQty('${key}',-1)">−</button>
            <div class="qty-val" id="qty-${key}">${qty}</div>
            <button class="qty-btn" onclick="T.changeQty('${key}',1)">+</button>
          </div>
        </div>
      </div>`;
  },

  renderKiloCard(key, emoji, title, price, note, img) {
    const imgTag = img ? `<img class="menu-card-img" src="${img}" alt="${title}" onerror="this.style.display='none'">` : `<div class="menu-card-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">${emoji}</div>`;
    return `
      <div class="menu-card" style="grid-column: 1/-1;">
        ${imgTag}
        <div class="menu-card-body">
          <div class="menu-card-name">${emoji} ${title}</div>
          <div class="menu-card-price">$${price} / kg</div>
          <div class="kilo-wrap">
            <div class="kilo-row">
              <span style="color:var(--accent);font-weight:700;">$</span>
              <input type="number" class="kilo-input" id="kilo-inp" placeholder="Monto..." min="1" step="1" oninput="T.calcKilo()">
            </div>
            <div class="kilo-result" id="kilo-result"></div>
            <button class="kilo-add" onclick="T.addKilo()">Agregar al pedido</button>
          </div>
        </div>
      </div>`;
  },

  // ── Kilo calculator ───────────────────────────────────────────
  calcKilo() {
    const key = 'birria';
    const products = this.cfg?.products || {};
    const defaults = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA.products : {};
    const p = { ...(defaults[key] || {}), ...(products[key] || {}) };
    const priceKg = Number(p.price) || 250;

    const val = parseFloat(document.getElementById('kilo-inp')?.value);
    const el = document.getElementById('kilo-result');
    if (!el) return;
    if (!val || val <= 0) { el.textContent = ''; return; }

    let grams = Math.round((val / priceKg) * 1000);
    let note = '';
    if (val < 50) { grams = Math.round(grams * 0.70); note = ' (ajuste porción)'; }
    else if (val < 100) { grams = Math.round(grams * 0.90); note = ' (ajuste porción)'; }
    el.textContent = `→ ${grams} gramos${note}`;
  },

  addKilo() {
    const key = 'birria';
    const products = this.cfg?.products || {};
    const defaults = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA.products : {};
    const p = { ...(defaults[key] || {}), ...(products[key] || {}) };
    const priceKg = Number(p.price) || 250;

    const val = parseFloat(document.getElementById('kilo-inp')?.value);
    if (!val || val <= 0) { document.getElementById('kilo-inp')?.focus(); return; }

    let grams = Math.round((val / priceKg) * 1000);
    if (val < 50) grams = Math.round(grams * 0.70);
    else if (val < 100) grams = Math.round(grams * 0.90);

    this.cart.push({
      key: key + '_kilo_' + Date.now(),
      title: `${p.title || 'Barbacoa × Kilo'} (${grams} g)`,
      emoji: p.emoji || '🥩',
      qty: 1,
      price: val,
      subtotal: val
    });

    document.getElementById('kilo-inp').value = '';
    document.getElementById('kilo-result').textContent = '';
    this.updateTotal();
    this.resetIdle();
  },

  // ── Cart logic ────────────────────────────────────────────────
  getQty(key) {
    const item = this.cart.find(c => c.key === key);
    return item ? item.qty : 0;
  },

  changeQty(key, delta) {
    const existing = this.cart.find(c => c.key === key);
    if (existing) {
      existing.qty += delta;
      if (existing.qty <= 0) {
        this.cart = this.cart.filter(c => c.key !== key);
      } else {
        existing.subtotal = existing.price * existing.qty;
      }
    } else if (delta > 0) {
      // Find product info
      const products = this.cfg?.products || {};
      const defaults = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA.products : {};
      let p, realKey = key;

      if (key.startsWith('extra_')) {
        const eid = key.replace('extra_', '');
        const ep = (this.cfg?.extraProducts || []).find(x => x.id === eid);
        if (!ep) return;
        p = ep;
      } else {
        p = { ...(defaults[key] || {}), ...(products[key] || {}) };
      }

      this.cart.push({
        key,
        title: p.title || key,
        emoji: p.emoji || '🍽️',
        qty: 1,
        price: Number(p.price) || 0,
        subtotal: Number(p.price) || 0
      });
    }

    // Update qty display
    const el = document.getElementById('qty-' + key);
    if (el) el.textContent = this.getQty(key);
    this.updateTotal();
    this.resetIdle();
  },

  updateTotal() {
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    const barEl = document.getElementById('bar-total');
    if (barEl) barEl.textContent = `$${total.toFixed(0)}`;
  },

  // ── Cart view ─────────────────────────────────────────────────
  renderCart() {
    const list = document.getElementById('cart-list');
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);

    if (!this.cart.length) {
      list.innerHTML = '<div style="text-align:center;color:#666;padding:40px;">Tu carrito está vacío</div>';
    } else {
      list.innerHTML = this.cart.map((c, i) => `
        <div class="cart-row">
          <div>
            <div class="cart-row-name">${c.emoji} ${c.qty}x ${c.title}</div>
            <div class="cart-row-detail">$${c.price} c/u</div>
          </div>
          <div style="display:flex;align-items:center;">
            <div class="cart-row-price">$${c.subtotal.toFixed(0)}</div>
            <button class="cart-row-del" onclick="T.removeCart(${i})">✕</button>
          </div>
        </div>`).join('');
    }

    document.getElementById('cart-grand').textContent = `Total: $${total.toFixed(0)}`;
  },

  removeCart(index) {
    this.cart.splice(index, 1);
    this.renderCart();
    this.resetIdle();
  },

  // ── Submit order ──────────────────────────────────────────────
  async submitOrder() {
    if (!this.cart.length) return;

    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    const body = {
      clientName: this.name,
      orderType: this.orderType,
      items: this.cart.map(c => ({
        key: c.key,
        title: c.title,
        emoji: c.emoji,
        qty: c.qty,
        price: c.price,
        subtotal: c.subtotal
      })),
      total
    };

    try {
      const r = await fetch('/api/totem-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error('Error ' + r.status);
      this.go('done');
      this.startDoneCountdown();
    } catch(e) {
      alert('Error al enviar tu pedido. Intenta de nuevo.');
      console.error(e);
    }
  },

  startDoneCountdown() {
    this.doneCount = 10;
    clearInterval(this.doneTimer);
    const el = document.getElementById('done-timer');
    this.doneTimer = setInterval(() => {
      this.doneCount--;
      if (el) el.textContent = `Reiniciando en ${this.doneCount}...`;
      if (this.doneCount <= 0) {
        clearInterval(this.doneTimer);
        this.go('welcome');
      }
    }, 1000);
  },

  // ── Reset ─────────────────────────────────────────────────────
  resetAll() {
    this.cart = [];
    this.name = '';
    this.orderType = '';
    document.getElementById('inp-name').value = '';
    clearInterval(this.doneTimer);
  },

  // ── Inactivity ────────────────────────────────────────────────
  setupIdle() {
    ['touchstart', 'click', 'input'].forEach(ev =>
      document.addEventListener(ev, () => this.resetIdle(), { passive: true })
    );
  },

  resetIdle() {
    clearTimeout(this.idleTimer);
    const current = document.querySelector('.view.active')?.id;
    if (current && current !== 'v-welcome' && current !== 'v-done') {
      this.idleTimer = setTimeout(() => this.go('welcome'), 60000);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => T.init());
