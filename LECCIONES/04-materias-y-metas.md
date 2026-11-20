# Lección 4 — Materias, horas por materia y metas semanales

Esta es la parte con "modelo de datos de verdad": las horas ya no son un número
suelto, sino que se reparten entre **materias** y se comparan contra un **objetivo**.

---

## 1. La estructura de los datos

```js
estado = {
  dias:      { '2026-11-10': true },        // días estudiados
  horas:     { '2026-11-10': 28800 },       // total de segundos del día
  materias:  [ { id, nombre, emoji, color } ],
  registro:  { '2026-11-10': { 'mat1': 7200, 'mat2': 3600 } },
  materiaActiva: 'mat1',
  ajustes:   { ..., metaHorasSemana: 15 },
  celebraciones: { '2026-11-09': true }     // semanas ya festejadas
}
```

La clave está en `registro`: es un **diccionario de diccionarios**.

```
fecha ──► { idMateria: segundos }
```

- **¿Por qué un diccionario y no una lista?** Para preguntar "¿cuánto hice de
  Matemática hoy?" en O(1): `registro[fecha]['mat1']`.
- `horas` es el **total del día**: se mantiene en paralelo para no tener que
  sumar siempre. Es una "caché" que evitamos recalcular en cada render.

## 2. La materia activa: el reloj reparte el tiempo

La idea clave: **el cronómetro no sabe de materias**. Lo que hace es preguntarle
al estado cuál es la materia activa y_ATTRIBUTE_ el tiempo ahí:

```js
function acumularHoras() {
  const segundos = (ahora - reloj.inicioSesion) / 1000;
  const materia = materiaActiva();
  const materiaId = materia ? materia.id : 'general';

  if (!estado.registro[hoy]) estado.registro[hoy] = {};
  estado.registro[hoy][materiaId] = (estado.registro[hoy][materiaId] || 0) + segundos;
  estado.horas[hoy] = (estado.horas[hoy] || 0) + segundos;
}
```

Cambiar de materia en el selector de arriba es cambiar **a dónde va el tiempo**.
No hay que "asignar" nada a mano.

## 3. Sumar tiempo a mano

Estudiar no siempre es "tener la app abierta". Por eso, en el modal de cada día
hay un formulario para sumar tiempo a una materia:

```js
function sumarTiempo(iso, materiaId, segundos) {
  if (!estado.registro[iso]) estado.registro[iso] = {};
  estado.registro[iso][materiaId] = (estado.registro[iso][materiaId] || 0) + segundos;
  estado.horas[iso] = (estado.horas[iso] || 0) + segundos;
}
```

## 4. La semana

Para las metas necesitamos agrupar por semana. La clave de la semana es **el lunes
de esa semana**:

```js
function inicioSemana(iso) {
  const d = desdeISO(iso);
  const dow = (d.getDay() + 6) % 7;   // 0 = lunes
  return aISO(sumarDias(d, -dow));
}
```

Y las horas de la semana son la suma de los 7 días:

```js
function horasSemana(iso) {
  const lunes = desdeISO(inicioSemana(iso));
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += horasTotalesDe(aISO(sumarDias(lunes, i)));
  }
  return total;
}
```

## 5. La meta y el progreso

```js
function progresoMeta() {
  const meta = metaSemana();              // en HORAS (lo que elige el usuario)
  const metaSegundos = meta * 3600;       // en segundos, para comparar
  const horas = horasSemana(hoyISO());     // en segundos
  return {
    meta,
    horas,
    pct: metaSegundos > 0 ? Math.min(100, Math.round((horas / metaSegundos) * 100)) : 0,
    cumplida: metaSegundos > 0 && horas >= metaSegundos
  };
}
```

> **La trampa de las unidades.** La meta la elige el usuario en *horas*, pero el
> tiempo se guarda en *segundos*. Si comparás `horas >= meta` estás comparando
> segundos contra horas: con 15 minutos de estudio y una meta de 5, la app
> diría "¡cumplida!" (porque 600 > 5). **Siempre convertí a la misma unidad
> antes de comparar.** Este bug existió de verdad en la app y lo cazamos probando.

## 6. La celebración (una vez por semana)

```js
function revisarMeta() {
  const p = progresoMeta();
  if (!p.cumplida) return;
  const clave = inicioSemana(hoyISO());
  if (estado.celebraciones[clave]) return;   // ya la festejamos
  estado.celebraciones[clave] = true;
  guardar();
  celebrar(p);
}
```

El `estado.celebraciones` guarda **qué semanas ya se festejaron**, así el brillo
verde no se repite cada 10 segundos.

## 7. El brillo verde con CSS

```css
body.celebracion::after {
  content: '';
  position: fixed; inset: 0; z-index: 90; pointer-events: none;
  background: radial-gradient(circle at 50% 35%,
              rgba(34,197,94,.60), rgba(16,185,129,.28) 42%, rgba(34,197,94,0) 72%);
  animation: destelloVerde 5s ease-out forwards;
}
@keyframes destelloVerde {
  0% { opacity: 0; } 10% { opacity: 1; } 65% { opacity: .5; } 100% { opacity: 0; }
}
```

- `::after` crea un **pseudo-elemento**: no existe en el HTML, el navegador lo inventa.
- `position: fixed` lo deja pegado a la pantalla aunque scrollees.
- `pointer-events: none` para que **no robe los clics** (si no, no podés tocar nada).
- `forwards` deja la animación en su estado final (opacidad 0 → invisible).
- Y en JS se saca la clase a los 5 segundos:

```js
setTimeout(() => document.body.classList.remove('celebracion'), 5000);
```

## 8. El "ding" con Web Audio

```js
const osc = ctx.createOscillator();     // el "instrumento"
const vol = ctx.createGain();           // el volumen
osc.frequency.value = 523.25;           // do
vol.gain.setValueAtTime(0.0001, t);     // arranca en silencio
vol.gain.exponentialRampToValueAtTime(0.25, t + 0.03);   // sube
vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); // baja
osc.connect(vol); vol.connect(ctx.destination);
osc.start(t); osc.stop(t + 0.4);
```

`exponentialRampToValueAtTime` **no puede llegar a 0** (por eso arrancamos en
`0.0001`): es una regla de la exponencial.

---

## 📝 Para practicar

1. **Meta por materia**: que cada materia tenga su propia meta semanal.
2. **Meta diaria**: además de la semanal, un objetivo por día.
3. **Histórico de materias**: un gráfico de barras con las horas por materia del mes.
4. **Aleatorio**: que la app elija una materia sugerida para el día.
5. **Exportar a CSV** las horas por materia, para pegarlas en una planilla.
