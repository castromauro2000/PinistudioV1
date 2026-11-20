# AGENTS.md — PiniStudio

App de control de estudio (horas, materias, rachas, metas, calendario, avisos).
**Vanilla HTML/CSS/JS, sin framework, sin Node, sin npm, sin build.** Todo se
edita a mano y se despliega con scripts de PowerShell.

Producción: **https://pinistudio.vercel.app**

---

## Antes de empezar y al terminar

- **Al empezar**: leé **`Memory.md`** para conocer el estado del proyecto, las
  decisiones tomadas y los errores a evitar. No repitas trabajo ya hecho.
- **Al terminar**: actualizá **`Memory.md`** con el estado actual, las decisiones
  nuevas (**con su porqué**) y los errores a evitar. Máximo 50 líneas: resumí o
  eliminá lo que ya no aporta. Si algo se vuelve una **regla permanente**
  (comando, trampa de tooling, convención), **movelo a `AGENTS.md`** en vez de
  dejarlo en la memoria.
- **Nunca** guardes datos sensibles en `Memory.md`: claves, tokens, correos,
  IPs, datos personales. Mencioná solo *dónde* viven (ej. "token en
  `.vercel-token.txt`").

---

## Comandos (PowerShell, siempre con `powershell -ExecutionPolicy Bypass -File`)

| Comando | Qué hace |
|---|---|
| `.\servidor.ps1` | Dev server en **http://localhost:8080** (solo localhost) |
| `.\servidor-lan.ps1` | Servidor en **http://<IP>:8090** (red Wi-Fi, sin permisos de admin) |
| `.\empaquetar.ps1` | Regenera `pinistudio.html` (versión portable de un solo archivo) |
| `.\desplegar-vercel.ps1` | Sube `publicar/` a Vercel por API y devuelve la URL |
| `.\iniciar-tunel.ps1` | Levanta servidor + túnel público de Cloudflare (link temporal) |
| `.\reparar.ps1` | Revierte la corrupción de caracteres `P`→`L` (ver abajo) |

No hay tests ni linter. **Verificación = abrir `http://localhost:8080` y mirar la
consola del navegador.** Para mobile: `prueba-movil.html` (iframes de 390×844 y
360×640).

---

## Los 3 errores que más probable vas a cometer

### 1. Editar la raíz y olvidar `publicar/`
La raíz es la fuente de verdad, pero **Vercel despliega la carpeta `publicar/`**,
que es una *copia*. Si editás `app.js` y deployás sin copiar, sube la versión
vieja y no pasa nada visible.

```powershell
Copy-Item index.html,styles.css,app.js,sw.js,manifest.json publicar\ -Force
Copy-Item icons\*.png publicar\icons\ -Force
powershell -ExecutionPolicy Bypass -File .\desplegar-vercel.ps1
```

Mismo criterio para `pinistudio.html`: hay que correr `empaquetar.ps1` después de
cada cambio en `index.html` / `styles.css` / `app.js`.

### 2. Romper el archivo con acentos al escribir con PowerShell
Si editás un `.md` o `.js` con acentos usando `WriteAllText` + literales en el
script, la consola **mangla los caracteres no-ASCII** (ya pasó: quedó `disão`
por `diseño`). **Usá siempre las herramientas `write` / `edit` para tocar
texto.** Si de verdad necesitás PowerShell, construí los acentos con
`[char]0xED` / `[char]0xF3` como hace `reparar.ps1`.

Los `.js` / `.css` / `.html` del proyecto usan **LF**; `README.md` usa **CRLF**.
No los mezcles.

### 3. El túnel de Cloudflare contra el puerto equivocado
`cloudflared` **no puede apuntar a `servidor.ps1` (8080)**: ese usa `HttpListener`
con prefijo `http://localhost:8080/` y rechaza cualquier `Host` que no sea
localhost → el túnel responde **400 Bad Request**. El túnel tiene que ir contra
`servidor-lan.ps1` (8090, `TcpListener`, ignora el `Host`).

`iniciar-tunel.ps1` ya lo hace bien. El link `trycloudflare.com` **cambia en cada
reinicio** y la compu tiene que quedar encendida.

---

## Deployment en Vercel — dos trampas

1. **El sitio nace con login.** Vercel por defecto activa *Vercel Authentication*
   (`ssoProtection`), que hace que los visitantes vean la pantalla de login.
   Por eso el deploy tiene que hacer `PATCH /v9/projects/{id}` con
   `{"ssoProtection":null}`. **No borres ese bloque de `desplegar-vercel.ps1`**:
   es lo que hace que los amigos puedan entrar sin registrarse.
2. **El alias fijo**: `pinistudio.vercel.app` existe porque el *proyecto* se
   llama `pinistudio` (no hace falta crearlo a mano). El `POST /v13/aliases`
   puede fallar con 404 y **no es un error** — el link ya funciona.

Token: `.vercel-token.txt` (o `$env:VERCEL_TOKEN`). Es un secreto: no lo pegues
en el chat ni lo subas.

---

## Reglas del código

- **Todo el estado vive en `estado` (`app.js`)**, un objeto plano serializado a
  `localStorage` bajo la clave **`pinistudio-v1`**. Perfiles: cada navegador /
  cada dispositivo tiene sus propios datos (no hay backend). La migración desde
  `alexstudio-v1` / `plan-estudio-v1` está en `cargar()`.
- **Datetimes = ISO `YYYY-MM-DD`** en zona local (`aISO` / `desdeISO`). No uses
  `toISOString()` (convierte a UTC y corre el día).
- **Cero dependencias externas**: ni CDN, ni frameworks, ni npm. Iconos SVG
  inline o emoji.
- **No subas la clave privada VAPID.** La pública vive en `app.js`
  (`VAPID_PUBLIC_KEY`); la privada, solo en `worker-push.js` (Cloudflare Worker),
  que **no** se despliega con la app.
- **El Service Worker** (`sw.js`) cachea `pinistudio-v1`. Si cambiás `sw.js` o
  los assets que precachea, **subí el nombre de `CACHE`** o los usuarios quedan
  con la versión vieja.
- **El cronómetro solo cuenta con la app abierta o en background**: `acumularHoras()`
  corre cada 10 s (`reloj.tick`) y suma el delta a `estado.registro[hoy][materiaId]`.
  La pausa del mate (`estado.pausaHasta`) corta el conteo.
- `empaquetar.ps1` usa un **MatchEvaluator** (scriptblock) y no `-replace`, a
  propósito: si lo cambiás, el `${...}` de las plantillas JS se interpreta como
  grupo de captura y rompe el archivo. El script al final imprime cuántas
  plantillas `${` quedaron: **si dice 0, algo se rompió**.
- Los iconos de `icons/` se generaron **con canvas en el navegador**, no hay
  script. Si hay que regenerarlos, hay que hacerlo de nuevo a mano.

---

## Verificación

- Tras cualquier cambio en JS: abrí la consola del navegador. **0 errores.**
- `empaquetar.ps1` debe imprimir el conteo de `${` **> 0**.
- Con Service Worker activo, los cambios de `app.js` / `styles.css` no se ven
  hasta que se actualiza la caché: recargá con *hard reload* o subí el
  `CACHE`.
- **Cerrá las pestañas viejas del browser antes de testear**: cada pestaña con
  una versión anterior de `app.js` corre su `setInterval` de 10 s y **pisa el
  `localStorage`** con su estado.
- `sw.js` **no** se registra bajo `file://` ni en `pinistudio.html` (un solo
  archivo) → ahí no hay notificaciones push ni modo offline.

---

## Google Calendar (100% en el navegador, sin backend)

- **No hay backend ni carpeta `api/`.** Todo el OAuth y las llamadas a la API de
  Calendar se hacen desde el navegador. Verificado empíricamente: CORS deja
  pasar las peticiones a `www.googleapis.com` y a `oauth2.googleapis.com`.
- Se usa el **token client de Google Identity Services** (flujo implícito), no
  el flujo de código: es el único que funciona **sin *client secret*** en una
  app web. Google lo exige para el flujo de código.
- El **Client ID va en `app.js`** (`GOOGLE_CLIENT_ID`). **No es un secreto**:
  es público, aparece en la URL de la pantalla de permisos. Por eso puede ir
  en el código. El *client secret* **no se usa** en esta integración.
- **El token NO va dentro de `estado`**: `estado` se exporta a un `.json` que
  el usuario comparte. El token vive en su propia clave de localStorage
  (`pinistudio-google`) para que no viaje en ese archivo.
- El token dura **1 hora**. Cuando se vence, `renovarGoogle()` lo vuelve a
  pedir (Google abre su ventana de permiso). `pedirGoogle()` reintenta una vez
  solo ante un 401.
- El scope es **`calendar.app.created`**: NO da acceso a los otros calendarios
  del usuario y **no es sensible**, así que Google no pide verificación de la
  app y todos pueden conectar su cuenta sin trámite.
- Los eventos se emparejan por `extendedProperties.private.pinistudioId` (el id
  interno de la app). Sin eso, al borrar una fecha en la app queda el evento
  huérfano en Google.
- **`calendar.app.created` NO deja listar calendarios**: `GET
  /users/me/calendarList` responde **403 insufficient authentication scopes**.
  La app crea un calendario "PiniStudio" y guarda su id en `pinistudio-google`;
  por eso cada navegador/dispositivo crea su propia copia. No intentes
  "arreglarlo" pidiendo `calendar.readonly`: es un scope sensible y obliga a
  verificación de la app.
- Para conectar, el origen exacto (`https://pinistudio.vercel.app`) tiene que
  estar en *Authorized JavaScript origins* del cliente de Google Cloud.
- **Node SÍ está instalado** (v26) aunque el proyecto no lo use: `node --check
  app.js` valida la sintaxis al instante.

---
## Historia que conviene conocer

Un renombre masivo con PowerShell **corruptió** `app.js`, `styles.css`,
`servidor-lan.ps1`, `worker-push.js` y `README.md`: se reemplazaron letras
sueltas (`P`→`L`, `A`→`l`). La causa: **`@(@('a','b'))` se aplana** en PowerShell
(queda `@('a','b')`), así que `$par[0]` devolvía el *primer carácter* del string
en vez del par. Un reemplazo de caracteres **no es invertible**.

Consecuencias:
- **Nunca** escribas un script de reemplazo masivo con arrays anidados. Usá una
  lista de `@{ f='Token'; t='Token' }` y ordená por longitud descendente.
- `reparar.ps1` es el mapa explícito de esa reparación: **es la referencia** de
  cómo reparar.
- `LECCIONES/07-powershell.md` documenta el bug. `LECCIONES/08-pwa.md` explica
  el Service Worker y la PWA.

## Documentos

`README.md` (general) · `PUBLICAR.md` / `COMPARTIR.md` (publicar y compartir) ·
`CELULAR.md` (instalar en el celu, generar APK) · `LEEME.txt` (para el usuario
final) · `LECCIONES/` (8 lecciones de código, en español rioplatense).
