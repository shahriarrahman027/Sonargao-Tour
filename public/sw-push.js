/* eslint-disable no-restricted-globals */
// Background Web Push handler imported by Workbox sw.js (vite-plugin-pwa).

self.addEventListener('push', (event) => {
  const defaultTitle = 'সস্তায় ১ দিনের ট্যুর';
  let data = {
    title: defaultTitle,
    body: 'ট্যুর ফান্ডে নতুন হিসাব আপডেট এসেছে!',
    icon: '/images/logo.jpg',
    badge: '/icons/icon.svg',
    tag: 'tour-money-update',
    url: '/?tab=money',
    tab: 'money',
    eventKey: '',
    renotify: false,
    timestamp: Date.now(),
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = {
          ...data,
          ...parsed,
          tag: parsed.tag || parsed.eventKey || data.tag,
          url: parsed.url || (parsed.tab ? `/?tab=${encodeURIComponent(parsed.tab)}` : data.url),
        };
      }
    } catch {
      try {
        const text = event.data.text();
        if (text) data.body = text;
      } catch {
        // use default text
      }
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/images/logo.jpg',
    badge: data.badge || '/icons/icon.svg',
    tag: data.tag,
    renotify: Boolean(data.renotify),
    timestamp: Number(data.timestamp) || Date.now(),
    data: {
      url: data.url,
      tab: data.tab || 'money',
      eventKey: data.eventKey || '',
      kind: data.kind || 'money_event',
    },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || defaultTitle, notificationOptions),
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            client.postMessage({
              type: 'TOUR_PUSH_RECEIVED',
              payload: data,
            });
          }
        })
        .catch(() => {}),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = (event.notification && event.notification.data) || {};
  const tab = notifData.tab || 'money';
  const eventKey = notifData.eventKey || '';
  const targetUrl =
    notifData.url ||
    `/?tab=${encodeURIComponent(tab)}${eventKey ? `&notif=${encodeURIComponent(eventKey)}` : ''}`;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin && 'focus' in client) {
              await client.focus();
              client.postMessage({
                type: 'TOUR_NOTIFICATION_CLICK',
                tab,
                eventKey,
                url: targetUrl,
              });
              return;
            }
          } catch {
            // inspect next client
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'TOUR_PUSH_SUBSCRIPTION_CHANGED',
            oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
          });
        }
      })
      .catch(() => {}),
  );
});
