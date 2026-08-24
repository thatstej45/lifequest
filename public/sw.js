/* Service Worker Version: dev */
const VERSION = 'dev';
const channel = new BroadcastChannel('lifequest_channel');

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== `lifequest-cache-${VERSION}`) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// A standard network-first fetch handler with offline fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Ignore browser extensions and hot module elements
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(`lifequest-cache-${VERSION}`).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  const goalId = event.notification.data?.goalId;
  const action = event.action;

  event.notification.close();

  if (action === 'complete' && goalId) {
    channel.postMessage({ type: 'COMPLETE_QUEST', goalId });
  } else if (action === 'snooze' && goalId) {
    // Snooze logic could be handled by app or just ignored as placeholder
    channel.postMessage({ type: 'SNOOZE_QUEST', goalId });
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/' + (goalId ? '?completeId=' + goalId : ''));
    })
  );
});
