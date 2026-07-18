/* 진리서재 — PWA service worker (/truthlib/ 전용, 로컬은 scope 기준) */
var CACHE = "truthlib-v7";

function appBase() {
  try {
    var scope = (self.registration && self.registration.scope) || self.location.href;
    var u = new URL(scope);
    var p = u.pathname || "/";
    if (!p.endsWith("/")) p = p.replace(/\/[^/]*$/, "/") || "/";
    return p;
  } catch (e) {
    return "/truthlib/";
  }
}

var BASE = appBase();

var PRECACHE = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.json",
  BASE + "app.js",
  BASE + "app.css",
  BASE + "markdown.js",
  BASE + "scr-link.js",
  BASE + "version.js",
  BASE + "data/catalogs.json",
  BASE + "data/site-settings.json",
  BASE + "icon-192.png",
  BASE + "icon-512.png",
  BASE + "truthlib-icon-maskable-512.png",
  BASE + "apple-touch-icon.png"
];

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function underApp(pathname) {
  if (BASE === "/") return true;
  var prefix = BASE.replace(/\/$/, "");
  return pathname === prefix || pathname.indexOf(BASE) === 0;
}

function networkFirst(request) {
  return fetch(request)
    .then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(request, copy);
        });
      }
      return res;
    })
    .catch(function () {
      return caches.match(request);
    });
}

function staleWhileRevalidate(request) {
  return caches.match(request).then(function (cached) {
    var fetched = fetch(request)
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return res;
      })
      .catch(function () {
        return cached;
      });
    return cached || fetched;
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {});
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  if (!isSameOrigin(event.request.url)) return;

  var path = new URL(event.request.url).pathname;
  if (!underApp(path)) return;
  if (path.indexOf("/api/") >= 0 || path.indexOf(BASE + "api/") === 0) return;

  // 과정·카탈로그 데이터·성경: 네트워크 우선
  if (
    path.indexOf(BASE + "data/") === 0 ||
    path.indexOf(BASE + "bible/") === 0
  ) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 셸·기타: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});
