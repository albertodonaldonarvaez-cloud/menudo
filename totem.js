const app = {
    state: {
        currentView: 'welcome',
        clientName: '',
        orderType: '',
        cart: [],
        products: [],
        total: 0,
        inactivityTimer: null,
    },

    init: async function() {
        this.resetInactivityTimer();
        this.setupListeners();
        await this.loadProducts();
    },

    setupListeners: function() {
        document.addEventListener('touchstart', () => this.resetInactivityTimer());
        document.addEventListener('click', () => this.resetInactivityTimer());
        document.addEventListener('input', () => this.resetInactivityTimer());
    },

    resetInactivityTimer: function() {
        if (this.state.inactivityTimer) {
            clearTimeout(this.state.inactivityTimer);
        }
        
        if (this.state.currentView !== 'welcome' && this.state.currentView !== 'done') {
            this.state.inactivityTimer = setTimeout(() => {
                this.resetApp();
            }, 60000); // 60 seconds
        }
    },

    resetApp: function() {
        this.state.clientName = '';
        this.state.orderType = '';
        this.state.cart = [];
        document.getElementById('client-name').value = '';
        this.updateCartSummary();
        this.goToWelcome();
    },

    loadProducts: async function() {
        try {
            const response = await fetch('/api/store-config');
            if (response.ok) {
                const data = await response.json();
                this.parseProducts(data);
            } else {
                throw new Error("Failed to load api");
            }
        } catch (e) {
            console.log("Using fallback data", e);
            if (typeof DEFAULT_STORE_DATA !== 'undefined') {
                this.parseProducts(DEFAULT_STORE_DATA);
            } else {
                this.parseProducts({
                    products: {
                        birria: { enabled: true, title: 'Barbacoa', emoji: '🌮', price: 300, calcMode: 'kilo', description: 'Precio por kilo' },
                        tacos: { enabled: true, title: 'Tacos', emoji: '🌮', price: 25 },
                        quesadillas: { enabled: true, title: 'Quesadillas', emoji: '🧀', price: 40 },
                        menudo: { enabled: true, title: 'Menudo', emoji: '🍲', price: 100 }
                    }
                });
            }
        }
    },

    parseProducts: function(data) {
        const prodObj = data.products || {};
        const extraArr = data.extraProducts || [];
        
        const allProds = [];
        
        for (const [key, p] of Object.entries(prodObj)) {
            if (key === 'menudo') continue;
            if (p.enabled === false) continue;
            allProds.push({ key, ...p });
        }
        
        for (const ep of extraArr) {
            if (ep.enabled === false) continue;
            allProds.push({ key: ep.key || ep.title, ...ep });
        }
        
        this.state.products = allProds;
    },

    switchView: function(viewId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
        this.state.currentView = viewId;
        this.resetInactivityTimer();
    },

    goToWelcome: function() {
        this.switchView('welcome');
    },

    goToName: function() {
        this.switchView('name');
        setTimeout(() => document.getElementById('client-name').focus(), 100);
    },

    submitName: function() {
        const nameInput = document.getElementById('client-name').value.trim();
        if (nameInput) {
            this.state.clientName = nameInput;
            this.goToOrderType();
        } else {
            document.getElementById('client-name').focus();
        }
    },

    goToOrderType: function() {
        this.switchView('order-type');
    },

    setOrderType: function(type) {
        this.state.orderType = type;
        this.goToMenu();
    },

    goToMenu: function() {
        this.renderMenu();
        this.switchView('menu');
    },

    renderMenu: function() {
        const container = document.getElementById('menu-container');
        container.innerHTML = '';
        
        this.state.products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'menu-card';
            
            const isKilo = p.calcMode === 'kilo';
            const priceDisp = isKilo ? `$${p.price.toFixed(2)}/kg` : `$${p.price.toFixed(2)}`;
            const descDisp = p.description || p.priceNote || '';
            
            const cartItem = this.state.cart.find(c => c.key === p.key && !isKilo);
            const qty = cartItem ? cartItem.qty : 0;
            
            let controlHTML = '';
            if (isKilo) {
                controlHTML = `
                    <div class="kilo-calc">
                        <div class="kilo-input">
                            <span style="font-size: 1.5rem">$</span>
                            <input type="number" id="kilo-input-${p.key}" placeholder="Ej. 100" min="1">
                        </div>
                        <div class="kilo-result" id="kilo-result-${p.key}">Ingresa monto para ver gramos</div>
                        <button class="kilo-add-btn" onclick="app.addKiloItem('${p.key}')">Agregar ➕</button>
                    </div>
                `;
            } else {
                controlHTML = `
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="app.updateQty('${p.key}', -1)">-</button>
                        <span class="qty-value" id="qty-${p.key}">${qty}</span>
                        <button class="qty-btn" onclick="app.updateQty('${p.key}', 1)">+</button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="menu-emoji">${p.emoji || '🍽️'}</div>
                <div class="menu-title">${p.title}</div>
                <div class="menu-price">${priceDisp}</div>
                <div class="menu-desc">${descDisp}</div>
                <div style="margin-top: auto;">
                    ${controlHTML}
                </div>
            `;
            
            container.appendChild(card);
            
            if (isKilo) {
                const inputEl = document.getElementById(`kilo-input-${p.key}`);
                inputEl.addEventListener('input', (e) => this.calcKiloGrams(p, e.target.value));
            }
        });
        
        this.updateCartSummary();
    },

    calcKiloGrams: function(product, inputPrice) {
        const resultEl = document.getElementById(`kilo-result-${product.key}`);
        const price = parseFloat(inputPrice);
        if (isNaN(price) || price <= 0) {
            resultEl.innerText = 'Ingresa monto para ver gramos';
            return;
        }
        
        let baseGrams = (price / product.price) * 1000;
        let multiplier = 1;
        
        if (price < 50) multiplier = 0.70;
        else if (price < 100) multiplier = 0.90;
        else multiplier = 1.0;
        
        const finalGrams = Math.round(baseGrams * multiplier);
        resultEl.innerText = `${finalGrams}g aprox`;
        
        resultEl.dataset.grams = finalGrams;
        resultEl.dataset.price = price;
    },

    addKiloItem: function(key) {
        const product = this.state.products.find(p => p.key === key);
        const resultEl = document.getElementById(`kilo-result-${key}`);
        const inputEl = document.getElementById(`kilo-input-${key}`);
        
        const price = parseFloat(resultEl.dataset.price);
        const grams = parseInt(resultEl.dataset.grams);
        
        if (!price || !grams) return;
        
        const uniqueKey = `${key}_${Date.now()}`;
        
        this.state.cart.push({
            key: uniqueKey,
            originalKey: key,
            title: `${product.title} (${grams}g)`,
            emoji: product.emoji,
            qty: 1,
            price: price,
            subtotal: price,
            isKilo: true
        });
        
        inputEl.value = '';
        resultEl.innerText = 'Ingresa monto para ver gramos';
        resultEl.dataset.price = '';
        resultEl.dataset.grams = '';
        
        this.updateCartSummary();
        
        const btn = document.querySelector(`#kilo-input-${key}`).parentElement.parentElement.querySelector('.kilo-add-btn');
        const origText = btn.innerHTML;
        btn.innerHTML = '¡Agregado! ✓';
        btn.style.backgroundColor = '#10b981';
        setTimeout(() => {
            btn.innerHTML = origText;
            btn.style.backgroundColor = '';
        }, 1000);
    },

    updateQty: function(key, delta) {
        const product = this.state.products.find(p => p.key === key);
        let cartItem = this.state.cart.find(c => c.key === key);
        
        if (!cartItem && delta > 0) {
            cartItem = {
                key: product.key,
                title: product.title,
                emoji: product.emoji,
                qty: 0,
                price: product.price,
                subtotal: 0
            };
            this.state.cart.push(cartItem);
        }
        
        if (cartItem) {
            cartItem.qty += delta;
            if (cartItem.qty <= 0) {
                this.state.cart = this.state.cart.filter(c => c.key !== key);
            } else {
                cartItem.subtotal = cartItem.qty * cartItem.price;
            }
        }
        
        const newQty = cartItem && cartItem.qty > 0 ? cartItem.qty : 0;
        const qtyEl = document.getElementById(`qty-${key}`);
        if (qtyEl) qtyEl.innerText = newQty;
        
        this.updateCartSummary();
    },

    updateCartSummary: function() {
        this.state.total = this.state.cart.reduce((sum, item) => sum + item.subtotal, 0);
        const el = document.getElementById('cart-summary-text');
        if(el) el.innerText = `Total: $${this.state.total.toFixed(2)}`;
    },

    goToCart: function() {
        if (this.state.cart.length === 0) return;
        this.renderCart();
        this.switchView('cart');
    },

    renderCart: function() {
        const container = document.getElementById('cart-container');
        container.innerHTML = '';
        
        this.state.cart.forEach(item => {
            const el = document.createElement('div');
            el.className = 'cart-item';
            
            let qtyControl = '';
            if (!item.isKilo) {
                qtyControl = `
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="app.updateCartQty('${item.key}', -1)">-</button>
                        <span class="qty-value">${item.qty}</span>
                        <button class="qty-btn" onclick="app.updateCartQty('${item.key}', 1)">+</button>
                    </div>
                `;
            } else {
                qtyControl = `
                    <button class="btn btn-secondary" style="height: 50px; font-size: 1rem; border-color: #ef4444; color: #ef4444;" onclick="app.removeKiloItem('${item.key}')">Eliminar</button>
                `;
            }

            el.innerHTML = `
                <div class="cart-item-info">
                    <span style="font-size: 2.5rem">${item.emoji || '🍽️'}</span>
                    <div>
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-price">$${item.price.toFixed(2)} ${!item.isKilo ? 'c/u' : ''}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 20px;">
                    ${qtyControl}
                    <div style="font-size: 1.5rem; font-weight: bold; width: 100px; text-align: right;">
                        $${item.subtotal.toFixed(2)}
                    </div>
                </div>
            `;
            container.appendChild(el);
        });
        
        document.getElementById('cart-total-display').innerText = `Total: $${this.state.total.toFixed(2)}`;
        
        if (this.state.cart.length === 0) {
            this.goToMenu();
        }
    },

    updateCartQty: function(key, delta) {
        this.updateQty(key, delta);
        this.renderCart();
    },

    removeKiloItem: function(key) {
        this.state.cart = this.state.cart.filter(c => c.key !== key);
        this.updateCartSummary();
        this.renderCart();
    },

    submitOrder: async function() {
        if (this.state.cart.length === 0) return;
        
        const payload = {
            clientName: this.state.clientName,
            orderType: this.state.orderType,
            items: this.state.cart,
            total: this.state.total
        };
        
        try {
            await fetch('/api/totem-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error("Order submission error", e);
        }
        
        this.showDone();
    },

    showDone: function() {
        this.switchView('done');
        let countdown = 10;
        const timerEl = document.getElementById('done-timer');
        timerEl.innerText = `Reiniciando en ${countdown}...`;
        
        if (this.state.inactivityTimer) clearTimeout(this.state.inactivityTimer);
        
        const intv = setInterval(() => {
            countdown--;
            timerEl.innerText = `Reiniciando en ${countdown}...`;
            if (countdown <= 0) {
                clearInterval(intv);
                this.resetApp();
            }
        }, 1000);
    }
};

window.onload = () => app.init();
