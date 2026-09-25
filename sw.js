/* Service Worker Version: 1.0.20 */
const VERSION = '1.0.20';
const channel = new BroadcastChannel('lifequest_channel');
// The worker ships next to index.html, so its own directory is the app root
// whether that is / or a GitHub Pages subpath like /lifequest/.
const APP_ROOT = new URL('./', self.location.href).href;

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
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        // start_url carries a query string, so an offline launch has to fall
        // back to the cached shell rather than an exact URL match.
        if (event.request.mode === 'navigate') {
          return caches.match(APP_ROOT, { ignoreSearch: true });
        }
        return Response.error();
      })
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? 'A LifeQuest reminder is ready.' };
  }

  const goalId = payload.goalId ?? payload.data?.goalId;
  const webKitNotification = /AppleWebKit/i.test(self.navigator.userAgent);
  const tapCompletes = Boolean(goalId && webKitNotification);
  const detail = (payload.body ?? '').trim();
  const body = [detail, tapCompletes ? 'Tap to mark done · Swipe to dismiss' : '']
    .filter(Boolean)
    .join('\n') || 'Your quest is ready.';
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Quest reminder', {
      body,
      icon: new URL('icon-lightning-192.png', APP_ROOT).href,
      badge: new URL('icon-lightning-192.png', APP_ROOT).href,
      tag: goalId ? `quest-${goalId}` : 'lifequest-reminder',
      renotify: true,
      silent: false,
      data: { goalId, tapCompletes },
      actions: goalId ? [
        { action: 'dismiss', title: 'Dismiss' },
        { action: 'done', title: 'Done' },
      ] : [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const goalId = event.notification.data?.goalId;
  const action = event.action;
  const completesGoal = Boolean(
    goalId && (action === 'done' || (!action && event.notification.data?.tapCompletes)),
  );

  event.notification.close();

  if (action === 'dismiss') return;

  if (completesGoal) {
    channel.postMessage({ type: 'COMPLETE_QUEST', goalId });
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
      const target = new URL(APP_ROOT);
      if (completesGoal) target.searchParams.set('completeId', goalId);
      return clients.openWindow(target.href);
    })
  );
});
