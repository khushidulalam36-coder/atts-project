// ===================================================
// AlamQuant ATTS – Enterprise Service Worker (sw.js)
// ===================================================
const CACHE_NAME = 'atts-v11';

// Static assets to pre-cache (adjust paths if needed)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/verify.html',
  '/styles.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-72.png'
];

// ==================== Install Event ====================
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('[SW] Failed to cache some assets', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ==================== Activate Event ====================
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ==================== Fetch Event ====================
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (like Google Fonts, YouTube, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first strategy for API calls, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache a clone of the response for offline fallback
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-first for static assets
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          // Optionally cache new static assets dynamically
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, cloned);
            });
          }
          return response;
        });
      })
    );
  }
});

// ==================== Push Notification Handling ====================
self.addEventListener('push', event => {
  console.log('[SW] Push received:', event);

  // Default notification data
  let notificationData = {
    title: 'AlamQuant ATTS',
    body: 'Remember your trading journal! 📊',
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    image: '/assets/reminder-banner.jpg', // optional custom image
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'open-journal', title: 'Write Journal' },
      { action: 'snooze', title: 'Remind Later' }
    ],
    data: {
      url: '/#/journey'
    },
    tag: 'reminder'
  };

  // Try to extract payload from server
  if (event.data) {
    try {
      const parsed = event.data.json();
      notificationData = { ...notificationData, ...parsed };
    } catch (e) {
      // Plain text fallback
      notificationData.body = event.data.text();
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    image: notificationData.image,
    badge: notificationData.badge,
    vibrate: notificationData.vibrate,
    requireInteraction: notificationData.requireInteraction,
    actions: notificationData.actions,
    data: notificationData.data,
    tag: notificationData.tag || 'reminder',
    renotify: true,
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// ==================== Notification Click ====================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  console.log('[SW] Notification click:', event.action);

  const urlToOpen = event.notification.data?.url || '/#/journey';

  if (event.action === 'open-journal') {
    clients.openWindow('/#/journey');
  } else if (event.action === 'snooze') {
    // Optionally call an API to snooze reminders for 30 minutes
    // clients.openWindow('/#/profile'); // or keep as is
  } else {
    clients.openWindow(urlToOpen);
  }
});

// ==================== Push Subscription Change ====================
self.addEventListener('pushsubscriptionchange', event => {
  console.log('[SW] Subscription changed');
  event.waitUntil(
    fetch('/api/setup/update-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldSubscription: event.oldSubscription ? event.oldSubscription.toJSON() : null,
        newSubscription: event.newSubscription ? event.newSubscription.toJSON() : null
      })
    }).catch(err => console.error('[SW] Failed to update subscription', err))
  );
});