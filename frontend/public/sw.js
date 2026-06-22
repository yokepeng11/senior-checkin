// Service Worker for Senior Check-In push notifications

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', function (event) {
  let data = { title: '☀️ Good Morning!', body: "Time to check in — tap to open the app." };
  try {
    if (event.data) data = event.data.json();
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: 'daily-checkin',
      renotify: true,
      requireInteraction: true,
      actions: [
        { action: 'checkin', title: '✅ Check In Now' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Open/focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes('/senior/') || c.url === self.location.origin + '/');
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});
