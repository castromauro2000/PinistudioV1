# Lección 5 — Metas configurables y gráficos

Dos features nuevas: la **meta diaria** (2 h por defecto, cambiable) y el **gráfico de
horas por materia**.

---

## 1. Una meta configurable por el usuario

La meta diaria vive en los ajustes:

```js
ajustes: {
  metaHorasSemana: 15,   // objetivo semanal
  metaHorasDia: 2        // objetivo diario (el usuario lo cambia)
}
```

Y en la pantalla hay un `<input type="number">` para editarla:

```html
<input type="number" id="inpMetaDia" min="0" max="24" step="0.5" value="2">
```

- `min` / `max`: límites del control.
- `step="0.5"`: los "saltos" de las flechitas del input (media hora).
- El valor se guarda en los ajustes, así cada persona tiene la suya.

Al cambiarlo lo saneamos (nunca te guíes por lo que escribe el usuario):

```js
let valor = Number(e.target.value);
if (!Number.isFinite(valor) || valor < 0) valor = 0;
if (valor > 24) valor = 24;
valor = Math.round(valor * 2) / 2;   // pasos de media hora
```

`Number.isFinite` + `Number(...)` es la forma segura de convertir texto a número:
`Number('abc')` da `NaN`, y `NaN` rompe cualquier comparación.

## 2. Dos metas, una sola función de celebración

La meta diaria y la semanal se revisan juntas:

```js
function revisarMeta() {
  const hoy = hoyISO();

  const d = progresoDia();
  if (d.cumplida) {
    const clave = 'dia:' + hoy;              // <- clave distinta por día
    if (!estado.celebraciones[clave]) {
      estado.celebraciones[clave] = true;
      guardar();
      celebrar(d, '¡Meta diaria cumplida!');
    }
  }

  const s = progresoMeta();
  if (s.cumplida) {
    const clave = inicioSemana(hoy);         // <- clave distinta por semana
    if (!estado.celebraciones[clave]) {
      estado.celebraciones[clave] = true;
      guardar();
      celebrar(s, '¡Meta semanal cumplida!');
    }
  }
}
```

**El truco del prefijo:** como las claves viven en el mismo diccionario
`estado.celebraciones`, usamos prefijos distintos (`'dia:2026-11-10'` y
`'2026-11-09'`) para que una no pise a la otra. Es el mismo concepto que las
"claves compuestas" en las bases de datos.

## 3. El gráfico de barras horizontales

Cada materia es una fila: emoji, nombre, barra y horas.

```js
const max = Math.max(1, ...datos.map(d => d.horas));

cont.innerHTML = datos.map(d => `
  <div class="fila-grafico" style="--color-mat: ${d.m.color}">
    <span class="emoji">${d.m.emoji}</span>
    <span class="nombre">${escapar(d.m.nombre)}</span>
    <div class="barra-grafico"><i style="width:${Math.round((d.horas / max) * 100)}%"></i></div>
    <strong>${formatoHoras(d.horas)}</strong>
  </div>`).join('');
```

Tres detalles importantes:

1. **La barra es relativa a la máxima**, no a la meta: la materia con más horas
   llena el 100% y las demás se comparan con ella.
2. **`Math.max(1, ...)`** evita el error de dividir por cero si no hay horas
   (`Math.max` con `1` garantiza que nunca sea 0).
3. **El color viaja en una variable CSS inline** (`--color-mat`), y el CSS la usa:

```css
.barra-grafico i { background: var(--color-mat, var(--acento)); }
```

Así el HTML no necesita saber de colores: solo pasa el dato.

## 4. Elegir el período

```js
function horasMateriaRango(materiaId, rango) {
  if (rango === 'total') { ... }

  const dias = [];
  if (rango === 'semana') {
    const lunes = desdeISO(inicioSemana(hoy));
    for (let i = 0; i < 7; i++) dias.push(aISO(sumarDias(lunes, i)));
  } else {
    const diasDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= diasDelMes; i++) dias.push(aISO(new Date(d.getFullYear(), d.getMonth(), i)));
  }
  return dias.reduce((a, iso) => a + horasDeMateria(iso, materiaId), 0);
}
```

La idea: **primero armás la lista de días del período, después los sumás**.
Es más fácil de extender que Meter tres `if` con la suma adentro.

## 5. La barra de progreso en CSS

```css
.barra-meta > div {
  height: 100%;
  width: 0;                                  /* el JS pone el ancho real */
  background: var(--acento-2);
  border-radius: 8px;
  transition: width .5s ease;                /* la barra "anima" al cambiar */
}
.barra-meta > div.completa {
  background: linear-gradient(90deg, var(--acento), #a3e635);
}
```

- `width: 0` es el estado inicial; el JavaScript lo cambia con `style.width`.
- `transition` hace que el crecimiento sea suave en vez de un salto.
- La clase `.completa` cambia el color cuando se llega al objetivo.

---

## 📝 Para practicar

1. **Meta por materia**: que cada materia tenga su propia meta (no solo la global).
2. **Meta mensual**: objetivo de horas por mes, con su barra.
3. **Racha por materia**: cuántos días seguidos estudiaste cada una.
4. **Comparar períodos**: que el gráfico muestre dos barras por materia (mes actual vs. anterior).
5. **Meta con días libres descontados**: si la meta es de 10 h y tenés 2 días libres, que la app lo tenga en cuenta.
