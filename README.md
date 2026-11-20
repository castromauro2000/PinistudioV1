# 📚 PiniStudio

Aplicación web para llevar el control diario de un plan de estudio: **horas de uso**,
**materias**, **rachas**, calendario personalizable, fechas importantes (exámenes / días
libres / estudio con compañero), **metas** y recordatorios.

Funciona **sin instalar nada**, en cualquier navegador, y los datos de cada persona se
guardan **solo en su propio navegador** (`localStorage`).

---

## 🚀 Cómo usarla

### Opción 1 — Abrirla directo (la más simple)
Hacé doble clic en **`pinistudio.html`**. Se abre en el navegador y funciona.

> Si la abriste como `index.html` (con los archivos sueltos), también funciona, pero la
> versión `pinistudio.html` es la que conviene compartir.

### Opción 2 — Servidor local (para desarrollar)
```powershell
powershell -ExecutionPolicy Bypass -File .\servidor.ps1
```
Y abrís <http://localhost:8080>.

### Opción 3 — En la red local de tu casa (para probar con amigos)
```powershell
powershell -ExecutionPolicy Bypass -File .\servidor-lan.ps1
```
Te muestra un link tipo `http://192.168.1.16:8090`. Cualquiera que esté en **tu misma
Wi-Fi** puede abrirlo desde su celular o compu.

### Opción 4 — Publicarla en internet (link para compartir)

**✅ Ya está publicada en Vercel:**

```
https://pinistudio.vercel.app
```

Link **público** (nadie tiene que iniciar sesión), **permanente**, con **HTTPS**
(por eso se puede instalar en el celu y funcionan las notificaciones).
Cada persona tiene sus propios datos y puede descargar su copia con el botón ⬇️.

Para actualizarla en el futuro:
```powershell
Copy-Item index.html,styles.css,app.js,sw.js,manifest.json publicar\ -Force
Copy-Item icons\*.png publicar\icons\ -Force
powershell -ExecutionPolicy Bypass -File .\desplegar-vercel.ps1
```

Alternativas: **Netlify Drop** (netlify.com/drop) o el **túnel de Cloudflare**
(`iniciar-tunel.ps1`) para probar al toque sin cuenta.

---

## ✨ Funcionalidades

