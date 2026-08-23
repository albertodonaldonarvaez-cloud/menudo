/**
 * MENÚ DIGITAL VISUAL (app.js)
 * Carga de datos, títulos personalizados, fotos y renderizado visual responsivo para comensales en mesa / portal cautivo.
 */

const STORAGE_KEY = 'menudo_store_config_v1';
// Datos por defecto mientras carga del servidor
let storeData = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));

/**
 * Carga la config del servidor compartido (todos los dispositivos
 * ven los mismos cambios que hizo el admin).
 * Fallback: localStorage → DEFAULT_STORE_DATA.
 */
async function loadStoreDataAsync() {
  try {
    const res = await fetch('/api/config', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.business) {
        // Migrar campos que podrían no existir en configs antiguas
        if (!data.titles)       data.titles       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.titles));
        if (!data.images)       data.images       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.images));
        if (!data.descriptions) data.descriptions = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.descriptions));
        if (!data.combos)       data.combos       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.combos));
        // Sincronizar también en localStorage como caché local
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    console.warn('Servidor no disponible, usando caché local:', e);
  }
  // Fallback: localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (!parsed.titles)       parsed.titles       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.titles));
      if (!parsed.images)       parsed.images       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.images));
      if (!parsed.descriptions) parsed.descriptions = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.descriptions));
      if (!parsed.combos)       parsed.combos       = JSON.parse(JSON.stringify(DEFAULT_STORE_DATA.combos));
      return parsed;
    } catch (e) { /* ignorar */ }
  }
  return JSON.parse(JSON.stringify(DEFAULT_STORE_DATA));
}

document.addEventListener('DOMContentLoaded', async () => {
  storeData = await loadStoreDataAsync();
  renderAll();
  initCategoryNav();
});

function renderAll() {
  renderBusinessInfo();
  renderMenudoSection();
  renderGorditasSection();
  renderBurritosSection();
  renderDrinksSection();
  renderCombosSection();
}

// ==========================================
// INFORMACIÓN DEL NEGOCIO & TÍTULOS
// ==========================================
function renderBusinessInfo() {
  const b = storeData.business;
  const t = (storeData.titles) || DEFAULT_STORE_DATA.titles;
  
  document.getElementById('businessName').textContent = b.name;
  document.getElementById('businessSlogan').textContent = b.slogan;
  document.getElementById('headerSchedule').innerHTML = `<i class="fa-regular fa-clock"></i> ${b.schedule}`;
  document.getElementById('footerBusinessName').textContent = b.name;

  // Estado Abierto / Cerrado
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  if (b.isOpen) {
    statusBadge.className = 'status-pill';
    statusText.textContent = 'Abierto Ahora';
  } else {
    statusBadge.className = 'status-pill closed';
    statusText.textContent = 'Cerrado por el momento';
  }

  // Precios en Subtítulos y Pills
  document.getElementById('gorditaPricePill').textContent = `$${storeData.prices.gordita} c/u`;
  document.getElementById('burritoPricePill').textContent = `$${storeData.prices.burrito} c/u`;
  document.getElementById('gorditaSubtitle').textContent = `Gorditas de maíz ($${storeData.prices.gordita} c/u) con guisados del día`;
  document.getElementById('burritoSubtitle').textContent = `Burritos en harina casera ($${storeData.prices.burrito} c/u)`;

  // Títulos de secciones en index.html
  if (document.getElementById('secTitleMenudo')) document.getElementById('secTitleMenudo').textContent = t.menudo || 'Menudo Tradicional';
  if (document.getElementById('secTitleGorditas')) document.getElementById('secTitleGorditas').textContent = t.gorditas || 'Gorditas de Guisado';
  if (document.getElementById('secTitleBurritos')) document.getElementById('secTitleBurritos').textContent = t.burritos || 'Burritos de Guisado';
}

// ==========================================
// RENDERIZADO VISUAL DEL MENÚ
// ==========================================

// 1. Menudo Tradicional (Medida Única)
function renderMenudoSection() {
  const container = document.getElementById('menudoContainer');
  const price = storeData.prices.menudo;
  const title = (storeData.titles && storeData.titles.menudo) || DEFAULT_STORE_DATA.titles.menudo;
  const image = (storeData.images && storeData.images.menudo) || DEFAULT_STORE_DATA.images.menudo;
  const desc = (storeData.descriptions && storeData.descriptions.menudo) || DEFAULT_STORE_DATA.descriptions.menudo;

  container.innerHTML = `
    <div class="menudo-hero-card">
      <div class="menudo-img-wrap">
        <img src="${image}" alt="${title}" loading="lazy">
        <span class="menudo-badge">⭐ Especialidad de la casa</span>
      </div>
      <div class="menudo-details">
        <div class="menudo-header">
          <h3>${title}</h3>
          <p>${desc}</p>
        </div>
        <div class="menudo-footer">
          <div>
            <span class="product-price-label">Precio por plato servido</span>
            <span class="product-price">$${price} <small style="font-size:0.85rem;color:#777;">MXN</small></span>
          </div>
          <div class="menudo-included-badge">
            <i class="fa-solid fa-circle-check"></i> Incluye tortillas y verdura
          </div>
        </div>
      </div>
    </div>
  `;
}

