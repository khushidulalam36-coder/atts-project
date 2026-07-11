const CACHE_NAME = 'atts-v10';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') {
    if (event.request.url.includes('/api/')) {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
            return response;
          })
          .catch(() => caches.match(event.request))
      );
    } else {
      event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
      );
    }
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('push', event => {
  let data = { title: 'AlamQuant ATTS', body: 'Remember your trading journal!' };
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  }
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open-journal', title: 'Write Journal' },
      { action: 'snooze', title: 'Remind Later' }
    ],
    data: { url: data.url || '/#/journey' },
    tag: 'reminder'
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open-journal') {
    clients.openWindow('/#/journey');
  } else {
    const urlToOpen = event.notification.data?.url || '/#/journey';
    clients.openWindow(urlToOpen);
  }
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    fetch('/api/setup/update-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldSubscription: event.oldSubscription,
        newSubscription: event.newSubscription
      })
    })
  );
});