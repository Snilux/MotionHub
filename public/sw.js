// Service worker de MotionHub.
//
// Privacidad: la app muestra datos clínicos, así que NUNCA se guardan en caché
// páginas HTML ni respuestas de /api (los dashboards además se sirven con
// Cache-Control: no-store). Solo se cachean archivos estáticos públicos:
// los de /_astro/ (llevan hash en el nombre, no cambian nunca), íconos y fuentes.
// Sin conexión, cualquier navegación muestra /offline.html.

const VERSION = "v1";
const CACHE_ESTATICO = `motionhub-estatico-${VERSION}`;
const CACHE_PUBLICO = `motionhub-publico-${VERSION}`;

const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_PUBLICO)
      .then((cache) => cache.addAll(PRECACHE))
      // La nueva versión toma el control sin esperar a que se cierren las pestañas:
      // no hay HTML en caché que pudiera quedar desfasado
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const vigentes = [CACHE_ESTATICO, CACHE_PUBLICO];
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => n.startsWith("motionhub-") && !vigentes.includes(n)).map((n) => caches.delete(n)),
      );
      // Adelanta la petición de la página mientras arranca el service worker
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

const esEstaticoInmutable = (url) => url.pathname.startsWith("/_astro/");
const esEstaticoPublico = (url) =>
  url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/screenshots/") ||
  /\.(?:png|jpe?g|svg|webp|avif|ico|woff2?)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Datos y sesión: siempre a la red, nunca a la caché
  if (url.pathname.startsWith("/api/")) return;

  // Páginas: siempre de la red (con navigation preload); sin conexión, página offline
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          return preload || (await fetch(request));
        } catch {
          return (await caches.match("/offline.html")) || Response.error();
        }
      })(),
    );
    return;
  }

  // /_astro/*: caché primero (el hash en el nombre garantiza que no cambian)
  if (esEstaticoInmutable(url)) {
    event.respondWith(
      caches.open(CACHE_ESTATICO).then(async (cache) => {
        const enCache = await cache.match(request);
        if (enCache) return enCache;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Íconos, imágenes y fuentes públicas: responde de la caché y actualiza en segundo plano
  if (esEstaticoPublico(url)) {
    event.respondWith(
      caches.open(CACHE_PUBLICO).then(async (cache) => {
        const enCache = await cache.match(request);
        const deRed = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => enCache);
        return enCache || deRed;
      }),
    );
  }
});
