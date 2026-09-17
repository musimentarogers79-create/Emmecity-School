const CACHE_NAME = 'emmecty-school-shell-v1';

self.addEventListener('push', (event) => {
  event.waitUntil(self.registration.showNotification('New school notification', {
    body: 'Sign in to the EMMECTY school portal to view this notification.',
    icon: `${new URL('./school-logo.png', self.registration.scope).toString()}`,
    badge: `${new URL('./school-logo.png', self.registration.scope).toString()}`,
    data: { url: self.registration.scope },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => 'focus' in client);
    if (existing) return existing.focus();
    return self.clients.openWindow(event.notification.data?.url || self.registration.scope);
  }));
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('emmecty-school-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(new URL('./', self.registration.scope).toString()))),
    );
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination) || url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});