# Memory.md — PiniStudio (estado actual)

> Leer al **empezar**. Actualizar al **terminar**. Máximo 50 líneas.
> Las reglas permanentes van a `AGENTS.md`; esto es estado y decisiones.
> App de control de estudio (argentina). **Vanilla HTML/CSS/JS**, sin framework,
> sin build, sin tests. Producción: **https://pinistudio.vercel.app**

## Estado (nov 2026)
- ✅ Completa: materias, cronómetro, rachas, metas, calendario con íconos
  (📚🌊🧉📌), fin de semana + override, pausa del mate, historial mensual,
  gráfico por materia, temas, export `.ics`/`.json`, PWA instalable.
- ✅ En **Vercel** (pública, sin login). Docs: `README`, `PUBLICAR`, `COMPARTIR`, `CELULAR`, `LEEME.txt`, `LECCIONES/`, `GOOGLE-CALENDAR.md`, `AGENTS.md`.
- ✅ **Google Calendar funcionando** (probado end-to-end 18/11): calendario
  "PiniStudio", recordatorios popup+email, borrado en Google al borrar en la app.
  Client ID real en `app.js`. Consent screen publicado. Páginas `privacidad.html`
  y `terminos.html` (en Vercel se sirven en `/privacidad` y `/terminos`).
- ✅ **Repo git local** (19/11): ramas `main` y `developer` con el mismo contenido.
  `.gitignore` excluye secretos. Remote de GitHub **pendiente** (falta `gh auth login`).
- ✅ Tarjeta "Horas de hoy" destacada (el doble de ancho en desktop, 182 px en el
  scroll del celu). Verificado en navegador: 0 errores, sin overflow nuevo.
- ⬜ Pendiente real: **sincronización entre dispositivos** (datos por navegador).
- ⬜ Opcional: push real (`worker-push.js` escrito, sin desplegar).
- 📌 `index.html` usa `?v=7` en JS/CSS y `sw.js` va en `pinistudio-v7`. Subir
  ambos al tocar JS/CSS (ver error 4).
- 🛠️ Entorno: gentle-ai 4.6.0 + OpenCode global, engram 3.7.2, `gh` CLI 2.105.0.

## Decisiones (el porqué; el "cómo" está en AGENTS.md)
- **Vanilla, sin framework**: editable a mano.
- **PWA y no APK**: se instala desde el celu con un clic.
- **`pinistudio.html` aparte**: para compartir por WhatsApp; no sirve `file://`.
- **OAuth en el navegador (sin backend)**: Client ID público en `app.js`; token en
  `pinistudio-google`, fuera de `estado` (no viaja en el `.json` compartido).
- **Scope `calendar.app.created` (no sensible)**: sin verificación de Google, pero
  no puede listar calendarios (403) → cada navegador crea su propia copia.
- **Eventos emparejados por `extendedProperties.private.pinistudioId`**: permite
  borrar en Google lo que ya no está en la app, sin duplicados.
- **Git: cambios en `main` → cherry-pick a `developer`**, ambas ramas iguales.

## Errores a evitar (aprendidos a golpes)
1. Editar la raíz y **olvidar copiar a `publicar/`** → se sube la versión vieja.
2. **Acentos desde PowerShell**: la consola mangla el no-ASCII. Usar `write`/`edit`.
3. **Arrays anidados en PowerShell** (`@(@('a','b'))` se aplana) corrompieron
   `app.js`/`styles.css`. No es invertible: usar mapas explícitos.
4. **El SW mezcla HTML nuevo con JS viejo** (sirve `app.js` de caché primero):
   cache-busting `?v=N` en `index.html` + subir `CACHE` en `sw.js`.
   `empaquetar.ps1` acepta el `?v=N`.
5. **Pestañas viejas** (pisan `localStorage`) y **bloque en un `//`** (rompe una función en silencio).
6. **`ReadAllBytes` no acepta un string**: usar `[System.Text.Encoding]::UTF8.GetBytes`.
7. **Google Auth Platform cambió las URLs**: `/auth/overview/create`, `/auth/scopes`,
   `/auth/audience`, `/auth/branding`, `/auth/clients/create`. `/auth/consent` ya no.
