# Lección 3 — Dibujar el calendario mes a mes

El calendario es la parte más "visual" de la app, pero es solo aritmética con fechas.
Acá va el desglose.

---

## 1. Armar la grilla de 6 semanas

```js
const primero = new Date(ano, mes, 1);
const desplazamiento = (primer.getDay() + 6) % 7;   // lunes = 0
const diasDelMes = new Date(ano, mes + 1, 0).getDate();
```

- `new Date(ano, mes + 1, 0)` = **el último día del mes**: el día 0 del mes
  siguiente es el último del mes anterior. Es un truco clásico.
- `(getDay() + 6) % 7` convierte el domingo-first de JavaScript (0 = domingo)
  en lunes-first (0 = lunes), que es como lo mostramos.
- Dibujamos siempre **42 casillas** (6 semanas × 7 días) para que el calendario
  no cambie de alto al navegar de mes. Las que sobran se muestran apagadas.

## 2. El offset: `getDay()` y el domingo

JavaScript numera los días así:

| getDay() | Día |
|---|---|
| 0 | domingo |
| 1 | lunes |
| ... | ... |
| 6 | sábado |

Como en Argentina las semanas empiezan el lunes, hay que "correr" los números:

```js
function diaSemanaLunesPrimero(d) {
  return (d.getDay() + 6) % 7;   // lunes=0 ... domingo=6
}
```

## 3. Cada día, su información

Todo pasa por una función que junta **los eventos que vos cargaste** con
**las reglas automáticas** (los fines de semana):

```js
function infoDelDia(iso) {
  const evs = eventosDe(iso);
  const tipos = evs.map(e => e.tipo);

  if (ajustes.finesDeSemana && esFinDeSemana(iso) && !tipos.includes('libre')) {
    tipos.push('libre');           // el fin de semana es día libre
  }

  const emojis = [];                // 📚 🌊 🧉 📌 sin repetir
  for (const e of evs) { ... }
  if (ajustes.finesDeSemana && esFinDeSemana(iso) && !emojis.includes('🌊')) {
    emojis.push('🌊');
  }

  // el color de fondo: manda el tipo más importante
  let clase = '';
  if (tipos.includes('examen')) clase = 'con-examen';
  else if (tipos.includes('libre')) clase = 'con-libre';
  ...
  return { evs, tipos, emojis, clase };
}
```

**Ojo con los `if` que se pisan:** el 21 de noviembre fue sábado *y* tenía
examen. El ícono muestra los dos (📚🌊) pero el color de fondo es el del
examen, porque en la cadena de `if` el examen va primero.

## 4. Detectar el fin de semana

```js
function esFinDeSemana(iso) {
  const dia = desdeISO(iso).getDay();
  return dia === 0 || dia === 6;
}
```

`getDay()` devuelve 0 para domingo y 6 para sábado. Con un solo `getDay()`
resolvés los dos casos.

## 5. Pintar el HTML

```js
html += `<div class="${clases}" data-fecha="${iso}">
          <span class="num-dia">${fecha.getDate()}</span>
          <span class="iconos-dia">${iconos}</span>
          ${etiquetaHoras}
        </div>`;
```

El `data-fecha` es el "gancho" que después usamos para detectar el clic
(ver Lección 1, delegación de eventos): el HTML guarda los datos y el JS
los lee con `dataset.fecha`.

---

## 4.5 Días de descanso: tres estados y una regla que pisa a todos

Cada día puede estar en tres estados de descanso:

| Estado | Guardado | Cuándo |
|---|---|---|
| **Automático** | no está en `estado.descansos` | Es sábado/domingo y el toggle global está activo |
| **Forzado** | `descansos[iso] = true` | Lo marcaste a mano (aunque sea un martes) |
| **Desactivado** | `descansos[iso] = false` | Lo sacaste a mano (aunque sea un domingo) |

```js
function esDiaDeDescanso(iso) {
  const manual = estado.descansos[iso];
  if (manual === false) return false;    // lo desactivaste a mano
  if (manual === true) return true;      // lo activaste a mano
  return descansoAutomatico(iso);        // automático (fin de semana)
}
```

Un diccionario con `true`, `false` y "no está" (undefined) cubre los tres casos
sin inventar campos extra.

### La regla que pisa a todas

> **Si el día está marcado como estudiado, no se muestra el ícono de descanso.**

```js
const descanso = esDiaDeDescanso(iso) && !estado.dias[iso];
```

Por eso el orden de las condiciones importa: primero se pregunta por el descanso
y después se filtra con "no lo estudiaste". Si hubiéramos hecho al revés, el
domingo que estudiaste seguiría mostrando el 🌊.

### Bonus: el `undefined` como valor válido

En JavaScript, `estado.descansos[iso]` devuelve `undefined` si la clave no existe.
Eso es distinto de `false`, y los dos casos significan cosas opuestas:

```js
if (manual === false) ...   // desactivado a mano
if (manual === true) ...    // activado a mano
// undefined -> automático
```

Por eso comparamos con `===` y no con `if (!manual)`: `!undefined` es `true` y
`!false` también, así que esa forma NO distinguiría los dos casos.

---

## 📝 Para practicar

1. Mostrar el nombre del mes en el título con mayúscula ("Noviembre 2026").
2. Poner los íconos más grandes solo en los días que tienen algo.
3. Marcar en gris los días que ya pasaron y no se estudiaron.
4. Mostrar un emoji 🌙 en las noches y ☀️ en las mañanas de cada día.
