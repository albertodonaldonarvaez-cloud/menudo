/**
 * TOTEM.JS v3 — Pantalla interactiva para clientes
 * - Precios SIEMPRE del admin (/api/config); se refrescan solos y el servidor los vuelve a validar
 * - Barra de pasos + botón Cancelar en todo momento
 * - Teclado en pantalla para el nombre (no depende del teclado del sistema)
 * - Barbacoa × kilo con montos rápidos, mínimo y gramos en vivo (reglas en data.js)
 * - Sugerencias de postres/bebidas, carrito editable, número de orden al final
 * - Inactividad 60 s → "¿Sigues ahí?" 15 s → limpia y regresa al inicio
 */
const T = {
  cfg: null,
  cart: [],
  name: '',
  orderType: '',
  kiloAmount: null,
  sending: false,
  idleTimer: null, idleCountdown: null, idleCount: 0,
  doneTimer: null, heroTimer: null,

  PRODUCT_KEYS: ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan', 'carlota', 'arrozconleche'],
  SUGGEST_KEYS: ['carlota', 'arrozconleche', 'refresco', 'cafe', 'pan'],
  STEPS: [['name', 'Nombre'], ['type', 'Dónde'], ['menu', 'Menú'], ['cart', 'Confirmar']],
  NAME_MAX: 20,

  // ── Arranque ──────────────────────────────────────────────────
  async init() {
    await this.loadConfig();
    this.buildKeyboard();
    this.setupIdle();
    this.startHero();
    // Precios del admin: refrescar cada minuto mientras nadie está ordenando
    setInterval(() => { if (this.current() === 'welcome') this.loadConfig(); }, 60_000);
    document.addEventListener('keydown', e => this.onPhysicalKey(e));
  },

  async loadConfig() {
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) {
        const data = await r.json();
        if (data && data.products) this.cfg = data;
      }
    } catch (e) { console.warn('Config:', e); }
    if (!this.cfg) this.cfg = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
    const biz = this.cfg.business || {};
    document.getElementById('biz-name').textContent = biz.name || 'Barbacoa & Antojitos';
    document.getElementById('biz-slogan').textContent = biz.slogan || '';
  },

  // ── Helpers ───────────────────────────────────────────────────
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  money(n) { return '$' + Math.round(n || 0).toLocaleString('es-MX'); },
  current() { return document.querySelector('.view.active')?.id.replace('v-', ''); },

  /** Producto fijo: defaults de código + lo que guardó el admin (precio, nombre, foto…) */
  getProduct(key) {
    const def = DEFAULT_STORE_DATA.products[key];
    if (!def) return null;
    return { key, ...def, ...((this.cfg?.products || {})[key] || {}), calcMode: def.calcMode };
  },

  /** Producto fijo o extra del admin, por key del carrito */
  lookup(key) {
    if (key.startsWith('extra_')) {
      const ep = (this.cfg?.extraProducts || []).find(x => 'extra_' + x.id === key);
      return ep ? { key, ...ep, price: Number(ep.price) || 0 } : null;
    }
    return this.getProduct(key);
  },

  isAvailable(p) { return p && p.enabled !== false; },
  kiloPriceKg() { return Number(this.getProduct('birria')?.price) || 0; },
  hasKiloItems() { return this.cart.some(c => c.key.startsWith('birria_kilo_')); },

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('show'), 1600);
  },

  showModal(title, text, actions) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-text').textContent = text;
    const box = document.getElementById('modal-actions');
    box.innerHTML = '';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn' + (a.ghost ? ' btn-ghost btn-sm' : '');
      b.textContent = a.label;
      b.onclick = () => { this.hideModal(); a.onClick?.(); };
      box.appendChild(b);
    });
    document.getElementById('modal').classList.add('active');
  },
  hideModal() { document.getElementById('modal').classList.remove('active'); },

  // ── Navegación ────────────────────────────────────────────────
  go(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('v-' + view)?.classList.add('active');
    if (view !== 'done') clearInterval(this.doneTimer);

    this.renderSteps(view);
    if (view === 'welcome') { this.resetAll(); this.loadConfig(); }
    if (view === 'name') this.renderName();
    if (view === 'type') document.getElementById('type-question').textContent = `${this.name ? this.name + ', ¿' : '¿'}dónde vas a comer?`;
    if (view === 'menu') this.renderMenu(true);
    if (view === 'suggest') this.renderSuggestions();
    if (view === 'cart') { this.repriceCart(); this.renderCart(); }
    this.resetIdle();
  },

  start() { this.go('name'); },

  renderSteps(view) {
    const bar = document.getElementById('topbar');
    const map = { name: 0, type: 1, menu: 2, suggest: 2, cart: 3 };
    if (!(view in map)) { bar.classList.remove('show'); return; }
    bar.classList.add('show');
    const idx = map[view];
    document.getElementById('steps').innerHTML = this.STEPS.map(([, label], i) => `
      <div class="step ${i < idx ? 'done' : i === idx ? 'active' : ''}">
        <span class="step-dot">${i < idx ? '✓' : i + 1}</span><span>${label}</span>
      </div>`).join('');
  },

  askCancel() {
    this.showModal('¿Cancelar tu pedido?', 'Se borrará todo lo que llevas seleccionado.', [
      { label: 'Sí, cancelar', onClick: () => this.go('welcome') },
      { label: 'No, seguir ordenando', ghost: true }
    ]);
  },

  // ── Bienvenida: fotos rotando ─────────────────────────────────
  startHero() {
    const img = document.getElementById('hero-img');
    let i = 0;
    const next = () => {
      const pics = ['menudo', 'birria', 'tacos', 'quesadillas', 'carlota']
        .map(k => this.getProduct(k)).filter(p => this.isAvailable(p) && p.image).map(p => p.image);
      if (!pics.length) return;
      img.style.opacity = 0;
      setTimeout(() => { img.src = pics[i++ % pics.length]; img.style.opacity = 1; }, 300);
    };
    next();
    this.heroTimer = setInterval(next, 5000);
  },

  // ── Nombre con teclado en pantalla ────────────────────────────
  buildKeyboard() {
    const rows = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];
    let html = rows.map((r, i) => `<div class="kbd-row">${[...r].map(ch =>
      `<button class="key" onclick="T.typeKey('${ch}')">${ch}</button>`).join('')}${
      i === 2 ? '<button class="key key-del" onclick="T.backspace()">⌫ Borrar</button>' : ''}</div>`).join('');
    html += '<div class="kbd-row"><button class="key key-wide" onclick="T.typeKey(\' \')">Espacio</button></div>';
    document.getElementById('kbd').innerHTML = html;
  },

  typeKey(ch) {
    if (this.name.length >= this.NAME_MAX) return;
    if (ch === ' ' && (!this.name || this.name.endsWith(' '))) return;
    const upper = !this.name || this.name.endsWith(' ');
    this.name += upper ? ch.toUpperCase() : ch.toLowerCase();
    this.renderName();
    this.resetIdle();
  },

  backspace() {
    this.name = this.name.slice(0, -1);
    this.renderName();
    this.resetIdle();
  },

  renderName() {
    const el = document.getElementById('name-display');
    if (this.name) { el.classList.remove('empty'); el.innerHTML = this.esc(this.name) + '<span class="caret"></span>'; }
    else { el.classList.add('empty'); el.textContent = 'Escribe tu nombre'; }
    document.getElementById('btn-name').disabled = !this.name.trim();
  },

  onPhysicalKey(e) {
    this.resetIdle();
    if (this.current() !== 'name') return;
    if (e.key === 'Backspace') { e.preventDefault(); this.backspace(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.submitName(); }
    else if (/^[a-zA-ZñÑáéíóúÁÉÍÓÚüÜ ]$/.test(e.key)) { e.preventDefault(); this.typeKey(e.key); }
  },

  submitName() {
    this.name = this.name.trim();
    if (!this.name) return;
    this.go('type');
  },

  setType(type) {
    if (type === 'aqui' && this.hasKiloItems()) {
      this.cart = this.cart.filter(c => !c.key.startsWith('birria_kilo_'));
      this.toast('La barbacoa por kilo es solo para llevar');
    }
    this.orderType = type;
    this.go('menu');
  },

  // ── Menú ──────────────────────────────────────────────────────
  menuGroups() {
    const groups = { platillos: [], postres: [], bebidas: [], extras: [] };
    for (const key of this.PRODUCT_KEYS) {
      const p = this.getProduct(key);
      if (!this.isAvailable(p)) continue;
      if (p.calcMode === 'kilo' && this.orderType !== 'llevar') continue; // kilo solo para llevar
      if (p.category === 'postre') groups.postres.push(p);
      else if (['refresco', 'cafe', 'pan'].includes(key)) groups.bebidas.push(p);
      else groups.platillos.push(p);
    }
    (this.cfg?.extraProducts || []).filter(ep => ep.enabled && ep.id).forEach(ep =>
      groups.extras.push({ ...ep, key: 'extra_' + ep.id, price: Number(ep.price) || 0 }));
    return [
      ['platillos', '🍽️ Platillos', groups.platillos],
      ['postres', '🍰 Postres', groups.postres],
      ['bebidas', '☕ Bebidas y pan', groups.bebidas],
      ['extras', '✨ Más opciones', groups.extras]
    ].filter(g => g[2].length);
  },

  renderMenu(resetScroll) {
    const scroller = document.getElementById('menu-scroll');
    const keepScroll = resetScroll ? 0 : scroller.scrollTop;
    document.getElementById('menu-greet').textContent = `¡Hola, ${this.name}! ¿Qué se te antoja? 🔥`;
    document.getElementById('menu-type-pill').textContent = (this.orderType === 'llevar' ? '🛍️ Para llevar' : '🍽️ Para aquí') + ' · cambiar';

    const groups = this.menuGroups();
    document.getElementById('cat-chips').innerHTML = groups.map(([id, label], i) =>
      `<button class="cat-chip${i === 0 ? ' active' : ''}" data-sec="${id}" onclick="T.jumpTo('${id}')">${label}</button>`).join('');

    document.getElementById('menu-container').innerHTML = groups.map(([id, label, items]) =>
      `<div class="menu-section-title" id="sec-${id}">${label}</div>
       <div class="menu-grid">${items.map(p => p.calcMode === 'kilo' ? this.kiloCard(p) : this.itemCard(p)).join('')}</div>`
    ).join('') || '<div style="text-align:center;color:#999;padding:40px;font-size:1.3rem;">No hay productos disponibles</div>';

    scroller.scrollTop = keepScroll;
    scroller.onscroll = () => this.syncChips();
    this.updateKiloUI();
    this.updateTotal();
  },

  jumpTo(id) {
    document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  syncChips() {
    const scroller = document.getElementById('menu-scroll');
    const chips = [...document.querySelectorAll('.cat-chip')];
    let active = chips[0]?.dataset.sec;
    document.querySelectorAll('#menu-container .menu-section-title').forEach(s => {
      if (s.offsetTop - scroller.scrollTop < 140) active = s.id.replace('sec-', '');
    });
    chips.forEach(c => c.classList.toggle('active', c.dataset.sec === active));
  },

  imgHtml(p) {
    return p.image
      ? `<img class="menu-card-img" src="${this.esc(p.image)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;menu-card-img&quot;>${this.esc(p.emoji || '🍽️')}</div>'">`
      : `<div class="menu-card-img">${this.esc(p.emoji || '🍽️')}</div>`;
  },

  itemCard(p) {
    const qty = this.getQty(p.key);
    const controls = qty === 0
      ? `<button class="add-btn" onclick="T.changeQty('${p.key}',1)">Agregar +</button>`
      : `<div class="qty-controls">
           <button class="qty-btn minus" onclick="T.changeQty('${p.key}',-1)">−</button>
           <div class="qty-val">${qty}</div>
           <button class="qty-btn" onclick="T.changeQty('${p.key}',1)">+</button>
         </div>`;
    return `<div class="menu-card${qty ? ' has-items' : ''}">
      ${qty ? `<div class="card-badge" id="badge-${p.key}">${qty}</div>` : ''}
      ${this.imgHtml(p)}
      <div class="menu-card-body">
        <div class="menu-card-name">${this.esc(p.emoji || '')} ${this.esc(p.title)}</div>
        ${p.description ? `<div class="menu-card-desc">${this.esc(p.description)}</div>` : ''}
        <div class="menu-card-price">${this.money(p.price)}${p.priceNote ? ` <small>${this.esc(p.priceNote)}</small>` : ''}</div>
        ${controls}
      </div>
    </div>`;
  },

  // ── Barbacoa × kilo ───────────────────────────────────────────
  kiloCard(p) {
    const added = this.cart.filter(c => c.key.startsWith('birria_kilo_'));
    const priceKg = this.kiloPriceKg();
    return `<div class="menu-card kilo-card${added.length ? ' has-items' : ''}">
      ${added.length ? `<div class="card-badge">${added.length}</div>` : ''}
      ${this.imgHtml(p)}
      <div class="menu-card-body">
        <div class="menu-card-name">${this.esc(p.emoji || '🥩')} ${this.esc(p.title)}</div>
        <div class="menu-card-price">${this.money(priceKg)} <small>por kg · ¿cuánto quieres llevar?</small></div>
        <div class="kilo-chips">
          ${KILO_RULES.quickAmounts.map(a => `
            <button class="kilo-chip-btn" data-amt="${a}" onclick="T.selectKilo(${a})">
              ${this.money(a)}<small>${kiloGramsFor(a, priceKg)} g</small>
            </button>`).join('')}
        </div>
        <div class="kilo-stepper">
          <button class="qty-btn minus" onclick="T.stepKilo(-10)">−$10</button>
          <div class="kilo-amount" id="kilo-amount">Elige un monto</div>
          <button class="qty-btn" onclick="T.stepKilo(10)">+$10</button>
        </div>
        <div class="kilo-grams" id="kilo-grams">Mínimo ${this.money(KILO_RULES.minAmount)}</div>
        <button class="add-btn" id="kilo-add" onclick="T.addKilo()" disabled>Agregar barbacoa +</button>
        ${added.length ? `<div class="kilo-added">${added.map(c => `
          <div class="kilo-tag">✓ ${c.qty > 1 ? c.qty + '× ' : ''}${this.money(c.price)} · ${c.grams} g
            <button onclick="T.removeItem('${c.key}')">✕</button></div>`).join('')}</div>` : ''}
      </div>
    </div>`;
  },

  selectKilo(amount) { this.kiloAmount = amount; this.updateKiloUI(); this.resetIdle(); },

  stepKilo(delta) {
    const min = KILO_RULES.minAmount;
    this.kiloAmount = this.kiloAmount == null ? min : Math.min(5000, Math.max(min, this.kiloAmount + delta));
    this.updateKiloUI();
    this.resetIdle();
  },

  updateKiloUI() {
    const amtEl = document.getElementById('kilo-amount');
    if (!amtEl) return;
    const a = this.kiloAmount;
    amtEl.textContent = a ? this.money(a) : 'Elige un monto';
    document.getElementById('kilo-grams').textContent = a
      ? `Te llevas ≈ ${kiloGramsFor(a, this.kiloPriceKg())} g`
      : `Mínimo ${this.money(KILO_RULES.minAmount)}`;
    document.getElementById('kilo-add').disabled = !a;
    document.querySelectorAll('.kilo-chip-btn').forEach(b => b.classList.toggle('sel', Number(b.dataset.amt) === a));
  },

  addKilo() {
    const a = this.kiloAmount;
    const p = this.getProduct('birria');
    if (!a || a < KILO_RULES.minAmount || !this.isAvailable(p)) return;
    const grams = kiloGramsFor(a, this.kiloPriceKg());
    this.cart.push({ key: 'birria_kilo_' + Date.now(), title: `${p.title} (${grams}g)`, emoji: p.emoji || '🥩', qty: 1, price: a, subtotal: a, grams });
    this.kiloAmount = null;
    this.toast(`✓ Barbacoa ${this.money(a)} agregada`);
    this.renderMenu();
  },

  // ── Carrito ───────────────────────────────────────────────────
  getQty(key) { return this.cart.find(c => c.key === key)?.qty || 0; },

  changeQty(key, delta) {
    const existing = this.cart.find(c => c.key === key);
    if (existing) {
      existing.qty += delta;
      if (existing.qty <= 0) this.cart = this.cart.filter(c => c !== existing);
      else existing.subtotal = existing.price * existing.qty;
    } else if (delta > 0) {
      const p = this.lookup(key);
      if (!this.isAvailable(p)) return;
      this.cart.push({ key, title: p.title, emoji: p.emoji || '🍽️', qty: 1, price: Number(p.price) || 0, subtotal: Number(p.price) || 0 });
      this.toast(`✓ ${p.title} agregado`);
    }
    this.refreshView();
    setTimeout(() => document.getElementById('badge-' + key)?.classList.add('pop'), 20);
  },

  removeItem(key) {
    this.cart = this.cart.filter(c => c.key !== key);
    this.refreshView();
  },

  refreshView() {
    const v = this.current();
    if (v === 'menu') this.renderMenu();
    else if (v === 'suggest') this.renderSuggestions();
    else if (v === 'cart') this.renderCart();
    this.updateTotal();
    this.resetIdle();
  },

  updateTotal() {
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    const count = this.cart.reduce((s, c) => s + c.qty, 0);
    const label = count ? `${count} producto${count > 1 ? 's' : ''}` : 'Agrega tus productos';
    ['bar-total', 'bar-total-suggest'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = this.money(total); });
    ['bar-items', 'bar-items-suggest'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = label; });
    const cont = document.getElementById('btn-continue');
    cont.disabled = !count;
    cont.classList.toggle('btn-pulse', count > 0);
    const anySuggest = this.cart.some(c => this.SUGGEST_KEYS.includes(c.key));
    document.getElementById('btn-suggest-next').textContent = anySuggest ? 'Continuar ➔' : 'No, gracias ➔';
  },

  /** Después del menú: sugerencias solo si hay postres/bebidas disponibles que aún no lleva */
  goNextFromMenu() {
    if (!this.cart.length) return;
    const pending = this.SUGGEST_KEYS.some(k => this.isAvailable(this.getProduct(k)) && !this.getQty(k));
    this.go(pending ? 'suggest' : 'cart');
  },

  renderSuggestions() {
    const items = this.SUGGEST_KEYS.map(k => this.getProduct(k)).filter(p => this.isAvailable(p));
    document.getElementById('suggest-grid').innerHTML = items.map(p => this.itemCard(p)).join('');
    this.updateTotal();
  },

  /** Antes de confirmar: precios y nombres actuales del admin; quita lo que ya no está disponible */
  repriceCart() {
    const before = this.cart.length;
    const priceKg = this.kiloPriceKg();
    this.cart = this.cart.filter(c => {
      if (c.key.startsWith('birria_kilo_')) {
        const p = this.getProduct('birria');
        if (!this.isAvailable(p) || !priceKg || this.orderType !== 'llevar') return false;
        c.grams = kiloGramsFor(c.price, priceKg);
        c.title = `${p.title} (${c.grams}g)`;
      } else {
        const p = this.lookup(c.key);
        if (!this.isAvailable(p)) return false;
        c.price = Number(p.price) || 0;
        c.title = p.title;
      }
      c.subtotal = c.price * c.qty;
      return true;
    });
    if (this.cart.length < before) this.toast('Quitamos productos que ya no están disponibles');
  },

  renderCart() {
    document.getElementById('cart-name').textContent = `👤 ${this.name} · cambiar`;
    document.getElementById('cart-type').textContent = (this.orderType === 'llevar' ? '🛍️ Para llevar' : '🍽️ Para aquí') + ' · cambiar';
    const list = document.getElementById('cart-list');
    if (!this.cart.length) {
      list.innerHTML = '<div style="text-align:center;color:#999;padding:40px;font-size:1.3rem;">Tu pedido está vacío</div>';
    } else {
      list.innerHTML = this.cart.map((c, i) => `
        <div class="cart-row">
          <div class="cart-emoji">${this.esc(c.emoji)}</div>
          <div class="cart-row-info">
            <div class="cart-row-name">${this.esc(c.title)}</div>
            <div class="cart-row-unit">${this.money(c.price)} c/u</div>
          </div>
          <div class="cart-qty">
            <button class="qty-btn minus" onclick="T.cartQty(${i},-1)">−</button>
            <div class="qty-val">${c.qty}</div>
            <button class="qty-btn" onclick="T.cartQty(${i},1)">+</button>
          </div>
          <div class="cart-row-price">${this.money(c.subtotal)}</div>
        </div>`).join('');
    }
    const total = this.cart.reduce((s, c) => s + c.subtotal, 0);
    document.getElementById('cart-grand').textContent = this.money(total);
    const btn = document.getElementById('btn-confirm');
    btn.disabled = !this.cart.length || this.sending;
  },

  cartQty(i, delta) {
    const item = this.cart[i];
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) this.cart.splice(i, 1);
    else item.subtotal = item.price * item.qty;
    if (!this.cart.length) { this.toast('Tu pedido quedó vacío'); this.go('menu'); return; }
    this.renderCart();
    this.resetIdle();
  },

  // ── Enviar ────────────────────────────────────────────────────
  async submitOrder() {
    if (!this.cart.length || this.sending) return;
    this.sending = true;
    const btn = document.getElementById('btn-confirm');
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/totem-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: this.name,
          orderType: this.orderType,
          items: this.cart.map(c => ({ key: c.key, title: c.title, emoji: c.emoji, qty: c.qty, price: c.price }))
        })
      });
      if (r.status === 401 || r.redirected) { location.href = '/login'; return; }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data.code === 'STALE_MENU') {
          await this.loadConfig();
          this.repriceCart();
          this.renderCart();
          this.showModal('Actualizamos el menú', `${data.error}. Revisa tu pedido antes de confirmar.`, [{ label: 'Revisar mi pedido' }]);
          return;
        }
        throw new Error(data.error || 'Error ' + r.status);
      }
      document.getElementById('done-name').textContent = this.name;
      document.getElementById('done-num').textContent = '#' + (data.order?.num ?? '');
      this.go('done');
      this.startDone();
    } catch (e) {
      console.error(e);
      this.showModal('No se pudo enviar 😕', 'Revisa la conexión e inténtalo de nuevo, o pide ayuda en caja.', [
        { label: 'Intentar de nuevo', onClick: () => this.submitOrder() },
        { label: 'Cerrar', ghost: true }
      ]);
    } finally {
      this.sending = false;
      btn.textContent = 'Confirmar pedido ✅';
      btn.disabled = !this.cart.length;
    }
  },

  startDone() {
    let count = 15;
    const el = document.getElementById('done-timer');
    el.textContent = `Volviendo al inicio en ${count}…`;
    clearInterval(this.doneTimer);
    this.doneTimer = setInterval(() => {
      count--;
      el.textContent = `Volviendo al inicio en ${count}…`;
      if (count <= 0) { clearInterval(this.doneTimer); this.go('welcome'); }
    }, 1000);
  },

  // ── Reset ─────────────────────────────────────────────────────
  resetAll() {
    this.cart = [];
    this.name = '';
    this.orderType = '';
    this.kiloAmount = null;
    this.sending = false;
    clearInterval(this.doneTimer);
    clearInterval(this.idleCountdown);
    document.getElementById('idle-overlay').classList.remove('active');
    this.hideModal();
    this.renderName();
  },

  // ── Inactividad: 60 s → modal → 15 s → reinicio ──────────────
  setupIdle() {
    ['touchstart', 'click', 'scroll'].forEach(ev =>
      document.addEventListener(ev, () => { if (!document.getElementById('idle-overlay').classList.contains('active')) this.resetIdle(); }, { passive: true, capture: true })
    );
  },

  resetIdle() {
    clearTimeout(this.idleTimer);
    const v = this.current();
    if (v && v !== 'welcome' && v !== 'done') {
      this.idleTimer = setTimeout(() => this.showIdleModal(), 60_000);
    }
  },

  showIdleModal() {
    this.idleCount = 15;
    const overlay = document.getElementById('idle-overlay');
    const countEl = document.getElementById('idle-countdown');
    overlay.classList.add('active');
    countEl.textContent = this.idleCount;
    clearInterval(this.idleCountdown);
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