| Función | Cómo funciona |
|---|---|
| **📲 App para el celu** | Es una **PWA**: se instala desde el celu (ícono 📚, pantalla completa, **funciona sin internet**). En Android sale un botón 📲; en iPhone, "Compartir → Añadir a pantalla de inicio". Se puede generar un **APK** con PWABuilder. Ver `CELULAR.md`. |
| **📅 Google Calendar** | Cada fecha que guardás también se anota en tu **Google Calendar**, con recordatorio (popup + email). Así te avisa en la **compu** y en el celu, aunque la app esté cerrada. Conectás tu cuenta con un clic (⚙️ Ajustes → 📅 Google Calendar). Ver `GOOGLE-CALENDAR.md`. |
| **🍵 Poner el agua para el mate** | Botón que **pausa el cronómetro** (15 minutos por defecto, configurable hasta 180). Mientras está en pausa no se cuenta tiempo, con cuenta regresiva en el botón. Si cerrás la app, la pausa sigue vigente. |
| **🔔 Avisos con la app cerrada** | **Web Push**: un servidor te manda el aviso y el sistema operativo te lo muestra, tengas la app abierta o no. Ya está el `worker-push.js` listo para subir a Cloudflare (gratis). Alternativa sin servidor: **📅 Exportar al calendario** (`.ics`) y te avisa tu propia agenda. |
| **Historial mensual** 🗓️ | Todos los meses con: días estudiados, horas y en qué materias. Clic en un mes para verlo en el calendario. |
| **Materias** 📐 | Creás tus materias (nombre + emoji + color). Elegís la que estás estudiando en el selector de arriba y **el cronómetro le atribuye el tiempo a esa**. |
| **Horas por materia** | Cada día muestra el desglose: cuánto hiciste de cada materia. También podés **sumar tiempo a mano** (si estudiaste con la app cerrada) desde el modal de cada día. |
| **Meta diaria** 🎯 | Objetivo de **2 horas por día** (modificable: escribís el número de horas que quieras, en pasos de 30 min). Barra propia y aviso cuando la cumplís. |
| **Meta semanal** 🎯 | Elegís cuántas horas por semana querés estudiar (0, 5, 10, 15, 20, 25, 30, 40 o 60). Una barra te muestra el progreso. |
| **Gráfico por materia** 📊 | Barras con el color de cada materia: cuánto estudiaste de cada una. Período: este mes / esta semana / total. |
| **Celebración** 🎉 | Cuando cumplís una meta (diaria o semanal), **la app se ilumina de verde unos segundos** (con un "ding"). Cada meta se festeja una sola vez. |
| **Registro automático** | Al abrir la app, el día queda marcado como “estudiado” solo (o si la app estuvo abierta 5 min). Se puede desactivar en ⚙️ Ajustes. |
| **Rachas** 🔥 | Cuenta días consecutivos. La llama se apaga si la racha es 0. Muestra récord y últimos 14 días. |
| **Calendario** | Clic en cualquier día para marcarlo/desmarcarlo o agregar fechas. Cada día muestra **el ícono debajo del número**: 📚 examen, 🌊 día libre, 🧉 estudio con compañero, 📌 otro. |
| **Fines de semana 🌊** | Todos los sábados y domingos se marcan solos como **días libres** (se puede apagar en ⚙️ Ajustes). |
| **Descansos día por día** 🗓️ | En cada día podés **activar o desactivar el descanso con un clic**. Si marcás un domingo como *estudiado*, **el ícono 🌊 desaparece** y queda el verde de estudiado. Si lo desmarcás, el mar vuelve. |
| **Fechas importantes** | Exámenes 📚, días libres 🌊, **estudio con compañero 🧉** (guardás el nombre) y notas. Con “cuándo falta” (“En 2 días”). |
| **Recordatorios** | Aviso en pantalla + notificaciones de escritorio (con permiso del navegador) para fechas próximas. Configurable: 1/2/3 días o 1 semana antes. |
| **Aviso de compañero** 🧉 | Los estudios con compañero **avisan el día anterior**: *"🧉 Mañana tenés que estudiar con Nacho"*. Funciona con la app abierta, con la app cerrada (vía push) y también desde tu agenda (archivo `.ics`). |
| **Visualización** | 9 tarjetas de estadísticas, mapa de calor de 20 semanas, gráfico de días por mes. |
| **Tema claro/oscuro** | Botón 🌙 / ☀️ arriba a la derecha. |
| **Respaldo** | 💾 baja un `.json` con todos tus datos, 📂 lo restaura. |
| **Compartible** | ⬇️ descarga una copia de la app para pasarla a un amigo. |

---

## 📁 Archivos del proyecto

```
index.html          Estructura de la página (el "esqueleto")
styles.css          Todos los estilos (colores, disñño, animaciones, móvil)
app.js              Toda la lógica: datos, rachas, horas, materias, metas, avisos
manifest.json       Datos de la app instalable (PWA)
sw.js               Service Worker (notificaciones + modo offline)
icons/              Íconos de la app (192, 512, maskable, apple-touch)
worker-push.js      Servidor de avisos (Cloudflare Worker, gratis)
empaquetar.ps1      Une los 3 archivos en uno solo -> pinistudio.html
servidor.ps1        Servidor local para desarrollo (con log en servidor.log)
servidor-lan.ps1    Servidor para la red local de tu casa (Wi-Fi)
publicar/           Carpeta lista para subir a Netlify (con manifest e iconos)
prueba-movil.html   Muestra la app en tañano celular (390x844 y 360x640)
reparar.ps1         Utilidad de reparación (ver LECCIONES)
LECCIONES/          Apuntes para aprender (leemos el código juntos)
CELULAR.md          Guia para instalarla en el celu y generar un APK
PUBLICAR.md         Guia para compartirla con amigos
desplegar-vercel.ps1  Sube la app a Vercel con un comando (token en .vercel-token.txt)
iniciar-tunel.ps1    Levanta la app con un link publico temporal (sin cuenta)
GOOGLE-CALENDAR.md  Como conectar Google Calendar (avisos en la compu)
```

