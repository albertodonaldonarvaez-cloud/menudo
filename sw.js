'use strict';
/**
 * SW.JS — Service Worker v1.0
 * Cache-first para assets estáticos, network-first para API.
 * Offline fallback para el POS.
 */

const CACHE_NAME  = 'menudo-pos-v6';
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
      // Intentar cachear, ignorar errores en recursos externos
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

  // API calls: Network-first (siempre intentar red primero)
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

  // POST/PATCH/DELETE: siempre red
  if (event.request.method !== 'GET') return;

  // Assets estáticos: Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cachear respuestas exitosas de nuestro dominio
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback offline para navegación
        if (event.request.mode === 'navigate') {
          return caches.match('/caja') ||
            new Response('<h1 style="font-family:sans-serif;text-align:center;padding:40px">Sin conexión — regresa cuando haya red 📡</h1>', {
              headers: { 'Content-Type': 'text/html' }
            });
        }
      });
    })
  );
});
