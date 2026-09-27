/**
 * TOTEM.JS — Pantalla interactiva para clientes (tema claro)
 * Usa /api/config — mismos datos que el menú y POS
 * Sugerencias de postres + refrescos antes de confirmar
 * Modal de inactividad con countdown de 15s
 */
const T = {
  cfg: null,
  cart: [],
  name: '',
  orderType: '',
  idleTimer: null,
  idleCountdown: null,
  idleCount: 0,
  doneTimer: null,
  PRODUCT_KEYS: ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan', 'carlota', 'arrozconleche'],
  // Productos para sugerencias (postres + bebidas)
  SUGGEST_KEYS: ['carlota', 'arrozconleche', 'refresco', 'cafe', 'pan'],

  async init() {
    await this.loadConfig();
    this.setupIdle();
  },

  async loadConfig() {
    try {
      const r = await fetch('/api/config');
      if (r.ok) this.cfg = await r.json();
    } catch(e) { console.error('Config:', e); }
    if (!this.cfg) this.cfg = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA : {};
    const biz = this.cfg.business || {};
    document.getElementById('biz-name').textContent = biz.name || 'Barbacoa & Antojitos';
    document.getElementById('biz-slogan').textContent = biz.slogan || '';
  },

  // ── Helpers de producto ────────────────────────────────────────
  getProduct(key) {
    const defaults = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA.products : {};
    const server = this.cfg?.products || {};
    return { ...(defaults[key] || {}), ...(server[key] || {}) };
  },

  // ── Navegación ────────────────────────────────────────────────
  go(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('v-' + view);
    if (el) el.classList.add('active');

    if (view === 'name') setTimeout(() => document.getElementById('inp-name')?.focus(), 200);
    if (view === 'menu') this.renderMenu();
    if (view === 'suggest') this.renderSuggestions();
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
    const container = document.getElementById('menu-container');
    let html = '';
    const defaults = typeof DEFAULT_STORE_DATA !== 'undefined' ? DEFAULT_STORE_DATA.products : {};

    // Clasificar productos
    const platillos = [];
    const bebidas = [];
    const postres = [];

    for (const key of this.PRODUCT_KEYS) {
      const p = this.getProduct(key);
      if (p.enabled === false) continue;
      const isKilo = (defaults[key]?.calcMode === 'kilo');
      if (isKilo && this.orderType !== 'llevar') continue;

      if (p.category === 'postre') postres.push({ key, ...p, isKilo });
      else if (['refresco', 'cafe'].includes(key)) bebidas.push({ key, ...p, isKilo });
      else platillos.push({ key, ...p, isKilo });
    }

    // Renderizar por sección
    if (platillos.length) {
      html += '<div class="menu-section-title">🍽️ Platillos</div><div class="menu-grid">';
      platillos.forEach(p => { html += p.isKilo ? this.kiloCard(p) : this.itemCard(p); });
      html += '</div>';
    }
    if (postres.length) {
      html += '<div class="menu-section-title">🍰 Postres</div><div class="menu-grid">';
      postres.forEach(p => { html += this.itemCard(p); });
      html += '</div>';
    }
    if (bebidas.length) {
      html += '<div class="menu-section-title">☕ Bebidas</div><div class="menu-grid">';
      bebidas.forEach(p => { html += this.itemCard(p); });
      html += '</div>';
    }

    // Extras del admin
    const extras = (this.cfg?.extraProducts || []).filter(ep => ep.enabled && ep.id);
    if (extras.length) {
      html += '<div class="menu-section-title">✨ Extras</div><div class="menu-grid">';
      extras.forEach(ep => {
        html += this.itemCard({ key: 'extra_' + ep.id, emoji: ep.emoji || '🍽️', title: ep.title || ep.id, price: Number(ep.price) || 0, priceNote: ep.priceNote || '', image: ep.image || '' });
      });
      html += '</div>';
    }

    container.innerHTML = html || '<div style="text-align:center;color:#999;padding:40px;">No hay productos</div>';
    this.updateTotal();
  },

  itemCard(p) {
    const qty = this.getQty(p.key);
    const img = p.image ? `<img class="menu-card-img" src="${p.image}" alt="${p.title}" onerror="this.style.display='none'">` : `<div class="menu-card-img" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:#fef3c7;">${p.emoji}</div>`;
    return `<div class="menu-card">${img}<div class="menu-card-body">
      <div class="menu-card-name">${p.emoji} ${p.title}</div>
      <div class="menu-card-price">$${p.price}${p.priceNote ? ' · ' + p.priceNote : ''}</div>
      <div class="qty-row">
        <button class="qty-btn" onclick="T.changeQty('${p.key}',-1)">−</button>
        <div class="qty-val" id="qty-${p.key}">${qty}</div>
        <button class="qty-btn" onclick="T.changeQty('${p.key}',1)">+</button>
      </div></div></div>`;
  },

  kiloCard(p) {
    const img = p.image ? `<img class="menu-card-img" src="${p.image}" alt="${p.title}" onerror="this.style.display='none'">` : `<div class="menu-card-img" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;background:#fef3c7;">${p.emoji}</div>`;
    return `<div class="menu-card">${img}<div class="menu-card-body">
      <div class="menu-card-name">${p.emoji} ${p.title}</div>
      <div class="menu-card-price">$${p.price}/kg</div>
      <div class="kilo-inline">
        <span style="font-weight:700;color:var(--accent);">$</span>
        <input type="number" id="kilo-inp" placeholder="Monto" min="1" step="1" oninput="T.calcKilo()">
        <button class="kilo-add-btn" onclick="T.addKilo()">+</button>
      </div>
      <div class="kilo-result-sm" id="kilo-result"></div>
    </div></div>`;
  },

  // ── Kilo ───────────────────────────────────────────────────────
  calcKilo() {
    const p = this.getProduct('birria');
    const priceKg = Number(p.price) || 250;
    const val = parseFloat(document.getElementById('kilo-inp')?.value);
    const el = document.getElementById('kilo-result');
    if (!el) return;
    if (!val || val <= 0) { el.textContent = ''; return; }
    let grams = Math.round((val / priceKg) * 1000);
    if (val < 80) grams = Math.round(grams * 0.80);
    else if (val < 150) grams = Math.round(grams * 0.90);
    el.textContent = `→ ${grams}g`;
  },

  addKilo() {
    const p = this.getProduct('birria');
    const priceKg = Number(p.price) || 250;
    const val = parseFloat(document.getElementById('kilo-inp')?.value);
    if (!val || val <= 0) { document.getElementById('kilo-inp')?.focus(); return; }
    let grams = Math.round((val / priceKg) * 1000);
    if (val < 80) grams = Math.round(grams * 0.80);
    else if (val < 150) grams = Math.round(grams * 0.90);
    this.cart.push({
      key: 'birria_kilo_' + Date.now(),
      title: `${p.title || 'Barbacoa × Kilo'} (${grams}g)`,
      emoji: p.emoji || '🥩', qty: 1, price: val, subtotal: val
    });
    document.getElementById('kilo-inp').value = '';
    document.getElementById('kilo-result').textContent = '';
    this.updateTotal();
    this.resetIdle();
  },

  // ── Cart ──────────────────────────────────────────────────────
  getQty(key) {
    const item = this.cart.find(c => c.key === key);
    return item ? item.qty : 0;
  },

  changeQty(key, delta) {
    const existing = this.cart.find(c => c.key === key);
    if (existing) {
      existing.qty += delta;
      if (existing.qty <= 0) this.cart = this.cart.filter(c => c.key !== key);
      else existing.subtotal = existing.price * existing.qty;
    } else if (delta > 0) {
      let p;
      if (key.startsWith('extra_')) {
        const eid = key.replace('extra_', '');
        p = (this.cfg?.extraProducts || []).find(x => x.id === eid);
        if (!p) return;
      } else {
        p = this.getProduct(key);
      }
      this.cart.push({ key, title: p.title || key, emoji: p.emoji || '🍽️', qty: 1, price: Number(p.price) || 0, subtotal: Number(p.price) || 0 });
    }
    const el = document.getElementById('qty-' + key);
    if (el) el.textContent = this.getQty(key);
    // También actualizar en sugerencias
    const sugEl = document.getElementById('sqty-' + key);
    if (sugEl) sugEl.textContent = this.getQty(key);
    this.updateTotal();
    this.resetIdle();
  },

  updateTotal() {
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    ['bar-total', 'bar-total-suggest'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `$${total.toFixed(0)}`;
    });
  },

  // ── Sugerencias ────────────────────────────────────────────────
  goSuggestions() {
    if (!this.cart.length) return; // No dejar pasar sin productos
    this.go('suggest');
  },

  renderSuggestions() {
    const grid = document.getElementById('suggest-grid');
    let html = '';
    for (const key of this.SUGGEST_KEYS) {
      const p = this.getProduct(key);
      if (p.enabled === false) continue;
      const qty = this.getQty(key);
      html += `<div class="suggest-card">
        <div class="suggest-card-emoji">${p.emoji || '🍽️'}</div>
        <div class="suggest-card-name">${p.title}</div>
        <div class="suggest-card-price">$${p.price}${p.priceNote ? ' · ' + p.priceNote : ''}</div>
        <div class="qty-row" style="margin-top:8px;">
          <button class="qty-btn" style="width:32px;height:32px;" onclick="T.changeQty('${key}',-1)">−</button>
          <div class="qty-val" id="sqty-${key}" style="font-size:1.1rem;">${qty}</div>
          <button class="qty-btn" style="width:32px;height:32px;" onclick="T.changeQty('${key}',1)">+</button>
        </div>
      </div>`;
    }
    grid.innerHTML = html;
    this.updateTotal();
  },

  // ── Cart view ─────────────────────────────────────────────────
  renderCart() {
    const list = document.getElementById('cart-list');
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    if (!this.cart.length) {
      list.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">Tu carrito está vacío</div>';
    } else {
      list.innerHTML = this.cart.map((c, i) => `
        <div class="cart-row">
          <div><div class="cart-row-name">${c.emoji} ${c.qty}x ${c.title}</div></div>
          <div style="display:flex;align-items:center;">
            <div class="cart-row-price">$${c.subtotal.toFixed(0)}</div>
            <button class="cart-row-del" onclick="T.removeCart(${i})">✕</button>
          </div>
        </div>`).join('');
    }
    document.getElementById('cart-grand').textContent = `Total: $${total.toFixed(0)}`;
  },

  removeCart(i) {
    this.cart.splice(i, 1);
    this.renderCart();
    this.resetIdle();
  },

  // ── Submit ────────────────────────────────────────────────────
  async submitOrder() {
    if (!this.cart.length) return;
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    try {
      const r = await fetch('/api/totem-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: this.name,
          orderType: this.orderType,
          items: this.cart.map(c => ({ key: c.key, title: c.title, emoji: c.emoji, qty: c.qty, price: c.price, subtotal: c.subtotal })),
          total
        })
      });
      if (!r.ok) throw new Error('Error ' + r.status);
      document.getElementById('done-name').textContent = this.name;
      this.go('done');
      this.startDone();
    } catch(e) {
      alert('Error al enviar. Intenta de nuevo.');
      console.error(e);
    }
  },

  startDone() {
    let count = 10;
    clearInterval(this.doneTimer);
    const el = document.getElementById('done-timer');
    this.doneTimer = setInterval(() => {
      count--;
      if (el) el.textContent = `Reiniciando en ${count}...`;
      if (count <= 0) { clearInterval(this.doneTimer); this.go('welcome'); }
    }, 1000);
  },

  // ── Reset ─────────────────────────────────────────────────────
  resetAll() {
    this.cart = [];
    this.name = '';
    this.orderType = '';
    document.getElementById('inp-name').value = '';
    clearInterval(this.doneTimer);
    clearInterval(this.idleCountdown);
    document.getElementById('idle-overlay').classList.remove('active');
  },

  // ── Inactividad: 60s → modal → 15s countdown → reset ─────────
  setupIdle() {
    ['touchstart', 'click', 'input', 'scroll'].forEach(ev =>
      document.addEventListener(ev, () => this.resetIdle(), { passive: true })
    );
  },

  resetIdle() {
    clearTimeout(this.idleTimer);
    clearInterval(this.idleCountdown);
    document.getElementById('idle-overlay').classList.remove('active');

    const current = document.querySelector('.view.active')?.id;
    if (current && current !== 'v-welcome' && current !== 'v-done') {
      this.idleTimer = setTimeout(() => this.showIdleModal(), 60000);
    }
  },

  showIdleModal() {
    this.idleCount = 15;
    const overlay = document.getElementById('idle-overlay');
    const countEl = document.getElementById('idle-countdown');
    overlay.classList.add('active');
    countEl.textContent = this.idleCount;

    this.idleCountdown = setInterval(() => {
      this.idleCount--;
      countEl.textContent = this.idleCount;
      if (this.idleCount <= 0) {
        clearInterval(this.idleCountdown);
        overlay.classList.remove('active');
        this.go('welcome');
      }
    }, 1000);
  },

  dismissIdle() {
    clearInterval(this.idleCountdown);
    document.getElementById('idle-overlay').classList.remove('active');
    this.resetIdle();
  }
};

document.addEventListener('DOMContentLoaded', () => T.init());
