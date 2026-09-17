/* Service worker de Botiquín Digital.
   Guarda los archivos de la app para que abra sin conexión.
   Sube el número de versión cada vez que publiques cambios. */
const VERSION = 'botiquin-v2';
const ARCHIVOS = [
  './',
  './index.html',
  './botiquin-plus.css',
  './botiquin-plus-data.js',
  './botiquin-plus.js',
  './botiquin-app.js',
  './botiquin-app.css',
  './botiquin-pro.js',
  './botiquin-pro.css',
  './botiquin-pro-data.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const peticion = event.request;
  if (peticion.method !== 'GET' || !peticion.url.startsWith(self.location.origin)) return;

  // Navegación: intenta red, si falla entrega la app guardada.
  if (peticion.mode === 'navigate') {
    event.respondWith(
      fetch(peticion)
        .then(respuesta => {
          const copia = respuesta.clone();
          caches.open(VERSION).then(cache => cache.put('./index.html', copia));
          return respuesta;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto: primero lo guardado, y se actualiza en segundo plano.
  event.respondWith(
    caches.match(peticion).then(guardado => {
      const red = fetch(peticion)
        .then(respuesta => {
          if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(VERSION).then(cache => cache.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => guardado);
      return guardado || red;
    })
  );
});