// 2. Gorditas de Guisado
function renderGorditasSection() {
  const bannerContainer = document.getElementById('gorditasBanner');
  const container = document.getElementById('gorditasGrid');
  const price = storeData.prices.gordita;
  const title = (storeData.titles && storeData.titles.gorditas) || DEFAULT_STORE_DATA.titles.gorditas;
  const image = (storeData.images && storeData.images.gorditas) || DEFAULT_STORE_DATA.images.gorditas;
  const desc = (storeData.descriptions && storeData.descriptions.gorditas) || DEFAULT_STORE_DATA.descriptions.gorditas;

  // Banner con foto destacada
  bannerContainer.innerHTML = `
    <div class="category-banner-inner">
      <div class="cat-banner-img-wrap">
        <img src="${image}" alt="${title}" loading="lazy">
      </div>
      <div class="cat-banner-text">
        <h4>${title}</h4>
        <p>${desc}</p>
        <div class="cat-banner-price-tag">Precio: <strong>$${price} MXN</strong> cada una</div>
      </div>
    </div>
  `;
  
  if (!storeData.guisados || storeData.guisados.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; color:#888; text-align:center; padding:20px;">No hay guisados registrados hoy.</p>`;
    return;
  }

  container.innerHTML = storeData.guisados.map(g => {
    if (!g.available) {
      return `
        <div class="guisado-card sold-out">
          <div class="guisado-info">
            <div class="guisado-name">${g.name}</div>
            <span class="guisado-status-tag"><i class="fa-solid fa-ban"></i> Agotado por hoy</span>
          </div>
          <span class="guisado-price-tag">$${price}</span>
        </div>
      `;
    }

    return `
      <div class="guisado-card">
        <div class="guisado-info">
          <div class="guisado-name">${g.name}</div>
          <span class="guisado-status-tag"><i class="fa-solid fa-circle-check"></i> Disponible hoy</span>
        </div>
        <span class="guisado-price-tag">$${price}</span>
      </div>
    `;
  }).join('');
}

// 3. Burritos de Guisado
function renderBurritosSection() {
  const bannerContainer = document.getElementById('burritosBanner');
  const container = document.getElementById('burritosGrid');
  const price = storeData.prices.burrito;
  const title = (storeData.titles && storeData.titles.burritos) || DEFAULT_STORE_DATA.titles.burritos;
  const image = (storeData.images && storeData.images.burritos) || DEFAULT_STORE_DATA.images.burritos;
  const desc = (storeData.descriptions && storeData.descriptions.burritos) || DEFAULT_STORE_DATA.descriptions.burritos;

  // Banner con foto destacada
  bannerContainer.innerHTML = `
    <div class="category-banner-inner">
      <div class="cat-banner-img-wrap">
        <img src="${image}" alt="${title}" loading="lazy">
      </div>
      <div class="cat-banner-text">
        <h4>${title}</h4>
        <p>${desc}</p>
        <div class="cat-banner-price-tag">Precio: <strong>$${price} MXN</strong> cada uno</div>
      </div>
    </div>
  `;
  
  if (!storeData.guisados || storeData.guisados.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; color:#888; text-align:center; padding:20px;">No hay guisados registrados hoy.</p>`;
    return;
  }

  container.innerHTML = storeData.guisados.map(g => {
    if (!g.available) {
      return `
        <div class="guisado-card sold-out">
          <div class="guisado-info">
            <div class="guisado-name">${g.name}</div>
            <span class="guisado-status-tag"><i class="fa-solid fa-ban"></i> Agotado por hoy</span>
          </div>
          <span class="guisado-price-tag">$${price}</span>
        </div>
      `;
    }

    return `
      <div class="guisado-card">
        <div class="guisado-info">
          <div class="guisado-name">${g.name}</div>
          <span class="guisado-status-tag"><i class="fa-solid fa-circle-check"></i> Disponible hoy</span>
        </div>
        <span class="guisado-price-tag">$${price}</span>
      </div>
    `;
  }).join('');
}

