# Lección 2 — Medir el tiempo (el cronómetro de horas)

La app cuenta **cuánto tiempo estuvo abierta**, incluso si la dejás en segundo plano.
Acá está el truco completo.

---

## 1. El problema

Si guardamos el tiempo "cada 10 segundos sumo 10", pasa algo raro: si la compu se
apaga o cerrás la pestaña, se pierden los segundos que faltaban.

La solución: **guardar marcas de tiempo, no diferencias acumuladas**.

```js
const reloj = {
  inicioSesion: Date.now()   // cuándo arrancó esta sesión
};

function acumularHoras() {
  const ahora = Date.now();
  const segundos = (ahora - reloj.inicioSesion) / 1000;  // cuánto pasó
  if (segundos <= 0) return;
  reloj.inicioSesion = ahora;                            // reiniciamos el reloj

  const hoy = hoyISO();
  estado.horas[hoy] = (estado.horas[hoy] || 0) + segundos;
  guardar();
}
```

Regla de oro: **guardar siempre "cuándo", no "cuánto acumulé"**.
Si el navegador se cierra, el último `guardar()` ya tenía el dato correcto
de todo lo que se había contado hasta ese momento.

## 2. Por qué no cuenta el tiempo con la app cerrada

Cuando abrís la app el martes, `inicioSesion` es el martes. Cuando la abrís de
nuevo el jueves, `estado.horas` sigue teniendo lo del martes y **no** le sumamos
la diferencia entre el martes y el jueves. Lo único que se cuenta es el tiempo
que la app estuvo realmente abierta.

Si quisiéramos contar también el tiempo con la app cerrada, tendríamos que guardar
la última marca de tiempo y sumar la diferencia al abrir — pero eso contaría
incluso las noches, cuando la compu estaba apagada. No es lo que queremos.

## 3. El `setInterval`

```js
reloj.tick = setInterval(() => {
  acumularHoras();
  pintarReloj();
}, 10000);   // cada 10 segundos
```

- `setInterval(fn, ms)` → repite `fn` cada `ms` milisegundos.
- Devuelve un "id" que sirve para cancelarlo: `clearInterval(reloj.tick)`.

Cada 10 segundos: sumamos el tiempo, lo guardamos en `localStorage` y refrescamos
el reloj de la pantalla.

## 4. Guardar justo antes de salir

```js
window.addEventListener('pagehide', () => acumularHoras());

document.addEventListener('visibilitychange', () => {
  if (document.hidden) acumularHoras();
});
```

- **`pagehide`** se dispara al cerrar la pestaña, recargar o navegar a otro sitio.
- **`visibilitychange`** se dispara al cambiar de pestaña o al minimizar la ventana.
  Por eso el tiempo sigue contando **en segundo plano**: la pestaña sigue "viva"
  aunque no la estés mirando.

> Ojo: si la pestaña queda en segundo plano mucho tiempo, algunos navegadores
> **reducen la frecuencia** de los timers para ahorrar batería. Por eso el
> cálculo es siempre `ahora - inicioSesion` y no "sumar 10 cada 10 segundos":
> si el navegador se olvidó de avisarnos dos veces, el tiempo missing se
> recupera en el próximo tick.

## 5. Formatear el tiempo para mostrarlo

```js
function formatoHoras(segundos) {
  const total = Math.floor(segundos);
  if (total < 60) return `${total}s`;              // 12s
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;  // 1h 05m
  return `${m}m`;
}
```

`Math.floor` redondea hacia abajo (no existe el medio minuto 30,5).
`padStart(2, '0')` pone un cero adelante: `5` → `05`.

## 6. El bonus: marcar el día solo por uso

```js
if (estado.ajustes.autoRegistro && estado.horas[hoy] >= 300 && !estado.dias[hoy]) {
  estado.dias[hoy] = true;
  toast('¡Día registrado automáticamente por uso de la app!');
}
```

`300` segundos = 5 minutos. Si la app estuvo abierta 5 minutos, se considera
que estudiaste. Y el `!estado.dias[hoy]` evita avisarte de nuevo cada 10 segundos.

---

## 📝 Para practicar

1. Agregá un botón en ⚙️ Ajustes para elegir en cuántos minutos se marca el día
   automáticamente (hoy está fijo en 5).
2. Mostrar el reloj en formato "12:34:56" (horas:minutos:segundos) en vez de "34m".
3. Agregar un gráfico de horas por semana, al lado del de días por mes.
4. Avisar cuando se llegue a las 2 horas de uso en el día.
