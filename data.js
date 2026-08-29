/**
 * DATA.JS — Datos por defecto del Menú Digital
 * Birriería & Antojitos — todos los campos editables desde el Admin.
 */
const DEFAULT_STORE_DATA = {

  business: {
    name:            'Birriería & Antojitos',
    slogan:          'La birria más rica, recién hecha y bien calientita 🔥',
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
      title:     'Birria de Res',
      description: 'Birria de res hecha en casa, cocida a fuego lento con especias y chiles tradicionales. Incluye consomé, cebolla y cilantro.',
      price:     120,
      priceNote: '',
      badge:     '🍵 Incluye consomé',
      image:     'https://images.unsplash.com/photo-1625937286074-9ca519d5d9df?auto=format&fit=crop&w=900&q=80'
    },

    tacos: {
      enabled:   true,
      emoji:     '🌮',
      title:     'Tacos de Birria',
      description: 'Tacos en tortilla de maíz rellenos de birria jugosa, bañados en consomé con queso Oaxaca derretido, cebolla y cilantro.',
      price:     25,
      priceNote: 'por taco',
      badge:     '🧀 Queso derretido + consomé',
      image:     'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=900&q=80'
    },

    quesadillas: {
      enabled:   true,
      emoji:     '🧀',
      title:     'Quesadilla Gigante de Birria',
      description: 'Quesadilla casera gigante de tortilla de maíz, rellena de birria y queso Oaxaca derretido. Acompañada de consomé para dipear.',
      price:     80,
      priceNote: '',
      badge:     '🔥 Casera y gigante',
      image:     'https://images.unsplash.com/photo-1618040996337-56904b7850b9?auto=format&fit=crop&w=900&q=80'
    },

    refresco: {
      enabled:   true,
      emoji:     '🥤',
      title:     'Refresco / Agua Fresca',
      description: 'Refrescos de lata y aguas frescas del día para acompañar tus alimentos.',
      price:     20,
      priceNote: '',
      badge:     '🧊 Bien frío',
      image:     'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80'
    }
  },

  // ── Promos / Paquetes del día ──────────────────────────────────
  // Cada promo tiene: id, title, description, price, enabled
  // Se crean y editan desde el Admin → pestaña Promos
  promos: [
    {
      id:          'promo_default1',
      title:       'Combo Birria para 2',
      description: '2 porciones de birria de res, consomé grande, tortillas recién hechas, cebolla, cilantro y salsas.',
      price:       220,
      enabled:     true
    }
  ],

  // ── Historial de cortes de caja ───────────────────────────────
  caja: []
};
