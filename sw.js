const CACHE_NAME = 'fc-benten-pwa-v4';
const ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: Cache Shell Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

// Fetch: HTML (navigation) は常にネットワーク最新を取得し、静的アセットのみキャッシュ
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // HTMLページは常にネットワーク優先で最新のiframe URLを取得
  if (event.request.mode === 'navigate' || event.request.url.endsWith('index.html') || event.request.url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // アイコン等の静的アセットはキャッシュ優先
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
