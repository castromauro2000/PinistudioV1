/* =============================================================
    PiniStudio — Service Worker
   ------------------------------------------------------------
   Hace tres cosas:
   1) Guarda los archivos de la app en caché para que funcione
      SIN INTERNET (offline).
   2) Muestra las notificaciones del sistema operativo, incluso
      con la app cerrada.
   3) Abre la app cuando tocás la notificación.
   ============================================================= */

const CACHE = 'pinistudio-v7';

const ARCHIVOS = [
  './',
  './index.html',
  './styles.css?v=7',
  './app.js?v=7',
  './manifest.json',
  './privacidad.html',
  './terminos.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

/* --- Instalación: precacheamos todo --- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

/* --- Activación: borramos cachés viejas --- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(
        nombres.filter(n => n !== CACHE).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/* --- Peticiones: sirvimos desde caché y actualizamos en segundo plano --- */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // no interceptamos otros sitios

  // Navegación: primero la red (para tener la versión nueva), si no, la caché.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copia));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto (css, js, íconos): caché primero, y de paso actualizamos.
  event.respondWith(
    caches.match(req).then(cachada => {
      const red = fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put(req, copia));
          }
          return res;
        })
        .catch(() => cachada);
      return cachada || red;
    })
  );
});

/* --- Llega una notificación push del servidor --- */
self.addEventListener('push', event => {
  let datos = { title: 'PiniStudio', body: 'Tenés un aviso nuevo' };

  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch (e) {
    if (event.data) datos.body = event.data.text();
  }

  event.waitUntil(self.registration.showNotification(datos.title, {
    body: datos.body,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: datos.tag || 'pinistudio',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: datos.url || './' }
  }));
});

/* --- Tocás la notificación: se abre (o se enfoca) la app --- */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      for (const cliente of lista) {
        if ('focus' in cliente) return cliente.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

/* --- Botón "probar" desde la app: muestra una notificación local --- */
self.addEventListener('message', event => {
  if (event.data && event.data.tipo === 'probar') {
    self.registration.showNotification('PiniStudio', {
      body: '¡Las notificaciones funcionan! 🔔',
      icon: 'icons/icon-192.png',
      tag: 'prueba',
      data: { url: './' }
    });
  }
});
