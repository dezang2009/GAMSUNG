const CACHE = "news-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "config.js", "manifest.json", "icon.svg", "icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 네트워크 우선, 실패 시 캐시 (오프라인에서도 마지막 뉴스 보기)
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data?.text() }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "오늘의 뉴스", {
      body: d.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: { url: new URL(d.url || "./", self.registration.scope).href },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const w = list.find((c) => c.url.startsWith(self.registration.scope));
      return w ? w.focus().then((c) => c.navigate(url)) : self.clients.openWindow(url);
    })
  );
});
