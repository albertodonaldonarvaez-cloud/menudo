/**
 * DATA.JS — Datos por defecto del Menú Digital
 * Barbacoa & Antojitos — todos los campos editables desde el Admin.
 */
const DEFAULT_STORE_DATA = {

  business: {
    name:            'Barbacoa & Antojitos',
    slogan:          'La barbacoa más rica, recién hecha y bien calientita 🔥',
    currencySymbol:  '$'
  },

  // Horario de operación — abierto/cerrado se detecta AUTOMÁTICAMENTE
  schedule: {
    days:        [0, 6],      // 0 = Domingo · 1 = Lun … 6 = Sábado (JS getDay())
    openTime:    '08:00',     // HH:MM formato 24 h
    closeTime:   '14:00',
    displayText: 'Sáb - Dom: 8:00 AM – 2:00 PM'
  },

  // ── Productos del menú ────────────────────────────────────────
  products: {

    menudo: {
      enabled:   true,
      emoji:     '🍲',
      title:     'Menudo Tradicional',
      description: 'Receta casera de la abuela, servida bien calientita. Incluye tortillas recién hechas, cebolla, orégano, chile y limón.',
      price:     100,
      priceNote: '',
      badge:     '🌽 Incluye tortillas y verdura',
      image:     'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=900&q=80'
    },

    birria: {
      enabled:   true,
      emoji:     '🥩',
      title:     'Barbacoa × Kilo',
      description: 'Barbacoa estilo Hidalgo, vendida por kilo o fracción. Perfecta para llevar a casa o servir en grupo.',
      price:     250,
      priceNote: 'por kg',
      badge:     '🏆 Especialidad de la casa',
      calcMode:  'kilo',   // POS abre calculadora kg↔precio en lugar de agregar directo
      image:     'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80'
    },

    tacos: {
      enabled:   true,
      emoji:     '🌮',
      title:     'Tacos de Barbacoa',
      description: 'Tacos en tortilla de maíz rellenos de barbacoa jugosa, acompañados de cebolla, cilantro y salsa verde. ¡Recién hechos!',
      price:     25,
      priceNote: 'por taco',
      badge:     '🤤 Recién hechos',
      image:     'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=900&q=80'
    },

    quesadillas: {
      enabled:   true,
      emoji:     '🧀',
      title:     'Quesadilla Gigante de Barbacoa',
      description: 'Quesadilla casera gigante de tortilla de maíz, rellena de barbacoa y queso Oaxaca derretido. ¡Grande y bien llena!',
      price:     80,
      priceNote: '',
      badge:     '🔥 Casera y gigante',
      image:     'https://images.unsplash.com/photo-1618040996337-56904b7850b9?auto=format&fit=crop&w=900&q=80'
    },

    refresco: {
      enabled:   false,   // deshabilitado temporalmente
      emoji:     '🥤',
      title:     'Refresco / Agua Fresca',
      description: 'Refrescos de lata y aguas frescas del día para acompañar tus alimentos.',
      price:     20,
      priceNote: '',
      badge:     '🧊 Bien frío',
      image:     'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'
    },

    cafe: {
      enabled:   true,
      emoji:     '☕',
      title:     'Café de Olla',
      description: 'Café de olla recién preparado, con canela y piloncillo. Bien calientito para acompañar tu desayuno.',
      price:     20,
      priceNote: 'la taza',
      badge:     '🌿 Con canela y piloncillo',
      image:     'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80'
    },

    pan: {
      enabled:   true,
      emoji:     '🍞',
      title:     'Pan de Dulce',
      description: 'Piezas de pan de dulce casero, perfecto para acompañar el café de olla.',
      price:     10,
      priceNote: 'la pieza',
      badge:     '🏠 Casero',
      image:     'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=80'
    },

    // ── Postres ────────────────────────────────────────────────────
    carlota: {
      enabled:   true,
      emoji:     '🍰',
      title:     'Carlota',
      description: 'Carlota de limón casera, cremosita y fresquita. El postre perfecto después de un buen menudo.',
      price:     40,
      priceNote: 'la porción',
      badge:     '🍋 Casera y fresquita',
      category:  'postre',
      image:     'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80'
    },

    arrozconleche: {
      enabled:   true,
      emoji:     '🍚',
      title:     'Arroz con Leche',
      description: 'Arroz con leche tradicional con canela y pasas. Servido calientito o frío, como más te guste.',
      price:     35,
      priceNote: 'la porción',
      badge:     '✨ Tradicional con canela',
      category:  'postre',
      image:     'https://images.unsplash.com/photo-1596695684152-52751fa48579?auto=format&fit=crop&w=900&q=80'
    }
  },

  // ── Promos / Paquetes del día ──────────────────────────────────
  // Cada promo tiene: id, title, description, price, enabled
  // Se crean y editan desde el Admin → pestaña Promos
  promos: [],

  // ── Productos adicionales (dinámicos) ─────────────────────────
  // Creados desde Admin → Productos → "+ Nuevo Producto"
  // Cada uno tiene: id, enabled, emoji, title, description, price, priceNote, badge
  extraProducts: [],

  // ── Historial de cortes de caja ───────────────────────────────
  caja: []
};