### Flujo de trabajo típico
```powershell
# 1. Editar index.html / styles.css / app.js
# 2. Ver los cambios en http://localhost:8080
# 3. Cuando la cosa ande bien, regenerar la versión portable:
powershell -ExecutionPolicy Bypass -File .\empaquetar.ps1
```

---

## 🧠 Cómo está construido (resumen)

- **HTML** = la estructura (cajas, botones, textos).
- **CSS** = la apariencia; usa *variables CSS* (`--acento`, `--fondo`…) para el tema claro/oscuro.
- **JS** = el comportamiento. Todo el estado vive en un objeto `estado`:

```js
estado = {
  dias:      { '2026-11-10': true },   // días estudiados
  descansos: { '2026-11-15': false },  // descanso manual (true) o desactivado (false)
  horas:     { '2026-11-10': 5400 },   // segundos de app abierta por día
  materias:  [ { id, nombre, emoji, color } ],
  registro:  { '2026-11-10': { 'mat1': 3600 } },   // segundos por materia y día
  materiaActiva: 'mat1',
  eventos:   [ { id, fecha, titulo, tipo, companero, notas } ],
  ajustes:   { autoRegistro, recordatorio, diasAviso, horaAviso, tema,
                finesDeSemana, metaHorasSemana, metaHorasDia, minutosMate },
  pausaHasta: null,                     // pausa del cronómetro ("el mate")
  celebraciones: {},                    // semanas/días ya festejados
  push: null,                           // suscripción de Web Push
  notificados: {}                       // evita avisos repetidos
}
```

`guardar()` lo escribe en `localStorage`; `render()` redibuja la pantalla; `cargar()` lo lee
al arrancar.

---

## 🔔 Avisos con la app cerrada (Web Push)

El push necesita **tres cosas**: la app, un Service Worker y un servidor que mande el
aviso. Todo está listo, falta una sola cosa: **subir el servidor**.

### Montar el servidor de avisos (10 min, gratis)
1. Entrá a <https://dash.cloudflare.com> → creá un **Worker**.
2. **Settings → Bindings** → creá un **KV Namespace** llamado `PINISTUDIO` y
   asignáselo al Worker.
3. **Settings → Triggers** → agregá un **Cron Trigger** con `0 8 * * *`
   (todos los días a las 8:00).
4. Pegá el código de `worker-push.js` en el editor del Worker.
5. Copiá la URL del Worker (te la muestra al publicarlo).
6. En la app: **⚙️ Ajustes → Servidor de avisos** → pegá la URL →
   **🔔 Activar push** → **📡 Registrar en el servidor**.

Listo: a partir de ahí te avisa de los exámenes aunque tengas la app cerrada
o la compu en modo ahorro.

### La opción simple (sin servidor)
**📅 Exportar al calendario** genera un archivo `.ics` con todas tus fechas y
alarmas. Lo abrís con Google Calendar, Outlook o el calendario de Windows, y
**tu agenda te avisa** aunque la app esté cerrada.

> Las notificaciones push solo funcionan servidas por `http(s)` o publicadas en
> internet. Si abrís el archivo con doble clic (`file://`), usá la opción del `.ics`.

---

## 💾 Tus datos

Se guardan en el navegador de **esta** computadora, en el espacio del sitio.
- Si borrás los datos del navegador, se pierden → usá **💾 Descargar mis datos** de vez en cuando.
- No hay servidor ni base de datos: nadie más ve tu información.
