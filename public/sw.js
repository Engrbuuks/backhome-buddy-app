/* Backhome Buddy service worker.
 *
 * Deliberately minimal. Its ONE job is to be alive when the app is closed so a
 * pushed alert can raise a notification on the phone, for buddies, clients and admins alike. It does not cache
 * pages: this app is almost entirely live, per-user data behind a login, and a
 * stale cached dashboard showing an offer that expired an hour ago would be
 * worse than no cache at all.
 */

const VERSION = "bhb-sw-v1";

self.addEventListener("install", (event) => {
  // Take over immediately rather than waiting for every old tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* A push arrived. Show it. */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Backhome Buddy", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Backhome Buddy";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/maskable-192.png",
    // A task offer is time boxed, so it should not quietly disappear from the
    // shade before the buddy has looked at their phone.
    requireInteraction: payload.urgent === true,
    vibrate: payload.urgent === true ? [200, 100, 200] : [100],
    tag: payload.tag || "bhb",
    renotify: true,
    data: { url: payload.url || "/buddy/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* Tapping the notification should land on the task, reusing an open window
 * rather than piling up new tabs. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Falls back to "/", which routes to the right dashboard for whoever is
  // signed in. It used to fall back to /buddy/dashboard, which sent an admin
  // or a client to a page that is not theirs.
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
