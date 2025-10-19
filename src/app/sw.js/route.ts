/**
 * CODE INSIGHT
 * This code's use case is to serve the service worker JavaScript for the Tris PWA.
 * This code's full epic context is to precache the app shell, cache /api/demo/* requests and HTML navigations with a stale-while-revalidate strategy, provide an offline fallback to /offline, and respond to SKIP_WAITING messages to activate updates.
 * This code's ui feel is invisible infrastructure: fast, reliable, and unobtrusive, enabling smooth mobile-first interactions and offline confidence.
 */

export async function GET() {
  const sw = `/* Tris PWA Service Worker */
(function(){
  'use strict';

  var CACHE_PREFIX = 'tris';
  var STATIC_CACHE = CACHE_PREFIX + '-static-v1';
  var PAGES_CACHE = CACHE_PREFIX + '-pages-v1';
  var API_CACHE = CACHE_PREFIX + '-api-v1';

  var APP_SHELL = [
    '/',
    '/offline',
    '/manifest.webmanifest'
  ];

  self.addEventListener('message', function(event){
    var data = event && event.data;
    if (!data) return;
    if (data === 'SKIP_WAITING' || (data && data.type === 'SKIP_WAITING')) {
      self.skipWaiting();
    }
  });

  self.addEventListener('install', function(event){
    event.waitUntil((async function(){
      var cache = await caches.open(STATIC_CACHE);
      try {
        await cache.addAll(APP_SHELL.map(function(url){ return new Request(url, { cache: 'reload' }); }));
      } catch (e) {
        // Best-effort precache; proceed even if some fail
      }
      self.skipWaiting();
    })());
  });

  self.addEventListener('activate', function(event){
    event.waitUntil((async function(){
      try { if (self.registration && self.registration.navigationPreload) { await self.registration.navigationPreload.enable(); } } catch (e) {}
      var keys = await caches.keys();
      var keep = [STATIC_CACHE, PAGES_CACHE, API_CACHE];
      await Promise.all(keys.filter(function(k){ return k.indexOf(CACHE_PREFIX) === 0 && keep.indexOf(k) === -1; }).map(function(k){ return caches.delete(k); }));
      await self.clients.claim();
    })());
  });

  self.addEventListener('fetch', function(event){
    var req = event.request;
    if (req.method !== 'GET') return;

    var url = new URL(req.url);
    var isSameOrigin = url.origin === self.location.origin;

    // HTML navigations: stale-while-revalidate with offline fallback
    if (req.mode === 'navigate' || ((req.headers.get('accept') || '').indexOf('text/html') !== -1)) {
      event.respondWith(handleNavigationRequest(event));
      return;
    }

    // Runtime API caching for demo endpoints: stale-while-revalidate
    if (isSameOrigin && url.pathname.indexOf('/api/demo/') === 0) {
      event.respondWith(staleWhileRevalidate(req, API_CACHE, event));
      return;
    }

    // Static assets: cache-first
    if (isSameOrigin && (url.pathname.indexOf('/_next/') === 0 || /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i.test(url.pathname))) {
      event.respondWith(cacheFirst(req, STATIC_CACHE));
      return;
    }
    // Otherwise: let the request pass through
  });

  async function handleNavigationRequest(event){
    var cache = await caches.open(PAGES_CACHE);
    var cached = await cache.match(event.request, { ignoreSearch: false });
    var preload;
    try { preload = event.preloadResponse ? await event.preloadResponse : undefined; } catch(e) { preload = undefined; }

    var networkPromise = fetch(event.request).then(function(res){
      if (res && res.ok) { cache.put(event.request, res.clone()); }
      return res;
    }).catch(function(){ return undefined; });

    if (cached) {
      event.waitUntil(networkPromise);
      return cached;
    }

    if (preload) {
      cache.put(event.request, preload.clone());
      return preload;
    }

    var network = await networkPromise;
    if (network) return network;

    var offline = await caches.match('/offline');
    return offline || new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;display:grid;place-items:center;height:100vh;background:#0b1220;color:#e5e7eb}main{max-width:32rem;padding:2rem;text-align:center;background:rgba(255,255,255,0.06);border-radius:1rem;box-shadow:0 10px 25px rgba(0,0,0,0.4)}h1{font-size:1.5rem;margin:0 0 .5rem}p{opacity:.9;line-height:1.5}</style><main><h1>You\'re offline</h1><p>Content isn\'t available right now. Reconnect and try again.</p></main>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  async function staleWhileRevalidate(request, cacheName, event){
    var cache = await caches.open(cacheName);
    var cached = await cache.match(request);
    var networkPromise = fetch(request).then(function(response){
      if (response && response.ok) { cache.put(request, response.clone()); }
      return response;
    }).catch(function(){ return undefined; });

    if (cached) {
      if (event && event.waitUntil) event.waitUntil(networkPromise);
      return cached;
    }

    var network = await networkPromise;
    if (network) return network;

    return new Response('{"error":"offline"}', { headers: { 'content-type': 'application/json' }, status: 200 });
  }

  async function cacheFirst(request, cacheName){
    var cache = await caches.open(cacheName);
    var cached = await cache.match(request);
    if (cached) return cached;
    var res;
    try { res = await fetch(request); } catch(e) { res = undefined; }
    if (res && res.ok) { cache.put(request, res.clone()); }
    return res || await caches.match('/offline') || new Response('', { status: 504 });
  }
})();`;

  return new Response(sw, {
    status: 200,
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate'
    }
  });
}
