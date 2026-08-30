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
      enabled:   false,   // deshabilitado — menú cambió a barbacoa
      emoji:     '🥩',
      title:     'Birria de Res',
      description: 'Birria de res hecha en casa, cocida a fuego lento con especias y chiles tradicionales.',
      price:     120,
      priceNote: '',
      badge:     '',
      image:     ''
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
    }
  },

  // ── Promos / Paquetes del día ──────────────────────────────────
  // Cada promo tiene: id, title, description, price, enabled
  // Se crean y editan desde el Admin → pestaña Promos
  promos: [],

  // ── Historial de cortes de caja ───────────────────────────────
  caja: []
};
