// Service Worker for Senior Check-In push notifications
// v11 — fix header and button text visibility

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', function (event) {
  let data = { title: '☀️ Good Morning!', body: 'Time to check in — tap to open the app.', url: '/' };
  try { if (event.data) data = { url: '/', ...event.data.json() }; } catch {}

  const isAlert = data.url === '/nok';

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      tag: isAlert ? 'caregiver-alert' : 'daily-checkin',
      renotify: true,
      requireInteraction: true,
      data: { url: data.url },
      actions: isAlert
        ? [{ action: 'open', title: '👀 View Dashboard' }, { action: 'dismiss', title: 'Dismiss' }]
        : [{ action: 'checkin', title: '✅ Check In Now' }, { action: 'dismiss', title: 'Dismiss' }],
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(url) || c.url === self.location.origin + '/');
      if (existing) { existing.focus(); return; }
      return self.clients.openWindow(url);
    })
  );
});
