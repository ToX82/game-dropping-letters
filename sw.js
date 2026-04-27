// ─── Service Worker: LETTERE — offline-first PWA ─────────
const VERSION = 'lettere-v4';
const CORE_CACHE = VERSION + '-core';
const RUNTIME_CACHE = VERSION + '-rt';

// Asset locali essenziali per il funzionamento offline
const LOCAL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './ita.txt',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// CDN core (CSS/JS) necessari per il rendering
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;900&family=DM+Sans:wght@400;500;600;700&display=swap'
];

// Font Awesome webfonts (URL note, pre-cachiamo per icone offline immediate)
const FA_WEBFONTS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-brands-400.woff2'
];

// Helper: aggiunge una URL alla cache, ignora errori singoli per non bloccare l'install
async function safeCache(cache, url, init) {
  try {
    const req = new Request(url, init || { cache: 'no-cache' });
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(req, res.clone());
      return res;
    }
  } catch (e) {
    console.warn('[SW] Pre-cache fallito:', url, e);
  }
  return null;
}

// Estrae le URL dei woff2 referenziati in un CSS Google Fonts
function extractWoff2Urls(cssText) {
  const urls = new Set();
  const re = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g;
  let m;
  while ((m = re.exec(cssText)) !== null) urls.add(m[1]);
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);

    // 1. Asset locali (cache:reload bypassa la HTTP cache del browser per garantire freschezza)
    await Promise.all(LOCAL_ASSETS.map(u => safeCache(cache, u, { cache: 'reload' })));

    // 2. CDN core
    await Promise.all(CDN_ASSETS.map(u => safeCache(cache, u)));

    // 3. Font Awesome woff2
    await Promise.all(FA_WEBFONTS.map(u => safeCache(cache, u)));

    // 4. Google Fonts: parse del CSS e pre-cache dei woff2 referenziati
    try {
      const gfUrl = CDN_ASSETS[3];
      const cached = await cache.match(gfUrl);
      if (cached) {
        const text = await cached.clone().text();
        const woff2 = extractWoff2Urls(text);
        await Promise.all(woff2.map(u => safeCache(cache, u)));
      }
    } catch (e) {
      console.warn('[SW] Pre-cache Google Fonts woff2 fallito:', e);
    }

    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Pulizia di cache vecchie
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CORE_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Strategia per richieste di navigazione: network-first (per ricevere update) con fallback a cache
async function handleNavigation(event) {
  try {
    const fresh = await fetch(event.request);
    const cache = await caches.open(CORE_CACHE);
    cache.put('./index.html', fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cached = await caches.match(event.request) || await caches.match('./index.html') || await caches.match('./');
    if (cached) return cached;
    return new Response('<h1>Offline</h1><p>Apri l\'app almeno una volta online per scaricarla.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

// Cache-first con fallback a network (poi cache-on-success)
async function cacheFirst(event) {
  const cached = await caches.match(event.request);
  if (cached) return cached;
  try {
    const res = await fetch(event.request);
    if (res && (res.ok || res.type === 'opaque')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(event.request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    return cached || Response.error();
  }
}

// Stale-while-revalidate: serve dalla cache, aggiorna in background
async function staleWhileRevalidate(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(event.request);
  const fetchPromise = fetch(event.request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(event.request, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigazione (HTML)
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Same-origin:
  // - navigations handled sopra (network-first)
  // - asset statici: stale-while-revalidate per ricevere update senza bust manuali
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  // Cross-origin (CDN, font): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event));
});

// Permette al client di forzare l'update del SW
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
