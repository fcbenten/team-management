const CACHE_NAME = 'fc-benten-pwa-v80';
const ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './badge-96.png'
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

// Web Push: バックグラウンド通知受信
self.addEventListener('push', event => {
  let payload = {
    title: 'FC Benten 通知',
    body: '新しいお知らせがあります。',
    icon: './icon-192.png',
    badge: './badge-96.png',
    url: './',
    tag: 'fcb-notification'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (e) {
      const text = event.data.text();
      if (text) payload.body = text;
    }
  }

  const badgeIcon = (!payload.badge || payload.badge === './icon-192.png')
    ? './badge-96.png'
    : payload.badge;

  const options = {
    body: payload.body,
    icon: payload.icon || './icon-192.png',
    badge: badgeIcon,
    tag: payload.tag || 'fcb-notification',
    renotify: true,
    data: {
      url: payload.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'FC Benten', options)
  );
});

// Notification Click: 既存ウィンドウへフォーカスまたはアプリ起動
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
