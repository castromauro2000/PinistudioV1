# 📅 Conectar PiniStudio con Google Calendar

Cada fecha que guardes en la app también se anota en tu **Google Calendar**, con
su recordatorio. Así te avisa en la **compu** y en el **celu**, aunque la app
esté cerrada.

**No hace falta ningún servidor.** Todo pasa en el navegador. Lo único que hay
que hacer es un trámite de **una sola vez** en Google Cloud Console (~10 min) y
copiar un **Client ID** (que es público, no es un secreto).

---

## 🧩 Cómo funciona

```
Tu navegador                          Google
      │                                  │
      │ 1. "Guardé una fecha"            │
      ├─────────────────────────────────►│
      │ 2. POST calendar/v3/.../events   │
      │    con el access_token           │
      │◄─────────────────────────────────┤
      │ 3. Google crea el evento con    │
      │    recordatorio (popup + email)  │
```

- El **access token** lo pide Google con el "token client" de **Google Identity
  Services** (GIS). Vive en el `localStorage` del navegador, en su propia clave
  (`pinistudio-google`), **separada** de los datos de la app: así nunca viaja
  en el `.json` de respaldo que compartís.
- El token dura **1 hora**. Cuando se vence, la app lo vuelve a pedir solo
  (Google abre su ventana de permiso y le das "Continuar").
- El scope es `calendar.app.created`: PiniStudio crea **su propio** calendario
  "PiniStudio" y **no toca tus otros calendarios**. Como no es un scope
  sensible, **Google no pide verificación** de la app: todos los que usen
  PiniStudio pueden conectar su cuenta sin ningún trámite.

---

## 📋 Paso 1 — Crear el proyecto en Google Cloud

1. Entrá a **<https://console.cloud.google.com/projectcreate>**
2. **Nombre del proyecto**: `pinistudio`
3. **Continuar** → **Crear**

> Google te va a pedir crear un **billing account**. Es obligatorio aunque no
> cobres nada (los proyectos gratuitos siguen necesitando una tarjeta).
> **No te cobra nada** mientras no pases los límites gratuitos.

## 📋 Paso 2 — Activar la API de Calendar

1. Entrá a **<https://console.cloud.google.com/apis/library>**
2. Buscá **"Google Calendar API"**
3. Tocá el resultado y presioná **Habilitar**

## 📋 Paso 3 — La pantalla de consentimiento

> Google migró a la interfaz nueva **"Google Auth Platform"**: las URLs viejas
> (`/auth/consent`) ya no existen. Usá estas:
>
> - `/auth/overview/create` — asistente (nombre de la app, tipo de usuario,
>   contacto del desarrollador, aceptar la política de datos).
> - `/auth/audience` — **Usuarios externos**, **Test users**, **Publicar app**.
> - `/auth/scopes` — **Acceso a los datos**: "Agregar o quitar permisos" →
>   "Agrega permisos manualmente" → pegá el scope → "Agregar a la tabla" →
>   tildá el checkbox → **Actualizar** → **Save**.
> - `/auth/branding` — **Información de la marca**: nombre, email de soporte,
>   **página principal**, **política de privacidad**, **términos del servicio** y
>   **Dominios autorizados** (agregá `pinistudio.vercel.app`).
> - `/auth/clients/create` — **Crear cliente**.

1. Entrá a **<https://console.cloud.google.com/auth/overview/create?project=pinistudio>**
2. Configurá:
   - **Nombre de la aplicación**: `PiniStudio`
   - **Correo electrónico de asistencia al usuario**: el tuyo
   - **Tipo de usuario**: `Usuarios externos`
   - **Información de contacto** (developer): el tuyo
   - Aceptar la **Política de Datos del Usuario**
3. En **Acceso a los datos → Agregar o quitar permisos**, agregá:

   ```
   https://www.googleapis.com/auth/calendar.app.created
   ```

   > Este scope permite que PiniStudio **cree su propio calendario** y agregue
   > eventos ahí. **No** le da acceso a tus otros calendarios ni puede leerlos.
   > Por eso Google no pide verificación.

