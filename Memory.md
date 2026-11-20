# Memory.md — PiniStudio (estado actual)

> Leer al **empezar**. Actualizar al **terminar**. Máximo 50 líneas.
> Las reglas permanentes van a `AGENTS.md`; esto es estado y decisiones.
> App de control de estudio (argentina). **Vanilla HTML/CSS/JS**, sin framework,
> sin build, sin tests. Producción: **https://pinistudio.vercel.app**

## Estado (nov 2026)
- ✅ Completa: materias, cronómetro con atribución, rachas, metas diaria/semanal,
  calendario con íconos (📚🌊🧉📌), descansos de fin de semana + override,
  pausa del mate, historial mensual, gráfico por materia, temas, exportación
  `.ics`/`.json`, PWA instalable (manifest + íconos + SW con offline).
- ✅ Publicada en **Vercel** (pública, sin login). Docs: `README`, `PUBLICAR`,
  `COMPARTIR`, `CELULAR`, `LEEME.txt`, `LECCIONES/`, `GOOGLE-CALENDAR.md`,
  `AGENTS.md`.
- ✅ **Google Calendar integrado y funcionando** (probado end-to-end el
  18/11/2026): calendario "PiniStudio" creado, evento con recordatorios
  popup+email, borrado en Google al borrar en la app. Client ID real ya está
  en `app.js`. Proyecto `pinistudio` en Google Cloud, API habilitada,
  consent screen publicado, cliente `pinistudio-web`.
- 📄 Nuevas páginas **`privacidad.html`** y **`terminos.html`** (el consent
  screen las pide). En Vercel entran por `/privacidad` y `/terminos`
  (`cleanUrls`), no por `.html` (308). Los enlaces del consent screen ya
  apuntan a las URLs limpias.
- ⬜ Pendiente real: **sincronización entre dispositivos** (cada navegador tiene
  sus datos en `localStorage`). Es lo más pedido y no existe.
- ⬜ Opcional: push real (`worker-push.js` escrito, sin desplegar).
- 🛠️ Entorno: **gentle-ai 4.6.0** instalado y OpenCode configurado en global
  (persona + skills + permisos + Context7), con `engram` 3.7.2 y `gga`.
  Requiere el CLI `opencode` en PATH (`npm.cmd i -g opencode-ai`); tras
  reiniciar la terminal, `gentle-ai doctor` da healthy 8/8. Detalles en Engram.
- 📌 `index.html` usa `?v=7` en `app.js`/`styles.css` y `sw.js` va en
  `pinistudio-v7` (ver error 5). Actualizar ambos al tocar JS/CSS.

## Decisiones (el porqué; el "cómo" está en AGENTS.md)
- **Vanilla, sin framework**: no hay Node; tiene que ser editable a mano.
- **PWA y no APK**: se instala desde el celu con un clic, sin Android Studio.
- **`pinistudio.html` aparte**: para compartir por WhatsApp; no sirve `file://`.
- **El OAuth de Google va en el navegador (sin backend)**: Client ID público en
  `app.js`; el token vive en `pinistudio-google`, fuera de `estado`.
- **Scope `calendar.app.created` (no sensible)**: no requiere verificación de
  Google. Consecuencia: **no puede listar calendarios** (403) → cada
  navegador crea su propia copia del calendario "PiniStudio".
- **Eventos emparejados por `extendedProperties.private.pinistudioId`**: deja
  borrar en Google lo que ya no está en la app, sin duplicados.

## Errores a evitar (aprendidos a golpes)
1. Editar la raíz y **olvidar copiar a `publicar/`** → se sube la versión vieja.
2. **Acentos desde PowerShell**: la consola mangla el no-ASCII. Usar
   `write`/`edit` o `[char]0xED` / `[char]0xF3`.
3. **Reemplazos masivos con arrays anidados en PowerShell**: corrompió
   `app.js`/`styles.css`. No es invertible: usar mapas explícitos.
4. **Pestañas viejas del browser al testear**: cada una corre su `setInterval`
   de 10 s y pisa el `localStorage`.
5. **El SW mezcla HTML nuevo con JS viejo**: elSW sirve `app.js` desde caché
   *primero* → el usuario ve el error "Falta el Client ID" aunque el servidor
   esté bien. Arreglo permanente: **cache-busting** en `index.html`
   (`app.js?v=N`, `styles.css?v=N`) + subir `CACHE` en `sw.js` (hoy
   `pinistudio-v7`). Cambiar la versión `?v=` obliga a bajar el JS nuevo
   aunque el SW sea viejo. `empaquetar.ps1` acepta el `?v=N`.
6. **Un bloque fusionado dentro de un comentario `//`** rompe una función en
   silencio: revisar que no se comió una línea.
7. **`ReadAllBytes` no acepta un string**: usar
   `[System.Text.Encoding]::UTF8.GetBytes(...)`.
8. **La nueva UI "Google Auth Platform"** cambió todas las URLs: son
   `/auth/overview/create`, `/auth/scopes`, `/auth/audience`, `/auth/branding`,
   `/auth/clients/create`. `/auth/consent` ya no existe.
