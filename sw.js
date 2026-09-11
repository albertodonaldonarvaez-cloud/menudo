'use strict';
/**
 * SW.JS — Service Worker v7
 * Network-first para HTML/JS (siempre actualizado).
 * Cache-first solo para fuentes, íconos y CDN.
 */

const CACHE_NAME  = 'menudo-pos-v7';
const STATIC_URLS = [
  '/manifest.json',
  '/icon.svg',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// ── Instalación: cachear assets estáticos ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(STATIC_URLS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// ── Activación: limpiar caches viejas ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // POST/PATCH/DELETE: siempre red, no interceptar
  if (event.request.method !== 'GET') return;

  // API calls: Network-only con fallback offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // HTML y JS de nuestro dominio: NETWORK-FIRST
  // Siempre intenta la red primero para obtener la versión más nueva.
  // Solo usa cache si no hay red (offline).
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(response => {
        // Guardar en cache para offline
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin red: intentar cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback offline para navegación
          if (event.request.mode === 'navigate') {
            return new Response(
              '<h1 style="font-family:sans-serif;text-align:center;padding:40px">Sin conexión — regresa cuando haya red 📡</h1>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
        });
      })
    );
    return;
  }

  // Assets externos (CDN fonts, icons): Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