4. En **Público → Add users** → agregá tu email (y el de tus amigos, si
   querés que ellos también puedan conectar). Guardá.
5. Presioná **Publicar app** → **Confirmar**. ¡Listo!

## 📋 Paso 4 — La marca (necesaria para publicar)

En **Información de la marca** (`/auth/branding`) cargá:

- **Nombre de la aplicación**: `PiniStudio`
- **Correo electrónico de asistencia al usuario**: el tuyo
- **Página principal**: `https://pinistudio.vercel.app`
- **Política de Privacidad**: `https://pinistudio.vercel.app/privacidad`
- **Condiciones del Servicio**: `https://pinistudio.vercel.app/terminos`
  (en Vercel `cleanUrls: true`: la URL real es sin `.html`)
  (las dos páginas ya viven en el repo: `privacidad.html`, `terminos.html`)
- **Dominios autorizados**: `pinistudio.vercel.app`

Guardá. Sin esto el botón **Publicar app** no aparece.

## 📋 Paso 5 — Crear el Client ID

1. Entrá a **<https://console.cloud.google.com/auth/clients?project=pinistudio>**
2. **Crear cliente** → **Aplicación web**
3. **Nombre**: `pinistudio-web`
4. En **Orígenes autorizados de JavaScript** agregá:

   ```
   https://pinistudio.vercel.app
   ```

   (y `http://localhost:8080` si querés probarlo en tu compu)

5. Presioná **Crear**
6. Te muestra el **Client ID** (y un *client secret* que **no necesitás**).

## ✅ Ya está hecho (nov 2026)

El trámite de Google ya está completo para este proyecto:

- Proyecto `pinistudio` (id `pinistudio`) creado.
- **Google Calendar API** habilitada.
- Pantalla de consentimiento: `PiniStudio`, usuarios externos, scope
  `calendar.app.created`, tu email como test user, **publicada**.
- Cliente OAuth `pinistudio-web` con orígenes:
  `https://pinistudio.vercel.app` y `http://localhost:8080`.
- Client ID pegado en `app.js`.

> ⚠️ **No hace falta repetirlo.** Si se repite "por si acaso" vas a crear un
> segundo proyecto/cliente y después hay que elegir cuál dejar.

### Client ID actual

```
119848058510-ro0449o7222mju0uunkm3rmcq6cu3jk6.apps.googleusercontent.com
```

Lo encontrás en `app.js`:

```js
const GOOGLE_CLIENT_ID = '119848058510-ro0449o7222mju0uunkm3rmcq6cu3jk6.apps.googleusercontent.com';
```

### Sobre el calendario "PiniStudio"

El scope `calendar.app.created` **no permite listar los calendarios** del
usuario (`GET /users/me/calendarList` responde **403 insufficient
authentication scopes**). Por eso la app **crea su propio calendario** y
guarda su id en el navegador (`pinistudio-google`). Consecuencia: **cada
dispositivo/navegador donde conectes crea su propia copia** del calendario
"PiniStudio". Si querés una sola, usalo siempre desde el mismo navegador o
borrá el duplicado a mano en Google Calendar.

## 📋 Paso 6 — Publicar cambios (cuando edites la app)

```powershell
Copy-Item index.html,styles.css,app.js,sw.js,manifest.json,privacidad.html,terminos.html publicar\ -Force
Copy-Item icons\*.png publicar\icons\ -Force
powershell -ExecutionPolicy Bypass -File .\empaquetar.ps1
powershell -ExecutionPolicy Bypass -File .\desplegar-vercel.ps1
```

## 📋 Paso 7 — Conectar tu cuenta

