/**
 * TOTEM.JS — Pantalla interactiva para clientes (UX mejorado)
 * - Botón "Agregar" grande → se transforma en ±qty
 * - Badge flotante con cantidad
 * - Animación al agregar
 * - Sugerencias con fotos
 * - Carrito con controles ±qty inline
 * - Inactividad 60s → modal 15s
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

    const platillos = [], bebidas = [], postres = [];

    for (const key of this.PRODUCT_KEYS) {
      const p = this.getProduct(key);
      if (p.enabled === false) continue;
      const isKilo = (defaults[key]?.calcMode === 'kilo');
      if (isKilo && this.orderType !== 'llevar') continue;

      if (p.category === 'postre') postres.push({ key, ...p, isKilo });
      else if (['refresco', 'cafe'].includes(key)) bebidas.push({ key, ...p, isKilo });
      else platillos.push({ key, ...p, isKilo });
    }

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

    const extras = (this.cfg?.extraProducts || []).filter(ep => ep.enabled && ep.id);
    if (extras.length) {
      html += '<div class="menu-section-title">✨ Extras</div><div class="menu-grid">';
      extras.forEach(ep => {
        html += this.itemCard({ key: 'extra_' + ep.id, emoji: ep.emoji || '🍽️', title: ep.title || ep.id, price: Number(ep.price) || 0, priceNote: ep.priceNote || '', image: ep.image || '' });
      });
      html += '</div>';
    }

    // Conservar el monto que el cliente estaba escribiendo en barbacoa
    const pendingKilo = document.getElementById('kilo-inp')?.value || '';
    container.innerHTML = html || '<div style="text-align:center;color:#999;padding:40px;">No hay productos</div>';
    const kiloInp = document.getElementById('kilo-inp');
    if (kiloInp && pendingKilo) { kiloInp.value = pendingKilo; this.calcKilo(); }
    this.updateTotal();
  },

  itemCard(p) {
    const qty = this.getQty(p.key);
    const img = p.image
      ? `<img class="menu-card-img" src="${p.image}" alt="${p.title}" onerror="this.style.display='none'">`
      : `<div class="menu-card-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">${p.emoji}</div>`;
    const badge = qty > 0 ? `<div class="card-badge" id="badge-${p.key}">${qty}</div>` : '';
    const hasClass = qty > 0 ? ' has-items' : '';

    // Si qty es 0 → botón AGREGAR grande. Si qty > 0 → controles ±
    const controls = qty === 0
      ? `<button class="add-btn" onclick="event.stopPropagation();T.addItem('${p.key}')">Agregar +</button>`
      : `<div class="qty-controls">
          <button class="qty-btn" onclick="event.stopPropagation();T.changeQty('${p.key}',-1)">−</button>
          <div class="qty-val" id="qty-${p.key}">${qty}</div>
          <button class="qty-btn" onclick="event.stopPropagation();T.changeQty('${p.key}',1)">+</button>
        </div>`;

    return `<div class="menu-card${hasClass}" id="card-${p.key}">${badge}${img}<div class="menu-card-body">
      <div class="menu-card-name">${p.emoji} ${p.title}</div>
      <div class="menu-card-price">$${p.price}${p.priceNote ? ' · ' + p.priceNote : ''}</div>
      ${controls}</div></div>`;
  },

  kiloCard(p) {
    const img = p.image
      ? `<img class="menu-card-img" src="${p.image}" alt="${p.title}" onerror="this.style.display='none'">`
      : `<div class="menu-card-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;">${p.emoji}</div>`;
    // Porciones de barbacoa ya agregadas → feedback visible
    const kiloItems = this.cart.filter(c => c.key.startsWith('birria_kilo_'));
    const badge = kiloItems.length ? `<div class="card-badge">${kiloItems.length}</div>` : '';
    const chips = kiloItems.map(c => `
      <div class="kilo-chip">
        <span>✓ ${c.qty > 1 ? c.qty + '× ' : ''}$${c.price} · ${c.grams}g</span>
        <button onclick="event.stopPropagation();T.removeKilo('${c.key}')">✕</button>
      </div>`).join('');
    return `<div class="menu-card${kiloItems.length ? ' has-items' : ''}">${badge}${img}<div class="menu-card-body">
      <div class="menu-card-name">${p.emoji} ${p.title}</div>
      <div class="menu-card-price">$${p.price}/kg</div>
      ${chips}
      <div class="kilo-wrap">
        <div class="kilo-row">
          <span style="font-weight:700;color:var(--accent);font-size:1.2rem;">$</span>
          <input type="number" id="kilo-inp" placeholder="Monto" min="1" step="1" inputmode="numeric" oninput="T.calcKilo()">
          <button class="kilo-add" onclick="T.addKilo()">Agregar</button>
        </div>
        <div class="kilo-result" id="kilo-result"></div>
      </div>
    </div></div>`;
  },

  // ── Agregar item (primera vez) ────────────────────────────────
  addItem(key) {
    this.changeQty(key, 1);
    // Re-renderizar toda la tarjeta para mostrar los controles ±
    this.renderMenu();
    // Animación del badge
    setTimeout(() => {
      const badge = document.getElementById('badge-' + key);
      if (badge) badge.classList.add('pop');
    }, 50);
  },

  // ── Kilo ───────────────────────────────────────────────────────
  /** Gramos a entregar por un monto — reglas: <$80 → -20%, $80-$149 → -10%, $150+ → normal */
  kiloGrams(amount) {
    const priceKg = Number(this.getProduct('birria').price) || 250;
    const factor = amount < 80 ? 0.80 : amount < 150 ? 0.90 : 1;
    return Math.round((amount / priceKg) * 1000 * factor);
  },

  calcKilo() {
    const val = parseFloat(document.getElementById('kilo-inp')?.value);
    const el = document.getElementById('kilo-result');
    if (!el) return;
    el.textContent = (val > 0) ? `→ ${this.kiloGrams(val)}g` : '';
  },

  addKilo() {
    const p = this.getProduct('birria');
    const inp = document.getElementById('kilo-inp');
    const val = Math.round(parseFloat(inp?.value));
    if (!val || val <= 0) { inp?.focus(); return false; }
    const grams = this.kiloGrams(val);
    this.cart.push({
      key: 'birria_kilo_' + Date.now(),
      title: `${p.title || 'Barbacoa × Kilo'} (${grams}g)`,
      emoji: p.emoji || '🥩', qty: 1, price: val, subtotal: val, grams
    });
    if (inp) inp.value = '';
    this.renderMenu();   // muestra la porción agregada en la tarjeta
    this.resetIdle();
    return true;
  },

  removeKilo(key) {
    this.cart = this.cart.filter(c => c.key !== key);
    this.renderMenu();
    this.resetIdle();
  },

  // ── Cantidad ──────────────────────────────────────────────────
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
        // Re-render para volver al botón "Agregar"
        this.renderMenu();
      } else {
        existing.subtotal = existing.price * existing.qty;
        // Actualizar el número en la tarjeta
        const el = document.getElementById('qty-' + key);
        if (el) el.textContent = existing.qty;
        const badge = document.getElementById('badge-' + key);
        if (badge) { badge.textContent = existing.qty; badge.classList.add('pop'); setTimeout(() => badge.classList.remove('pop'), 300); }
      }
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
    // Actualizar en sugerencias si está visible
    const sugEl = document.getElementById('sqty-' + key);
    if (sugEl) sugEl.textContent = this.getQty(key);
    const sugBadge = document.getElementById('sbadge-' + key);
    if (sugBadge) { const q = this.getQty(key); if (q > 0) { sugBadge.textContent = q; sugBadge.style.display = 'flex'; } else sugBadge.style.display = 'none'; }
    this.updateTotal();
    this.resetIdle();
  },

  updateTotal() {
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    const count = this.cart.reduce((s, c) => s + c.qty, 0);
    ['bar-total', 'bar-total-suggest'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `$${total.toFixed(0)}`;
    });
    const itemsEl = document.getElementById('bar-items');
    if (itemsEl) itemsEl.textContent = count > 0 ? `${count} producto${count > 1 ? 's' : ''}` : '';
    // Pulsar botón continuar si hay items
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) {
      if (count > 0) continueBtn.classList.add('btn-pulse');
      else continueBtn.classList.remove('btn-pulse');
    }
  },

  // ── Sugerencias ────────────────────────────────────────────────
  goSuggestions() {
    // Si dejó un monto de barbacoa escrito sin tocar "Agregar", agregarlo
    const pending = parseFloat(document.getElementById('kilo-inp')?.value);
    if (pending > 0) this.addKilo();
    if (!this.cart.length) return;
    this.go('suggest');
  },

  renderSuggestions() {
    const grid = document.getElementById('suggest-grid');
    let html = '';
    for (const key of this.SUGGEST_KEYS) {
      const p = this.getProduct(key);
      if (p.enabled === false) continue;
      const qty = this.getQty(key);
      const img = p.image
        ? `<img class="suggest-card-img" src="${p.image}" alt="${p.title}" onerror="this.style.display='none'">`
        : `<div class="suggest-card-img" style="display:flex;align-items:center;justify-content:center;font-size:2.5rem;">${p.emoji}</div>`;
      const badge = qty > 0 ? `<div class="card-badge" id="sbadge-${key}">${qty}</div>` : `<div class="card-badge" id="sbadge-${key}" style="display:none;">0</div>`;
      const controls = qty === 0
        ? `<button class="add-btn" style="margin-top:6px;" onclick="T.addSuggest('${key}')">Agregar +</button>`
        : `<div class="qty-controls" style="margin-top:6px;">
            <button class="qty-btn" style="width:38px;height:38px;" onclick="T.changeQty('${key}',-1)">−</button>
            <div class="qty-val" id="sqty-${key}">${qty}</div>
            <button class="qty-btn" style="width:38px;height:38px;" onclick="T.changeQty('${key}',1)">+</button>
          </div>`;
      html += `<div class="suggest-card">${badge}${img}<div class="suggest-card-body">
        <div class="suggest-card-name">${p.emoji} ${p.title}</div>
        <div class="suggest-card-price">$${p.price}${p.priceNote ? ' · ' + p.priceNote : ''}</div>
        ${controls}
      </div></div>`;
    }
    grid.innerHTML = html;
    this.updateTotal();
  },

  addSuggest(key) {
    this.changeQty(key, 1);
    this.renderSuggestions();
    setTimeout(() => {
      const badge = document.getElementById('sbadge-' + key);
      if (badge) badge.classList.add('pop');
    }, 50);
  },

  // ── Carrito ───────────────────────────────────────────────────
  renderCart() {
    const list = document.getElementById('cart-list');
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    if (!this.cart.length) {
      list.innerHTML = '<div style="text-align:center;color:#999;padding:40px;font-size:1.2rem;">Tu carrito está vacío</div>';
    } else {
      list.innerHTML = this.cart.map((c, i) => `
        <div class="cart-row">
          <div class="cart-row-info">
            <div class="cart-row-name">${c.emoji} ${c.title}</div>
            <div class="cart-row-price">$${c.subtotal.toFixed(0)}</div>
          </div>
          <div class="cart-qty-controls">
            <button class="cart-qty-btn cart-qty-minus" onclick="T.cartQty(${i},-1)">−</button>
            <div class="cart-qty-val">${c.qty}</div>
            <button class="cart-qty-btn cart-qty-plus" onclick="T.cartQty(${i},1)">+</button>
          </div>
        </div>`).join('');
    }
    document.getElementById('cart-grand').textContent = `Total: $${total.toFixed(0)}`;
  },

  cartQty(index, delta) {
    const item = this.cart[index];
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) this.cart.splice(index, 1);
    else item.subtotal = item.price * item.qty;
    this.renderCart();
    this.updateTotal();
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
    const inp = document.getElementById('inp-name');
    if (inp) inp.value = '';
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
