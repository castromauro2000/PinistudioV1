# Lección 6 — Pausas, Service Workers y Web Push

Las tres features más "adultas" de la app: una pausa del cronómetro, notificaciones
del sistema operativo y el historial.

---

## 1. "Poner el agua para el mate" (pausa del cronómetro)

### La idea: guardar el *fin* de la pausa, no el tiempo restante

```js
estado.pausaHasta = Date.now() + 15 * 60000;   // un timestamp
```

Si guardáramos "quedan 15 minutos" (un número), al cerrar la app y volver a abrirla
al día siguiente, la pausa seguiría "pendiente" o se perdería. Guardando **el momento
en que termina**, todo se resuelve solo:

```js
function enPausa() {
  return !!estado.pausaHasta && Date.now() < estado.pausaHasta;
}
```

- Si la app está abierta y llega la hora → la pausa se termina sola.
- Si la app estaba cerrada y la abrís dentro del rango → sigue pausada.
- Si la abrís después → ya pasó, el cronómetro sigue normal.

### El cronómetro respeta la pausa

```js
function acumularHoras() {
  const ahora = Date.now();
  const segundos = (ahora - reloj.inicioSesion) / 1000;
  reloj.inicioSesion = ahora;      // reiniciamos SIEMPRE

  if (enPausa()) return;           // pero no contamos
  if (segundos <= 0) return;
  ...
}
```

Ojo con el orden: primero reiniciamos el reloj y después decidimos si contamos.
Si hicieras al revés, el tiempo de la pausa se sumaría después.

### La cuenta regresiva

```js
function iniciarCuentaRegresiva() {
  if (reloj.cuenta) return;              // no crear dos
  reloj.cuenta = setInterval(() => {
    if (!enPausa()) {
      clearInterval(reloj.cuenta);
      reloj.cuenta = null;
      render();
      return;
    }
    pintarMate();
  }, 1000);
}
```

`if (reloj.cuenta) return` evita duplicar el intervalo si llamás a la función dos veces
(clic rápido, recargar, etc.).

---

## 2. Web Push: notificaciones con la app cerrada

Acá hay **tres piezas** que tienen que estar coordinadas:

```
┌──────────────┐   se registra    ┌──────────────┐   manda push   ┌───────────┐
│  Tu app      │ ───────────────► │  Servidor    │ ─────────────► │  Tu       │
│  (navegador) │  (suscripción)   │  (worker)    │                │  celular/ │
└──────────────┘                  └──────────────┘                │  compu   │
       ▲                                                                │
       └────────────────── el Service Worker muestra el aviso ◄────────┘
```

### 1. Las claves VAPID

VAPID es el sistema de "identidad" de Web Push: el navegador (servidor de push del
navegador, como los de Google o Mozilla) tiene que saber quién manda el aviso.

- **Clave pública**: va en la app. Se genera con ECDSA P-256.
- **Clave privada**: va **solo** en el servidor. Si se filtra, cualquiera puede
  mandar notificaciones a tu cuenta.

En la app:

```js
const VAPID_PUBLIC_KEY = 'BML...';   // base64url

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const salida = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) salida[i] = raw.charCodeAt(i);
  return salida;
}
```

> `base64url` es base64 pero con `-` en vez de `+` y `_` en vez de `/`.
> Hay que "traducirlo" antes de decodificar.

### 2. El Service Worker (`sw.js`)

Es un **script que corre aparte de la página**, y es el único que puede mostrar
notificaciones del sistema operativo:

```js
self.addEventListener('push', event => {
  let datos = { title: 'PiniStudio', body: 'Tenés un aviso' };
  try { if (event.data) datos = { ...datos, ...event.data.json() }; } catch (e) {}

  event.waitUntil(self.registration.showNotification(datos.title, {
    body: datos.body,
    icon: '📚',
    tag: datos.tag || 'pinistudio',
    requireInteraction: true,     // que no se vaya sola
    data: { url: './' }
  }));
});
```

Y al tocar la notificación, abrir la app:

```js
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      for (const c of lista) if ('focus' in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
```

**Reglas del Service Worker:**
- Solo funciona en **https** o **localhost** (nunca en `file://`).
- Se registra con `navigator.serviceWorker.register('sw.js')`.
- Los eventos son `install`, `activate`, `push`, `notificationclick`, `message`.

### 3. La suscripción

```js
let sub = await reg.pushManager.getSubscription();
if (!sub) {
  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,     // obligatorio: cada push debe mostrar algo
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });
}
estado.push = { sub: sub.toJSON(), activo: true };
```

`userVisibleOnly: true` es **obligatorio** en Chrome: no podés mandar push
"invisibles" (para|ga de avisos publicitarios).

### 4. El servidor (`worker-push.js`)

Es un **Cloudflare Worker** (gratis) que:
- guarda la suscripción en una KV,
- tiene un **Cron Trigger** diario (`0 8 * * *`),
- cada día busca las fechas próximas y manda un push a cada suscriptor.

```js
await webpush.sendNotification(sub, {
  title: 'PiniStudio',
  body: `📚 ${e.titulo} — ${cuando}`,
  icon: '📚',
  tag: 'evento-' + e.fecha
});
```

### La alternativa sin servidor: el archivo `.ics`

Si no querés montar un servidor, podés **exportar tus fechas al calendario del
sistema** (Google Calendar, Outlook, el de Windows):

```
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:x1@pinistudio
DTSTAMP:20261110T120000Z
DTSTART;VALUE=DATE:20261113
DTEND;VALUE=DATE:20261114
SUMMARY:Examen de Historia
BEGIN:VALARM
TRIGGER:-P1D          <-- un día antes
ACTION:DISPLAY
DESCRIPTION:Examen de Historia
END:VALARM
END:VEVENT
END:VCALENDAR
```

- `DTSTART;VALUE=DATE` = evento de **todo el día** (sin hora).
- `DTEND` es **exclusivo**: si empieza el 13, `DTEND` es el 14.
- `TRIGGER:-P1D` = alarma 1 día antes; `-PT2H` = 2 horas antes.
- Las líneas se separan con `\r\n` (salto de línea de Windows).

Esto te da avisos **reales aunque la app esté cerrada**, porque los da tu
calendario, no la app.

---

## 3. El historial mensual

Se agrupa todo por prefijo de mes (`"2026-11"`):

```js
const claveMes = iso => iso.slice(0, 7);
```

Y seaccumulan dos cosas: los días estudiados y las horas (sumando el `registro`).

Clic en un mes → se cambia `mesVista` y el calendario principal se actualiza.
Es una función chiquita pero muy práctica:

```js
document.getElementById('historial').addEventListener('click', e => {
  const fila = e.target.closest('[data-mes]');
  if (!fila) return;
  const [y, m] = fila.dataset.mes.split('-').map(Number);
  mesVista = new Date(y, m - 1, 1);
  renderCalendario();
});
```

> `closest()` es clave: el click puede caer en cualquier hijo de la fila
> (el texto, la barra, el emoji) y `closest` sube hasta encontrar el `data-mes`.

---

## 📝 Para practicar

1. **Desbloquear la app por tiempo**: que la app "espere" 3 segundos al abrir.
2. **Recordatorio de la pausa**: que avise cuando va a terminar el mate.
3. **Historial anual**: un panel con los 12 meses del año, tipo gráfico de barras.
4. **Meta por mes**: que el objetivo mensual también se pueda elegir.
5. **Worker propio**: probá con un Cloudflare Worker y mandá un push real.