// 4. Bebidas & Café de Olla
function renderDrinksSection() {
  const container = document.getElementById('drinksGrid');
  
  const cafeTitle = (storeData.titles && storeData.titles.cafeOlla) || DEFAULT_STORE_DATA.titles.cafeOlla;
  const cafeImg = (storeData.images && storeData.images.cafeOlla) || DEFAULT_STORE_DATA.images.cafeOlla;
  const cafeDesc = (storeData.descriptions && storeData.descriptions.cafeOlla) || DEFAULT_STORE_DATA.descriptions.cafeOlla;
  
  const refrescoTitle = (storeData.titles && storeData.titles.refresco) || DEFAULT_STORE_DATA.titles.refresco;
  const refrescoImg = (storeData.images && storeData.images.refresco) || DEFAULT_STORE_DATA.images.refresco;
  const refrescoDesc = (storeData.descriptions && storeData.descriptions.refresco) || DEFAULT_STORE_DATA.descriptions.refresco;

  container.innerHTML = `
    <!-- Café de Olla -->
    <div class="drink-card">
      <div class="drink-img-wrap">
        <img src="${cafeImg}" alt="${cafeTitle}" loading="lazy">
        <span class="drink-badge">☕ En Olla de Barro</span>
      </div>
      <div class="drink-content">
        <div>
          <h3>${cafeTitle}</h3>
          <p>${cafeDesc}</p>
        </div>
        <div class="drink-footer">
          <span class="product-price">$${storeData.prices.cafeOlla} <small style="font-size:0.8rem;color:#777;">MXN</small></span>
          <span class="drink-tag"><i class="fa-solid fa-mug-hot"></i> Bien Calientito</span>
        </div>
      </div>
    </div>

    <!-- Refresco -->
    <div class="drink-card">
      <div class="drink-img-wrap">
        <img src="${refrescoImg}" alt="${refrescoTitle}" loading="lazy">
        <span class="drink-badge">🧊 Bien Frío</span>
      </div>
      <div class="drink-content">
        <div>
          <h3>${refrescoTitle}</h3>
          <p>${refrescoDesc}</p>
        </div>
        <div class="drink-footer">
          <span class="product-price">$${storeData.prices.refresco} <small style="font-size:0.8rem;color:#777;">MXN</small></span>
          <span class="drink-tag"><i class="fa-solid fa-snowflake"></i> 355ml Vidrio</span>
        </div>
      </div>
    </div>
  `;
}

// 5. Combos Especiales
function renderCombosSection() {
  const container = document.getElementById('combosGrid');
  if (!container) return;

  const combos = (storeData.combos && storeData.combos.length > 0)
    ? storeData.combos
    : DEFAULT_STORE_DATA.combos;

  if (!combos || combos.length === 0) {
    container.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:#888;padding:30px;">No hay combos disponibles en este momento.</p>`;
    return;
  }

  container.innerHTML = combos.map(combo => {
    const includesList = (combo.includes || [])
      .map(item => `<li><i class="fa-solid fa-circle-check" style="color:var(--color-accent-green-dark);font-size:0.75rem;"></i> ${item}</li>`)
      .join('');

    const badgeHtml = combo.badge
      ? `<span class="combo-badge">${combo.badge}</span>`
      : '';

    const soldOutClass = combo.available ? '' : 'combo-card--soldout';
    const soldOutBanner = !combo.available
      ? `<div class="combo-soldout-banner"><i class="fa-solid fa-ban"></i> No disponible por hoy</div>`
      : '';

    return `
      <div class="combo-card ${soldOutClass}">
        ${badgeHtml}
        ${soldOutBanner}
        <div class="combo-header">
          <h3 class="combo-name">${combo.name}</h3>
          <p class="combo-description">${combo.description}</p>
        </div>
        <ul class="combo-includes-list">
          ${includesList}
        </ul>
        <div class="combo-footer">
          <div class="combo-price-wrap">
            <span class="combo-price-label">Precio del combo</span>
            <span class="combo-price">$${combo.price} <small>MXN</small></span>
          </div>
          <span class="combo-tag"><i class="fa-solid fa-gift"></i> Combo</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// FILTRO DE CATEGORÍAS
// ==========================================
function initCategoryNav() {
  const catTabs = document.querySelectorAll('.cat-tab');
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const cat = tab.dataset.category;
      filterSections(cat);
    });
  });
}

function filterSections(cat) {
  const sections = {
    menudo: document.getElementById('section-menudo'),
    gorditas: document.getElementById('section-gorditas'),
    burritos: document.getElementById('section-burritos'),
    bebidas: document.getElementById('section-bebidas'),
    combos: document.getElementById('section-combos')
  };

  if (cat === 'all') {
    Object.values(sections).forEach(sec => { if (sec) sec.style.display = 'block'; });
  } else {
    Object.keys(sections).forEach(key => {
      if (!sections[key]) return;
      if (key === cat) {
        sections[key].style.display = 'block';
        sections[key].scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        sections[key].style.display = 'none';
      }
    });
  }
}