// ── Reglas de Barbacoa × Kilo (FUENTE ÚNICA) ────────────────────
// Las usan el POS, el tótem y el servidor. El precio por kg sale
// SIEMPRE del admin (products.birria.price); aquí solo van las reglas.
// Porciones chicas llevan menos gramos por el costo de empaque.
const KILO_RULES = {
  minAmount:    50,                  // monto mínimo en el tótem
  quickAmounts: [50, 100, 175, 350], // botones rápidos del tótem
  // "below" puede ser un monto fijo en $ o 'kg' (= precio de 1 kg configurado en el admin)
  tiers: [
    { below: 130,  factor: 0.70 },   // menos de $130            → 30% menos gramos
    { below: 'kg', factor: 0.90 }    // de $130 a menos de 1 kg  → 10% menos gramos
  ]                                  // 1 kg ($350) o más        → gramaje completo
};

/** Rangos con montos reales según el precio por kg, ordenados de menor a mayor. */
function kiloTiers(priceKg) {
  return KILO_RULES.tiers
    .map(t => ({ below: t.below === 'kg' ? priceKg : t.below, factor: t.factor }))
    .sort((a, b) => a.below - b.below);
}

function kiloFactor(amount, priceKg) {
  const tier = kiloTiers(priceKg).find(t => amount < t.below);
  return tier ? tier.factor : 1;
}

/** Gramos que se entregan por un monto en pesos. */
function kiloGramsFor(amount, priceKg) {
  if (!(amount > 0) || !(priceKg > 0)) return 0;
  return Math.round((amount / priceKg) * 1000 * kiloFactor(amount, priceKg));
}

/** Precio a cobrar por cierta cantidad de gramos (inverso, aplica el mismo ajuste). */
function kiloPriceFor(grams, priceKg) {
  if (!(grams > 0) || !(priceKg > 0)) return 0;
  const raw = (grams / 1000) * priceKg;
  // Rangos de precio: [0,130)→0.70 · [130,1kg)→0.90 · [1kg,∞)→1
  const sorted = kiloTiers(priceKg);
  const bands = sorted.map((t, i) => ({ min: i ? sorted[i - 1].below : 0, max: t.below, factor: t.factor }));
  bands.push({ min: sorted[sorted.length - 1].below, max: Infinity, factor: 1 });
  // Del rango más alto al más bajo: el primero cuyo precio cae en su rango gana.
  // Si cae en un "hueco" entre rangos se cobra el inicio del rango superior.
  for (let i = bands.length - 1; i >= 0; i--) {
    const p = raw / bands[i].factor;
    if (p >= bands[i].min) return Math.round(Math.min(p, bands[i].max));
  }
  return Math.round(raw);
}

// Permite usar las mismas reglas en el servidor (Node)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_STORE_DATA, KILO_RULES, kiloGramsFor, kiloPriceFor };
}