1. Abrí **https://pinistudio.vercel.app**
2. **⚙️ Ajustes** → **📅 Google Calendar** → **🔗 Conectar con Google**
3. Google te pide permiso → **Continuar**
4. ¡Listo! Se crea un calendario nuevo llamado **"PiniStudio"** en tu Google
   Calendar, con todas tus fechas y sus recordatorios.

---

## ⚙️ Qué hace cada cosa

| | |
|---|---|
| **Sincronizar automáticamente** | Si está activado, cada fecha que guardes va a Google al instante. Si lo apagás, sólo sincroniza cuando tocás "Sincronizar ahora". |
| **🔄 Sincronizar ahora** | Manda todas tus fechas. Compara con lo que ya tiene en Google y crea, actualiza o borra lo que corresponda. |
| **🔌 Desconectar** | Borra el token del navegador y le pide a Google que revoque el acceso. **Los eventos que ya estaban en Google no se borran** (los borrás desde Google si querés). |

### Los recordatorios

| Tipo de fecha | Aviso en Google |
|---|---|
| 📚 Examen | según "Avisar con N días antes" (1, 2, 3 o 7) |
| 🧉 Con compañero | **1 día antes** (igual que en la app) |
| 🌊 Día libre / 📌 Otro | el mismo día |

Cada evento lleva **dos** recordatorios: *popup* (la ventanita de Google Calendar)
y *email* (te llega al correo). Por eso te avisa aunque tengas la compu
apagada.

---

## 🆘 Problemas

| Síntoma | Causa | Solución |
|---|---|---|
| "Falta el Client ID de Google en la app" | El `GOOGLE_CLIENT_ID` quedó con `REEMPLAZAR...` | Pegá el Client ID real (ver "Client ID actual") |
| `Access blocked: ... has not completed verification` | Tu email no es "test user" | Agregalo en **OAuth consent screen → Test users** |
| `The origin is not authorized` / `unregistered_client` | Falta el origen | Agregá `https://pinistudio.vercel.app` en *Authorized JavaScript origins* (paso 4) |
| Se abre una ventana de Google al sincronizar | El token venció (dura 1 h) | Es normal: dale "Continuar" una vez y sigue |
| La pantalla de Google no abre | Estás abriendo el archivo con doble clic | Abrí la app desde `https://pinistudio.vercel.app` |
| No aparecen los recordatorios | Google Calendar no tiene notificaciones activadas | En Google Calendar → **⚙️ Configuración → Notificaciones**: activá "Recordatorios de escritorio" y "Correo electrónico" |
| Los eventos no aparecen en Google | Faltó sincronizar | Tocá **🔄 Sincronizar ahora** |
| "No se pudo cargar Google" | Sin internet | El resto de la app funciona igual; el export `.ics` sigue disponible |

---

## 🔒 Datos y privacidad

- **Cada usuario conecta SU cuenta de Google** y sus tokens quedan en su
  navegador (clave `pinistudio-google`), **nunca** en el archivo de respaldo
  `.json` que se comparte.
- El scope `calendar.app.created` **no da acceso a tus otros calendarios**:
  PiniStudio sólo ve el calendario "PiniStudio" que él mismo crea.
- El **Client ID es público** (no es una contraseña). Por eso puede ir en el
  código de la app. Lo que **nunca** se sube al sitio es el *client secret*,
  y **no hace falta** para esta integración.
- En **Ajustes → Desconectar** se revoca el acceso desde Google.

---

## 📝 Nota técnica

Flujo: **Google Identity Services → Token Client** (flujo implícito de OAuth 2.0
en el navegador). Se usa en vez del flujo de código con backend porque:

- no necesita servidor,
- no necesita *client secret*,
- y el scope no sensible evita la verificación de Google.

El token dura 1 hora y se renueva solo pidiéndoselo a Google de nuevo. Los
eventos se emparejan por `extendedProperties.private.pinistudioId` (el id
interno de PiniStudio), así el navegador puede borrar en Google lo que ya no
está en la app, sin dejar duplicados.
