# Lección 1 — Los cimientos que usa la app

Estos apuntes explican **por qué** el código de `app.js` está escrito como está.
Después los vamos a leer juntos, línea por línea.

---

## 1. Dónde viven los datos

El navegador guarda información en un `localStorage`: un cuaderno con texto que
solo pertenece a tu navegador.

```js
localStorage.setItem('plan-estudio-v1', '{"dias":{"2026-11-10":true}}');
localStorage.getItem('plan-estudio-v1');   // devuelve el string
```

Ojo: `localStorage` **solo guarda texto**. Por eso guardamos un JSON y no un objeto:

```js
localStorage.setItem('clave', JSON.stringify(estado));   // objeto -> texto
JSON.parse(localStorage.getItem('clave'));                // texto -> objeto
```

## 2. Un solo objeto de estado

Toda la app gira alrededor de `estado`. Los datos no viven sueltos en variables
sino en **una sola fuente de verdad**:

```js
const estado = {
  dias: {},       // un objeto para consultar rápido: estado.dias['2026-11-10']
  eventos: [],    // una lista, porque el orden importa
  ajustes: {}
};
```

**¿Por qué un objeto y no una lista para los días?**
Porque cada vez que renderizamos el calendario preguntamos “¿este día se estudió?”.
Con un objeto la respuesta es instantánea: `estado.dias[iso]`.
Con una lista habría que recorrerla entera (y son cientos de días).

## 3. Fechas: la trampa clásica

`new Date().toISOString()` **no** sirve para obtener “el día de hoy”:

```js
new Date().toISOString()   // "2026-11-10T03:00:00.000Z"  <- en UTC, puede ser otro día!
```

En Argentina (UTC-3), a las 22:00 del lunes el UTC ya es martes. Por eso la app
usa su propia función:

```js
function aISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;      // "2026-11-10"
}
```

Y para restar días **sin que se corran los meses**, usa `setDate` sobre una copia:

```js
function sumarDias(d, n) {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copia.setDate(copia.getDate() + n);
  return copia;
}
```

> **Trampa relacionada:** `new Date(2026, 1, 30)` = 3 de marzo, porque febrero
> tiene 28 días. Por eso la app nunca inventa fechas: siempre parte de un día
> existente y suma.

## 4. La racha, en pseudocódigo

```
racha = 0
hoy = hoy
SI hoy no está marcado:
    hoy = ayer
    SI ayer tampoco está marcado: devolver 0
MIENTRAS hoy esté marcado:
    racha = racha + 1
    hoy = ayer
```

El detalle importante: **si hoy todavía no estudiaste, la racha no se rompe**,
porque el día no terminó. Recién cuando pasa mañana sin estudiar, cae.

## 5. Dibujar: el patrón `render()`

La app no “vive” en el HTML: el HTML es solo el esqueleto. Todo se dibuja con JS:

```js
function render() {
  renderTema();
  renderCabecera();
  renderAvisos();
  renderStats();
  renderCalendario();
  // ...
}
```

Y cada `render()` **vuelca el HTML y lo reconstruye**:

```js
document.getElementById('stats').innerHTML = stats.map(...).join('');
```

`map` transforma cada elemento en un texto HTML, y `join('')` los pega. Es el
patrón clásico para pintar listas.

## 6. Escuchar eventos (delegación)

Los botones del calendario se crean dinámicamente, así que no podemos ponerles
un `addEventListener` a cada uno. Se usa **delegación de eventos**:

```js
document.getElementById('calendario').addEventListener('click', e => {
  const celda = e.target.closest('.dia');   // el ancestro más cercano que sea .dia
  if (celda) abrirDia(celda.dataset.fecha);
});
```

`e.target` es el elemento exacto que hiciste clic; `.closest()` sube hasta
encontrar al padre con la clase que buscamos.

## 7. Sanear texto

Si el usuario escribe `<b>título</b>` y lo metemos directo con `innerHTML`, el
navegador lo interpreta como HTML. Por eso la app usa `escapar()`:

```js
function escapar(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
```

---

## 📝 Para practicar

1. Agregá un botón “Marcar el mes entero como estudiado” en el panel de rachas.
   (Pista: ya existe `sumarDias()` y `aISO()`.)
2. Cambiá el color de la llama cuando la racha supera los 7 días.
3. Agregá al gráfico de barras una línea con el promedio de días por mes.
4. Mostrar en el calendario los días que son “hace 7 días” con un borde especial.
