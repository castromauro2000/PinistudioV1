# Lección 8 — Convertir la web en una app de verdad (PWA)

Una **PWA** (Progressive Web App) es una web que se comporta como una app
instalada: ícono en la pantalla de inicio, pantalla completa, y funciona
**sin internet**. No es un `.apk` ni un `.ipa`, pero el usuario la ve igual.

---

## 1. Las tres piezas de una PWA

### 1. El `manifest.json` — los "papeles" de la app

```json
{
  "name": "PiniStudio - Control de Estudio",
  "short_name": "PiniStudio",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "theme_color": "#16a34a",
  "background_color": "#0e1117",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Los campos clave:

| Campo | Qué hace |
|---|---|
| `display: "standalone"` | **Sin barra de navegador**: se ve como app |
| `theme_color` | El color de la barra de estado del celu |
| `background_color` | El color mientras carga (evita el "flash" blanco) |
| `scope` | Qué carpetas pertenecen a la app |
| `purpose: "maskable"` | Ícono con margen extra: Android lo recorta en círculo, en cuadro o en gota |

Y se enlaza en el HTML:

```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#16a34a">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">   <!-- iPhone -->
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
```

### 2. El Service Worker — el modo offline

```js
const CACHE = 'pinistudio-v1';
const ARCHIVOS = ['./', './index.html', './styles.css', './app.js', ...];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachada => {
      const red = fetch(event.request).then(res => { /* actualiza la caché */ return res; });
      return cachada || red;      // caché primero, red de respaldo
    })
  );
});
```

**Estrategia "cache first"**: sirve la versión guardada (rápido, funciona sin
señal) y de paso se actualiza con la de la red para la próxima.

Para la navegación (abrir la app) conviene al revés: **red primero, caché de
respaldo**, así el usuario siempre ve la versión nueva si tiene internet:

```js
if (req.mode === 'navigate') {
  event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
}
```

### 3. El botón de instalar — el evento del navegador

Chrome dispara `beforeinstallprompt` cuando la app cumple los requisitos:

```js
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();          // frenamos el cartel propio de Chrome
  promptInstalacion = e;       // lo guardamos para nuestro botón
});

async function instalarApp() {
  promptInstalacion.prompt();
  const { outcome } = await promptInstalacion.userChoice;
}
```

En **Safari (iPhone) no existe ese evento**: el usuario tiene que hacer
"Compartir → Añadir a pantalla de inicio" a mano. Por eso el botón tiene que
mostrar **instrucciones** en vez de fallar.

---

## 2. Detectar si ya está instalada

```js
const instalada = window.matchMedia('(display-mode: standalone)').matches
              || window.navigator.standalone === true;   // iOS
```

Y en el CSS, para adaptar el diseño:

```css
@media (display-mode: standalone) {
  .topbar { padding-top: max(10px, env(safe-area-inset-top)); }
}
```

`env(safe-area-inset-top)` es el espacio que ocupa la **notch** (el notch del
celu). Si no lo respetás, el contenido queda debajo de la cámara.

---

## 3. El CSS móvil

Los puntos que más se rompen en pantallas chicas:

### a) Grillas que no entran
```css
@media (max-width: 700px) {
  .fila-grafico { grid-template-columns: 22px 1fr auto; }   /* en vez de 4 columnas */
  .form-materia { grid-template-columns: 1fr 54px 44px; }
}
```
Cuando una grilla de 4-5 columnas no entra en 360 px, la solución es
**reorganizar**, no achicar.

### b) Filas scrolleables (como las apps nativas)
```css
.stats {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}
.stat { flex: 0 0 auto; min-width: 128px; scroll-snap-align: start; }
```
En vez de 9 tarjetas apiladas (5 pantallas de scroll), una fila que se desliza
con el dedo. Se llama **carousel** y es el patrón estándar en apps.

### c) Modales como "hoja inferior" (bottom sheet)
```css
@media (max-width: 700px) {
  .modal { padding: 0; align-items: end; }
  .modal-caja { width: 100%; border-radius: 18px 18px 0 0; }
}
```
El modal sube desde abajo, como en WhatsApp. En escritorio va centrado.

### d) Zonas seguras
```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## 4. Cómo probar el layout móvil sin un celular

Truco: una página con la app dentro de un `iframe` del tamaño de un celu.

```html
<iframe src="index.html" width="390" height="844"></iframe>
<iframe src="index.html" width="360" height="640"></iframe>
```

(`prueba-movil.html` en el proyecto). Es mucho más rápido que andar pasando
el celu.

---

## 5. Generar un APK de verdad

Una PWA se puede empaquetar como app nativa:

1. Subís la app a un hosting **https**.
2. En <https://www.pwa-builder.com> pegás la URL.
3. Te genera un `.apk` (para instalar a mano) y un `.aab` (para Google Play).

Gratis y sin necesidad de Android Studio.

---

## 📝 Para practicar

1. **Modo oscuro automático**: que la app siga la preferencia del sistema.
2. **Splash screen**: una pantalla de bienvenida con tu ícono mientras carga.
3. **Widget de escritorio**: mostrar la racha del día sin abrir la app.
4. **Sincronizar entre celu y compu**: con Supabase o Firebase.
5. **Compartir con el menú del sistema**: usar la Web Share API.
