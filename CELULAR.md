# 📲 PiniStudio en el celular

La app **ya es una PWA**: se instala desde el celu, tiene ícono propio, se abre a
pantalla completa (sin barra del navegador) y **funciona sin internet**.

---

## 📲 Cómo instalarla

### Android (Chrome)
1. Abrí el link de la app (el que te pasaron: `https://...netlify.app`).
2. Tocá el botón **📲** que aparece arriba a la derecha de la app
   (o el menú **⋮** → "Instalar app" / "Añadir a pantalla de inicio").
3. Confirmá "Instalar".
4. Listo: te aparece el ícono 📚 en tu pantalla de inicio.

### iPhone (Safari)
Safari no da el botón automático, es a mano:
1. Abrí el link en **Safari** (no en Chrome).
2. Tocá el botón **Compartir** (el cuadro con la flecha hacia arriba, ⬆️).
3. Bajá hasta **"Añadir a pantalla de inicio"** → **"Agregar"**.
4. Listo: ícono 📚 en tu pantalla.

> **Importante:** la app tiene que estar abierta desde un link **https** (o
> `http://localhost`). Si la abriste con doble clic desde un archivo, no se puede
> instalar (el navegador no lo permite por seguridad).

---

## 📦 Generar un APK de verdad (Android)

Si querés un archivo `.apk` para pasarlo por WhatsApp o subirlo a Play Store:

1. **Subí la carpeta `publicar/` a Netlify Drop** (<https://app.netlify.com/drop>)
   y quedate con la URL.
2. Entrá a **<https://www.pwa-builder.com>** y pegá la URL.
3. Presioná **"Start"** → analiza la PWA y te dice si está todo bien.
4. Presioná **"Package for stores"** → elegí **Android** → **"Generate"**.
5. Te baja un `.apk` y un `.aab` listo para instalar o publicar.

Es gratis, no necesitás Android Studio ni saber de código.

### Ajustes recomendados en PWA Builder
- **Package ID**: `com.tunombre.pinistudio`
- **Version**: `1.0.0`
- **Signing**: usá la clave que te genera PWA Builder o generá una con
  `keytool` (si tenés Java instalado).

---

## 🛠️ Si querés compilarlo vos mismo (opcional)

Con Node.js instalado:
```powershell
npm install -g @pwabuilder/cli
pwabuilder build --url=https://TU-LINK.netlify.app --platform=android
```

---

## ✨ Qué cambia cuando está instalada

| | En el navegador | Instalada |
|---|---|---|
| Ícono propio | ❌ | ✅ 📚 en la pantalla de inicio |
| Barra del navegador | Visible | Se oculta (pantalla completa) |
| Internet | Necesario | **Opcional** (funciona offline) |
| Notificaciones | Con permiso | Con permiso + Service Worker |
| Arranque | Carga la web | Abre al instante desde el ícono |
| Botón 📲 | Aparece | Desaparece (ya está instalada) |

---

## 🔧 Modo "app instalada" en el CSS

Para que se vea más como app, el CSS detecta si está instalada:

```css
@media (display-mode: standalone) {
  .topbar { padding-top: max(10px, env(safe-area-inset-top)); }
}
```

Y en JavaScript:
```js
const instalada = window.matchMedia('(display-mode: standalone)').matches;
```

---

## 📶 La app funciona sin internet

El Service Worker guarda los archivos en la caché del navegador:

```js
const ARCHIVOS = [
  './', './index.html', './styles.css', './app.js', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png', ...
];
```

Y en cada navegación:
- **Primero** intenta la red (para tener la versión nueva).
- Si no hay internet, **sirve desde la caché**.

Tus datos (materias, horas, rachas) están en `localStorage`, así que también
funcionan offline sin ningún servidor.

---

## 📝 Para probar el layout móvil en tu compu

Abrí `prueba-movil.html` en <http://localhost:8080/prueba-movil.html>:
muestra la app dentro de dos iframes con tamaño de celular (390×844 y 360×640).
Es la forma más rápida de ver si algo se rompe en pantallas chicas.
