/* =============================================================
   PINISTUDIO — app.js
   ------------------------------------------------------------
   Todo el estado vive en un objeto `estado` que se guarda en
   localStorage (clave "pinistudio-v1"). Así cada persona que
   abra la app tiene sus propios datos, en su propio navegador.
   ============================================================= */

'use strict';

const CLAVE = 'pinistudio-v1';
// Claves de versiones anteriores: si el usuario ya tenía datos, los migramos.
const CLAVES_OLD = ['alexstudio-v1', 'plan-estudio-v1'];

const TIPOS = {
  examen:    { label: 'Examen', ico: '📚' },
  libre:     { label: 'Día libre', ico: '🌊' },
  companero: { label: 'Con compañero', ico: '🧉' },
  otro:      { label: 'Otro', ico: '📌' }
};

/* ------------------------------------------------------------
   1) Estado
   ------------------------------------------------------------ */

function estadoPorDefecto() {
  return {
    dias: {},        // { '2026-11-10': true }  -> días estudiados
    descansos: {},   // { '2026-11-15': true }  -> descanso manual (true) o desactivado (false)
    horas: {},       // { '2026-11-10': 5400 }  -> segundos de uso por día
    materias: [],    // [ { id, nombre, emoji, color } ]
    registro: {},    // { '2026-11-10': { 'mat1': 3600 } } -> segundos por materia y día
    materiaActiva: null,
    eventos: [],     // { id, fecha, titulo, tipo, companero, notas }
    ajustes: {
      autoRegistro: true,
      recordatorio: true,
      diasAviso: 3,
      horaAviso: '18:00',
      tema: 'oscuro',
      finesDeSemana: true,   // sábados y domingos se marcan como día libre
      metaHorasSemana: 15,    // objetivo de horas por semana
      metaHorasDia: 2,        // objetivo de horas por día
      minutosMate: 15,        // duración de la pausa "poné el agua para el mate"
      servidorNotif: '',      // URL del worker que manda los push
      googleSync: true,       // sincronizar las fechas con Google Calendar
      googleConectado: false  // hay una cuenta de Google conectada
    },
    pausaHasta: null,         // timestamp (ms) hasta el que está pausado el cronómetro
    celebraciones: {},        // { '2026-11-09': true } -> semanas ya celebradas
    push: null,               // { sub: {...}, activo: true }
    notificados: {}  // { 'idEvento|2026-11-10': true } -> evita avisos repetidos
  };
}

function cargar() {
  const base = estadoPorDefecto();
  try {
    // Migración: si veníamos de una versión anterior, conservamos los datos.
    if (!localStorage.getItem(CLAVE)) {
      for (const vieja of CLAVES_OLD) {
        if (localStorage.getItem(vieja)) {
          localStorage.setItem(CLAVE, localStorage.getItem(vieja));
          break;
        }
      }
    }
    // Una vez que tenemos la versión nueva, las viejas sobran.
    if (localStorage.getItem(CLAVE)) {
      for (const vieja of CLAVES_OLD) localStorage.removeItem(vieja);
    }

    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return base;
    const d = JSON.parse(crudo);
    const estadoCargado = {
      dias: d.dias || {},
      descansos: d.descansos || {},
      horas: d.horas || {},
      materias: Array.isArray(d.materias) ? d.materias : [],
      registro: d.registro || {},
      materiaActiva: d.materiaActiva || null,
      eventos: Array.isArray(d.eventos) ? d.eventos : [],
      ajustes: Object.assign({}, base.ajustes, d.ajustes || {}),
      celebraciones: d.celebraciones || {},
      push: d.push || null,
      notificados: d.notificados || {}
    };
    return prepararMaterias(estadoCargado);  } catch (e) {
    console.warn('No se pudieron leer los datos guardados:', e);
    return base;
  }
}

/* Si todavía no hay materias, creamos una "General" y le cargamos
   las horas que ya teníamos registradas sin materia. */
function prepararMaterias(est) {
  if (!est.materias.length) {
    est.materias = [{ id: 'general', nombre: 'General', emoji: '📘', color: '#94a3b8' }];
  }
  if (!est.materiaActiva || !est.materias.some(m => m.id === est.materiaActiva)) {
    est.materiaActiva = est.materias[0].id;
  }
  // Las horas viejas (sin materia) pasan a la materia general.
  for (const iso of Object.keys(est.horas)) {
    if (!est.registro[iso]) {
      est.registro[iso] = { [est.materiaActiva]: est.horas[iso] };
    }
  }
  return est;
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch (e) {
    toast('No se pudo guardar en este navegador.');
  }
}

const estado = cargar();

/* ------------------------------------------------------------
   1b) Cronómetro de horas de uso
   ------------------------------------------------------------
   Cuenta el tiempo mientras la app está ABIERTA, también si queda
   en segundo plano (pestaña escondida, ventana minimized).

   El tiempo con la app CERRADA no se cuenta: guardamos en qué
   momento empezó esta sesión y sumamos sólo la diferencia entre
   "ahora" y ese momento. Por eso, si cerrás la app un martes y la
   abrís el jueves, no se suman dos días de horas.
   ------------------------------------------------------------ */

const reloj = {
  inicioSesion: Date.now(),   // cuándo se abrió la app en esta sesión
  tick: null
};

// Suma el tiempo transcurrido desde la última llamada al día de hoy.
function acumularHoras() {
  const ahora = Date.now();
  const segundos = (ahora - reloj.inicioSesion) / 1000;
  reloj.inicioSesion = ahora;      // reiniciamos siempre el reloj

  // Si está pausado ("poné el agua"), el tiempo NO se cuenta.
  if (enPausa()) return;
  if (segundos <= 0) return;

  const hoy = hoyISO();
  const materia = materiaActiva();
  const materiaId = materia ? materia.id : 'general';

  // El tiempo se reparte entre las materias: cada día guarda un diccionario
  // { idMateria: segundos }.
  if (!estado.registro[hoy]) estado.registro[hoy] = {};
  estado.registro[hoy][materiaId] = (estado.registro[hoy][materiaId] || 0) + segundos;
  estado.horas[hoy] = (estado.horas[hoy] || 0) + segundos;

  // Si la app estuvo abierta 5 minutos o más, el día cuenta como estudiado.
  if (estado.ajustes.autoRegistro && estado.horas[hoy] >= 300 && !estado.dias[hoy]) {
    estado.dias[hoy] = true;
    toast('¡Día registrado automáticamente por uso de la app!');
  }
  guardar();

  // ¿Se cumplió la meta semanal? (se revisa en cada tic del reloj)
  revisarMeta();
}

function horasDe(iso) { return estado.horas[iso] || 0; }

function totalHoras() {
  return Object.values(estado.horas).reduce((a, b) => a + b, 0);
}

/* ---------------- Selector de materia activa ---------------- */

function renderSelectorMateria() {
  const sel = document.getElementById('selMateria');
  if (!sel) return;
  const act = materiaActiva();
  sel.innerHTML = estado.materias.map(m =>
    `<option value="${m.id}" ${act && m.id === act.id ? 'selected' : ''}>${m.emoji} ${escapar(m.nombre)}</option>`
  ).join('');

  // El selector del modal (para sumar tiempo a mano) también se llena siempre.
  const selTiempo = document.getElementById('tiempoMateria');
  if (selTiempo) {
    const valorPrevio = selTiempo.value;
    selTiempo.innerHTML = estado.materias.map(m =>
      `<option value="${m.id}" ${m.id === estado.materiaActiva ? 'selected' : ''}>${m.emoji} ${escapar(m.nombre)}</option>`
    ).join('');
    if (valorPrevio && estado.materias.some(m => m.id === valorPrevio)) selTiempo.value = valorPrevio;
  }
}

/* ---------------- Panel de materias ---------------- */

function renderMaterias() {
  const cont = document.getElementById('listaMaterias');
  if (!cont) return;
  const act = materiaActiva();
  const hoy = hoyISO();

  cont.innerHTML = estado.materias.map(m => {
    const semana = horasSemanaDeMateria(m.id, hoy);
    const total = Object.keys(estado.registro).reduce((a, iso) => a + horasDeMateria(iso, m.id), 0);
    const activa = act && act.id === m.id;
    return `<div class="materia ${activa ? 'activa' : ''}" data-materia="${m.id}" style="--color-mat: ${m.color}">
        <span class="emoji">${m.emoji}</span>
        <div class="materia-info">
          <strong>${escapar(m.nombre)}</strong>
          <span>${formatoHoras(semana)} esta semana · ${formatoHoras(total)} en total</span>
        </div>
        <div class="barra-mat"><i style="width:${metaSemana() ? Math.min(100, Math.round(semana / (metaSemana() * 3600) * 100)) : 0}%"></i></div>
        <button class="btn-icon sm" data-borrar-materia="${m.id}" title="Eliminar materia">🗑️</button>
      </div>`;
  }).join('');
}

/* ---------------- Panel de meta semanal y diaria ---------------- */

function renderMeta() {
  const p = progresoMeta();
  const elHoras = document.getElementById('metaHoras');
  if (!elHoras) return;

  elHoras.textContent = formatoHoras(p.horas);
  document.getElementById('metaObjetivo').textContent = p.meta ? `de ${p.meta} h por semana` : 'sin meta';
  document.getElementById('barraMeta').style.width = p.pct + '%';
  document.getElementById('barraMeta').classList.toggle('completa', p.cumplida);

  const msg = document.getElementById('msgMeta');
  if (!p.meta) {
    msg.textContent = 'Elegí tu meta semanal para tener un objetivo que cumplir.';
  } else if (p.cumplida) {
    msg.textContent = '🎉 ¡Meta semanal cumplida! Seguí así.';
  } else {
    const falta = p.meta * 3600 - p.horas;   // todo en segundos
    msg.textContent = `Te faltan ${formatoHoras(falta)} para cumplir la meta.`;
  }

  const sel = document.getElementById('selMeta');
  if (sel && String(sel.value) !== String(p.meta)) sel.value = String(p.meta);

  // ---- Meta diaria ----
  const d = progresoDia();
  document.getElementById('metaDiaHoras').textContent = formatoHoras(d.horas);
  document.getElementById('metaDiaObjetivo').textContent = d.meta ? `de ${d.meta} h por día` : 'sin meta diaria';
  document.getElementById('barraMetaDia').style.width = d.pct + '%';
  document.getElementById('barraMetaDia').classList.toggle('completa', d.cumplida);

  const msgDia = document.getElementById('msgMetaDia');
  if (!d.meta) {
    msgDia.textContent = 'Sin meta diaria: estudiá lo que quieras.';
  } else if (d.cumplida) {
    msgDia.textContent = '🎉 ¡Meta diaria cumplida!';
  } else {
    msgDia.textContent = `Te faltan ${formatoHoras(d.meta * 3600 - d.horas)} para la meta de hoy.`;
  }

  const inp = document.getElementById('inpMetaDia');
  if (inp && document.activeElement !== inp && Number(inp.value) !== d.meta) {
    inp.value = d.meta;
  }
}

/* ---------------- Historial mensual ---------------- */

function renderHistorial() {
  const cont = document.getElementById('historial');
  if (!cont) return;

  const datos = historialMensual();
  if (!datos.length) {
    cont.innerHTML = '<p class="vacio">Todavía no hay historial. studying y se arma solo.</p>';
    return;
  }

  const max = Math.max(1, ...datos.map(d => d.horas));

  cont.innerHTML = datos.map(d => {
    const [y, m] = d.clave.split('-');
    const etiqueta = `${MESES[Number(m) - 1]} ${y}`;
    const top = Object.entries(d.materias)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, seg]) => {
        const mat = materiaPorId(id);
        return mat ? `${mat.emoji} ${formatoHoras(seg)}` : null;
      })
      .filter(Boolean)
      .join(' · ');

    return `<div class="fila-historial" data-mes="${d.clave}" title="Ver ${etiqueta} en el calendario">
        <span class="mes">${etiqueta}</span>
        <span class="dias">${d.dias} ${d.dias === 1 ? 'día' : 'días'}</span>
        <div class="barra-hist"><i style="width:${Math.round((d.horas / max) * 100)}%"></i></div>
        <strong>${formatoHoras(d.horas)}</strong>
        <span class="materias-mes">${top || '—'}</span>
      </div>`;
  }).join('');
}

/* ---------------- Botón del mate (pausa) ---------------- */

function renderMate() {
  pintarMate();
}

/* ---------------- Gráfico de horas por materia ---------------- */

function renderGraficoMaterias() {
  const cont = document.getElementById('graficoMaterias');
  if (!cont) return;

  const rango = document.getElementById('selPeriodoMat').value;
  const datos = estado.materias.map(m => ({
    m,
    horas: horasMateriaRango(m.id, rango)
  })).sort((a, b) => b.horas - a.horas);

  const max = Math.max(1, ...datos.map(d => d.horas));
  const total = datos.reduce((a, d) => a + d.horas, 0);

  if (!datos.length || total === 0) {
    cont.innerHTML = '<p class="vacio">Todavía no hay horas registradas en este período.</p>';
    return;
  }

  cont.innerHTML = datos.map(d => `
    <div class="fila-grafico" style="--color-mat: ${d.m.color}">
      <span class="emoji">${d.m.emoji}</span>
      <span class="nombre">${escapar(d.m.nombre)}</span>
      <div class="barra-grafico"><i style="width:${Math.round((d.horas / max) * 100)}%"></i></div>
      <strong>${formatoHoras(d.horas)}</strong>
    </div>`).join('') +
    `<p class="nota total-grafico">Total del período: <strong>${formatoHoras(total)}</strong></p>`;
}

// "1h 23m" / "45m" / "12s"
function formatoHoras(segundos) {
  const total = Math.floor(segundos);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

// Versión corta para las celdas del calendario: "45m" / "1.2h"
function formatoHorasCorto(segundos) {
  const h = segundos / 3600;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.floor(segundos / 60)}m`;
}

function pintarReloj() {
  const el = document.getElementById('relojVivo');
  if (!el) return;
  const hoy = hoyISO();
  el.textContent = `⏱ Hoy: ${formatoHoras(horasDe(hoy))} · Total: ${formatoHoras(totalHoras())}`;
}

function iniciarReloj() {
  // Guardamos cada 10 segundos para no perder casi nada al cerrar la app.
  reloj.tick = setInterval(() => { acumularHoras(); pintarReloj(); }, 10000);

  // Al salir de la página (cerrar, recargar, cambiar de pestaña) guardamos.
  window.addEventListener('pagehide', () => acumularHoras());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) acumularHoras();
  });
}

/* ------------------------------------------------------------
   2) Utilidades de fecha  (¡ojo con las zonas horarias!)
   ------------------------------------------------------------ */

// Devuelve la fecha en formato "AAAA-MM-DD" usando la hora LOCAL.
// Usar toISOString() corrijo el día cuando el usuario está en UTC-3.
function aISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function desdeISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function hoyISO() { return aISO(new Date()); }

// Cantidad de días entre dos fechas ISO (b - a).
function diffDias(isoA, isoB) {
  const [ay, am, ad] = isoA.split('-').map(Number);
  const [by, bm, bd] = isoB.split('-').map(Number);
  const ua = Date.UTC(ay, am - 1, ad);
  const ub = Date.UTC(by, bm - 1, bd);
  return Math.round((ub - ua) / 86400000);
}

function sumarDias(d, n) {
  const copia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copia.setDate(copia.getDate() + n);
  return copia;
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

function fechaLarga(iso) {
  const d = desdeISO(iso);
  return `${DIAS[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function fechaCorta(iso) {
  const d = desdeISO(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

/* ------------------------------------------------------------
   3) Cálculos de estudio y rachas
   ------------------------------------------------------------ */

function diasEstudiados() {
  return Object.keys(estado.dias).filter(k => estado.dias[k]).sort();
}

function rachaActual() {
  let r = 0;
  let d = new Date();
  // Si hoy todavía no estudiaste, la racha sigue viva si estudiaste ayer.
  if (!estado.dias[aISO(d)]) {
    d = sumarDias(d, -1);
    if (!estado.dias[aISO(d)]) return 0;
  }
  while (estado.dias[aISO(d)]) {
    r++;
    d = sumarDias(d, -1);
  }
  return r;
}

function mejorRacha() {
  const claves = diasEstudiados();
  let mejor = 0, actual = 0, previa = null;
  for (const k of claves) {
    actual = (previa && diffDias(previa, k) === 1) ? actual + 1 : 1;
    mejor = Math.max(mejor, actual);
    previa = k;
  }
  return mejor;
}

function eventosDe(iso) {
  return estado.eventos.filter(e => e.fecha === iso);
}

// ¿Es sábado (6) o domingo (0)?
function esFinDeSemana(iso) {
  const dia = desdeISO(iso).getDay();
  return dia === 0 || dia === 6;
}

/* ------------------------------------------------------------
   3e) Días de descanso: se activan y desactivan uno por uno
   ------------------------------------------------------------
   Tres estados posibles para cada día:
     - automático: los fines de semana son descanso (si el toggle
       global está activo)
     - forzado:    lo marcaste como descanso a mano (aunque sea
                   un día de semana)
     - desactivado: lo sacaste a mano (aunque sea un fin de semana)

   Y una regla que pisa a todas: si el día está marcado como
   ESTUDIADO, no se muestra el icono de descanso.
   ------------------------------------------------------------ */

// ¿Este día tendría descanso automático (fin de semana)?
function descansoAutomatico(iso) {
  return estado.ajustes.finesDeSemana && esFinDeSemana(iso);
}

// Estado manual del día: true = descanso, false = sin descanso, undefined = automático
function descansoManual(iso) {
  return estado.descansos[iso];
}

// ¿El día se muestra con el ícono de descanso 🌊?
function esDiaDeDescanso(iso) {
  const manual = descansoManual(iso);
  if (manual === false) return false;         // lo desactivaste a mano
  if (manual === true) return true;           // lo activaste a mano
  return descansoAutomatico(iso);
}

// Alterna el descanso de un día: si ya es descanso, lo saca; si no, lo pone.
function alternarDescanso(iso) {
  if (esDiaDeDescanso(iso)) {
    estado.descansos[iso] = false;             // desactivado a mano
    toast('Descanso quitado ✖️');
  } else {
    estado.descansos[iso] = true;              // descanso forzado
    toast('Día de descanso 🌊');
  }
  guardar();
  render();
  abrirDia(iso);
}

/* Qué iconos y qué color lleva cada día del calendario.
   Los fines de semana cuentan como día libre 🌊 (se puede desactivar
   en Ajustes o día por día). */
function infoDelDia(iso) {
  const evs = eventosDe(iso);
  const tipos = evs.map(e => e.tipo);

  // El descanso (manual o automático) se agrega SOLO si el día no está
  // marcado como estudiado: si estudiaste, no es día libre.
  const descanso = esDiaDeDescanso(iso) && !estado.dias[iso];
  if (descanso && !tipos.includes('libre')) {
    tipos.push('libre');
  }

  // Iconos sin repetir, en el orden: eventos primero, luego el descanso.
  const emojis = [];
  for (const e of evs) {
    const ico = (TIPOS[e.tipo] || TIPOS.otro).ico;
    if (!emojis.includes(ico)) emojis.push(ico);
  }
  if (descanso && !emojis.includes('🌊')) {
    emojis.push('🌊');
  }

  // Color de fondo: manda el tipo "más importante" del día.
  let clase = '';
  if (tipos.includes('examen')) clase = 'con-examen';
  else if (tipos.includes('libre')) clase = 'con-libre';
  else if (tipos.includes('companero')) clase = 'con-companero';
  else if (tipos.length) clase = 'con-otro';

  return { evs, tipos, emojis, clase, descanso };
}

function eventosProximos() {
  const hoy = hoyISO();
  return estado.eventos
    .filter(e => e.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ------------------------------------------------------------
   3b) Materias, horas por materia y metas semanales
   ------------------------------------------------------------ */

function materiaPorId(id) {
  return estado.materias.find(m => m.id === id) || null;
}

function materiaActiva() {
  return materiaPorId(estado.materiaActiva) || estado.materias[0] || null;
}

// Segundos de una materia en un día
function horasDeMateria(iso, materiaId) {
  return (estado.registro[iso] && estado.registro[iso][materiaId]) || 0;
}

// Segundos totales de un día (sumando todas las materias)
function horasTotalesDe(iso) {
  const r = estado.registro[iso];
  if (!r) return estado.horas[iso] || 0;
  return Object.values(r).reduce((a, b) => a + b, 0);
}

// Sumar tiempo a una materia en un día
function sumarTiempo(iso, materiaId, segundos) {
  if (!estado.registro[iso]) estado.registro[iso] = {};
  estado.registro[iso][materiaId] = (estado.registro[iso][materiaId] || 0) + segundos;
  estado.horas[iso] = (estado.horas[iso] || 0) + segundos;
}

// Lunes de la semana a la que pertenece una fecha (la clave de la semana)
function inicioSemana(iso) {
  const d = desdeISO(iso);
  const dow = (d.getDay() + 6) % 7;    // lunes = 0
  return aISO(sumarDias(d, -dow));
}

// Horas totales de la semana de una fecha
function horasSemana(iso) {
  const lunes = desdeISO(inicioSemana(iso));
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += horasTotalesDe(aISO(sumarDias(lunes, i)));
  }
  return total;
}

// Horas de una materia durante la semana
function horasSemanaDeMateria(materiaId, iso) {
  const lunes = desdeISO(inicioSemana(iso));
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += horasDeMateria(aISO(sumarDias(lunes, i)), materiaId);
  }
  return total;
}

function metaSemana() {
  return Number(estado.ajustes.metaHorasSemana) || 0;
}

function metaDia() {
  return Number(estado.ajustes.metaHorasDia) || 0;
}

// Progreso de la meta diaria (todo en segundos para poder comparar)
function progresoDia() {
  const meta = metaDia();                      // en horas
  const metaSegundos = meta * 3600;            // en segundos
  const horas = horasTotalesDe(hoyISO());       // en segundos
  return {
    meta,
    horas,
    pct: metaSegundos > 0 ? Math.min(100, Math.round((horas / metaSegundos) * 100)) : 0,
    cumplida: metaSegundos > 0 && horas >= metaSegundos
  };
}

// Horas de una materia en un rango: 'mes' | 'semana' | 'total'
function horasMateriaRango(materiaId, rango) {
  const hoy = hoyISO();
  if (rango === 'total') {
    return Object.keys(estado.registro).reduce((a, iso) => a + horasDeMateria(iso, materiaId), 0);
  }
  const dias = [];
  if (rango === 'semana') {
    const lunes = desdeISO(inicioSemana(hoy));
    for (let i = 0; i < 7; i++) dias.push(aISO(sumarDias(lunes, i)));
  } else {
    const d = new Date();
    const diasDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= diasDelMes; i++) {
      dias.push(aISO(new Date(d.getFullYear(), d.getMonth(), i)));
    }
  }
  return dias.reduce((a, iso) => a + horasDeMateria(iso, materiaId), 0);
}

function progresoMeta() {
  const meta = metaSemana();                  // en horas
  const metaSegundos = meta * 3600;           // lo mismo, en segundos
  const horas = horasSemana(hoyISO());         // en segundos
  return {
    meta,
    horas,
    pct: metaSegundos > 0 ? Math.min(100, Math.round((horas / metaSegundos) * 100)) : 0,
    cumplida: metaSegundos > 0 && horas >= metaSegundos
  };
}

/* Cuando se cumple una meta, la app se ilumina de verde.
   Cada meta se festeja una sola vez (por día / por semana). */
function revisarMeta() {
  const hoy = hoyISO();

  // --- Meta diaria ---
  const d = progresoDia();
  if (d.cumplida) {
    const clave = 'dia:' + hoy;
    if (!estado.celebraciones[clave]) {
      estado.celebraciones[clave] = true;
      guardar();
      celebrar(d, '¡Meta diaria cumplida!');
    }
  }

  // --- Meta semanal ---
  const s = progresoMeta();
  if (s.cumplida) {
    const clave = inicioSemana(hoy);
    if (!estado.celebraciones[clave]) {
      estado.celebraciones[clave] = true;
      guardar();
      celebrar(s, '¡Meta semanal cumplida!');
    }
  }
}

function celebrar(p, mensaje) {
  document.body.classList.add('celebracion');
  toast(`🎉 ${mensaje} ${formatoHoras(p.horas)} de ${p.meta}h`);
  tocarSonido();
  setTimeout(() => document.body.classList.remove('celebracion'), 5000);
}

/* Un pequeño "ding" con la Web Audio API (sin archivos de sonido). */
function tocarSonido() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const notas = [523.25, 659.25, 783.99, 1046.5];   // do - mi - sol - do
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.12 + 0.03);
      vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.35);
      osc.connect(vol); vol.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch (e) { /* sin audio, no pasa nada */ }
}

/* ------------------------------------------------------------
   3c) "Poner el agua para el mate" — pausa del cronómetro
   ------------------------------------------------------------
   Mientras está pausado, el cronómetro NO cuenta tiempo. La pausa
   se guarda como una fecha de fin, así que si cerrás la app y la
   volvés a abrir dentro del tiempo de pausa, sigue pausada.
   ------------------------------------------------------------ */

function minutosMate() {
  const m = Number(estado.ajustes.minutosMate);
  return Math.max(15, m || 15);      // mínimo 15 minutos
}

function enPausa() {
  return !!estado.pausaHasta && Date.now() < estado.pausaHasta;
}

function segundosRestantesPausa() {
  if (!estado.pausaHasta) return 0;
  return Math.max(0, Math.ceil((estado.pausaHasta - Date.now()) / 1000));
}

function ponerElAgua() {
  const minutos = minutosMate();
  estado.pausaHasta = Date.now() + minutos * 60000;
  guardar();
  render();
  toast(`🍵 Poniendo el agua... ${minutos} min de pausa`);
  iniciarCuentaRegresiva();
}

function terminarMate() {
  estado.pausaHasta = null;
  guardar();
  render();
  toast('☕ Listo, ¡a seguir!');
}

function formatearCuentaAtras(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function iniciarCuentaRegresiva() {
  if (reloj.cuenta) return;
  reloj.cuenta = setInterval(() => {
    if (!enPausa()) {
      clearInterval(reloj.cuenta);
      reloj.cuenta = null;
      render();
      toast('☕ Termino la pausa, el cronómetro sigue');
      return;
    }
    pintarMate();
  }, 1000);
}

function pintarMate() {
  const el = document.getElementById('btnMate');
  if (!el) return;
  if (enPausa()) {
    el.textContent = `🍵 ${formatearCuentaAtras(segundosRestantesPausa())}`;
    el.classList.add('pausado');
    el.title = 'Pausa activa: clic para terminar el mate y seguir contando';
  } else {
    el.textContent = '🍵';
    el.classList.remove('pausado');
    el.title = `Poner el agua para el mate (pausa de ${minutosMate()} min)`;
  }
}

/* ------------------------------------------------------------
   3d) Historial mensual
   ------------------------------------------------------------ */

function historialMensual() {
  const meses = {};
  const claveMes = iso => iso.slice(0, 7);        // "2026-11"

  for (const iso of Object.keys(estado.dias)) {
    if (!estado.dias[iso]) continue;
    const k = claveMes(iso);
    if (!meses[k]) meses[k] = { clave: k, dias: 0, horas: 0, materias: {} };
    meses[k].dias++;
  }

  for (const iso of Object.keys(estado.registro)) {
    const k = claveMes(iso);
    if (!meses[k]) meses[k] = { clave: k, dias: 0, horas: 0, materias: {} };
    for (const id of Object.keys(estado.registro[iso])) {
      const seg = estado.registro[iso][id];
      meses[k].horas += seg;
      meses[k].materias[id] = (meses[k].materias[id] || 0) + seg;
    }
  }

  return Object.values(meses).sort((a, b) => b.clave.localeCompare(a.clave));
}

/* ------------------------------------------------------------
   4) Renderizado
   ------------------------------------------------------------ */

let mesVista = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function render() {
  renderTema();
  renderCabecera();
  renderAvisos();
  renderStats();
  renderSelectorMateria();
  renderMaterias();
  renderMeta();
  renderGraficoMaterias();
  renderHistorial();
  renderMate();
  pintarEstadoPush();
  renderCalendario();
  renderRacha();
  renderHeatmap();
  renderBarras();
  renderEventos();
}

function renderTema() {
  document.documentElement.dataset.tema = estado.ajustes.tema;
  const b = document.getElementById('btnTema');
  b.textContent = estado.ajustes.tema === 'oscuro' ? '🌙' : '☀️';
}

function renderCabecera() {
  const h = new Date();
  document.getElementById('hoyLabel').textContent =
    `${DIAS[(h.getDay() + 6) % 7]} ${h.getDate()} de ${MESES[h.getMonth()]} de ${h.getFullYear()}`;
}

function renderAvisos() {
  const cont = document.getElementById('avisos');
  cont.innerHTML = '';
  const hoy = hoyISO();
  const racha = rachaActual();

  const proximos = eventosProximos();
  const proximo = proximos[0];

  if (proximo) {
    const dias = diffDias(hoy, proximo.fecha);
    const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
    cont.insertAdjacentHTML('beforeend',
      `<div class="aviso ${proximo.tipo}">
         <span class="ico">${TIPOS[proximo.tipo].ico}</span>
         <span><strong>${escapar(proximo.titulo)}</strong> — ${cuando} (${fechaCorta(proximo.fecha)})</span>
       </div>`);
  }

  if (racha >= 3) {
    cont.insertAdjacentHTML('beforeend',
      `<div class="aviso bien">
         <span class="ico">🔥</span>
         <span>¡Vas por <strong>${racha} días</strong> seguidos! No cortes la racha.</span>
       </div>`);
  }
}

function renderStats() {
  const total = diasEstudiados().length;
  const hoy = hoyISO();
  const estudiosHoy = estado.dias[hoy] ? 1 : 0;

  // Porcentaje de días estudiados este mes
  const ahora = new Date();
  const diasDelMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  let delMes = 0;
  for (let i = 1; i <= diasDelMes; i++) {
    const iso = aISO(new Date(ahora.getFullYear(), ahora.getMonth(), i));
    if (estado.dias[iso]) delMes++;
  }
  const pct = Math.round((delMes / diasDelMes) * 100);

  const libres = estado.eventos.filter(e => e.tipo === 'libre').length;
  const proximosExamenes = eventosProximos().filter(e => e.tipo === 'examen').length;

  // Fines de semana del mes actual (solo los que effectively son descanso)
  let finesDeSemana = 0;
  for (let i = 1; i <= diasDelMes; i++) {
    const iso = aISO(new Date(ahora.getFullYear(), ahora.getMonth(), i));
    if (esDiaDeDescanso(iso) && !estado.dias[iso]) finesDeSemana++;
  }

  const horasHoy = horasTotalesDe(hoyISO());
  const horasTotales = totalHoras();
  const metaHoy = progresoDia();

  const stats = [
    { t: 'Horas de hoy', v: formatoHoras(horasHoy), s: metaHoy.meta ? `meta: ${metaHoy.meta} h` : 'con la app abierta', destacada: true },
    { t: 'Días estudiados', v: total, s: 'en total' },
    { t: 'Racha actual', v: rachaActual(), s: 'días seguidos 🔥' },
    { t: 'Mejor racha', v: mejorRacha(), s: 'récord' },
    { t: 'Meta de hoy', v: metaHoy.meta ? metaHoy.pct + '%' : '—', s: metaHoy.meta ? (metaHoy.cumplida ? 'cumplida 🎉' : 'objetivo del día') : 'sin meta' },
    { t: 'Horas totales', v: formatoHoras(horasTotales), s: 'acumuladas' },
    { t: 'Este mes', v: pct + '%', s: `${delMes} de ${diasDelMes} días` },
    { t: 'Hoy', v: estudiosHoy ? '✓' : '—', s: estudiosHoy ? 'registrado' : 'sin registrar' },
    { t: 'Próximos exámenes', v: proximosExamenes, s: `${libres + finesDeSemana} días libres` }
  ];

  document.getElementById('stats').innerHTML = stats.map(s =>
    `<div class="stat${s.destacada ? ' stat-destacada' : ''}"><span>${s.t}</span><strong>${s.v}</strong><small>${s.s}</small></div>`
  ).join('');
}

function renderCalendario() {
  const cal = document.getElementById('calendario');
  const ano = mesVista.getFullYear();
  const mes = mesVista.getMonth();
  const hoy = hoyISO();

  document.getElementById('tituloMes').textContent =
    `${MESES[mes]} ${ano}`;

  const primero = new Date(ano, mes, 1);
  const desplazamiento = (primero.getDay() + 6) % 7;   // lunes = 0
  const diasDelMes = new Date(ano, mes + 1, 0).getDate();

  let html = '';
  // 42 casillas = 6 semanas: mantiene la altura siempre igual
  for (let i = 0; i < 42; i++) {
    const num = i - desplazamiento + 1;
    const fecha = new Date(ano, mes, num);
    const iso = aISO(fecha);
    const fuera = num < 1 || num > diasDelMes;
    const info = infoDelDia(iso);

    let clases = 'dia';
    if (fuera) clases += ' fuera';
    if (iso === hoy) clases += ' hoy';
    if (estado.dias[iso]) clases += ' estudiado';
    if (info.clase) clases += ' ' + info.clase;

    const llama = estado.dias[iso] && iso === hoy ? '<span class="llama-dia">🔥</span>' : '';
    const hs = horasTotalesDe(iso);
    const etiquetaHoras = hs >= 60 ? `<span class="hora-dia">${formatoHorasCorto(hs)}</span>` : '';

    // Los iconos van DEBAJO del número: 📚 examen, 🌊 libre, 🧉 compañero, 📌 otro
    const iconos = info.emojis.map(ico => `<span class="ico-dia">${ico}</span>`).join('');

    html += `<div class="${clases}" data-fecha="${iso}" title="${escapar(fechaLarga(iso))}${hs ? ' · ' + formatoHoras(hs) : ''}">
              ${llama}<span class="num-dia">${fecha.getDate()}</span>
              <span class="iconos-dia">${iconos}</span>
              ${etiquetaHoras}
            </div>`;
  }
  cal.innerHTML = html;
}

function renderRacha() {
  const racha = rachaActual();
  document.getElementById('numRacha').textContent = racha;
  document.getElementById('mejorRacha').textContent = mejorRacha();
  document.getElementById('totalDias').textContent = diasEstudiados().length;
  document.getElementById('totalHoras').textContent = formatoHoras(totalHoras());

  const llama = document.getElementById('llama');
  llama.classList.toggle('apagada', racha === 0);

  const msg = document.getElementById('msgRacha');
  if (racha === 0) msg.textContent = 'Abrí la app hoy para encender la llama.';
  else if (racha === 1) msg.textContent = '¡Racha iniciada! Mañana se sigue.';
  else msg.textContent = `¡${racha} días sin cortar! Seguí así.`;

  // Últimos 14 días como "chips"
  const chips = document.getElementById('chipsRacha');
  chips.innerHTML = '';
  for (let i = 13; i >= 0; i--) {
    const d = sumarDias(new Date(), -i);
    const iso = aISO(d);
    const on = !!estado.dias[iso];
    const chip = document.createElement('span');
    chip.className = 'chip' + (on ? ' on' : '');
    chip.textContent = `${d.getDate()}/${d.getMonth() + 1}${on ? ' 🔥' : ''}`;
    chip.title = fechaLarga(iso);
    chips.appendChild(chip);
  }
}

function renderHeatmap() {
  const mapa = document.getElementById('heatmap');
  const hoy = new Date();
  // Arrancamos en el lunes de la semana actual y retrocedemos 19 semanas.
  const lunesActual = sumarDias(hoy, -((hoy.getDay() + 6) % 7));

  let html = '';
  for (let semana = 19; semana >= 0; semana--) {
    for (let dia = 0; dia < 7; dia++) {
      const d = sumarDias(lunesActual, -semana * 7 + dia);
      const iso = aISO(d);
      if (d > hoy) { html += '<div class="celda" style="visibility:hidden"></div>'; continue; }
      const clases = 'celda' + (estado.dias[iso] ? ' on' : '') + (iso === hoyISO() ? ' hoy' : '');
      html += `<div class="${clases}" title="${escapar(fechaLarga(iso))}"></div>`;
    }
  }
  mapa.innerHTML = html;
}

function renderBarras() {
  const cont = document.getElementById('barras');
  const ahora = new Date();
  const datos = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const diasDelMes = new Date(y, m + 1, 0).getDate();
    let c = 0;
    for (let n = 1; n <= diasDelMes; n++) {
      if (estado.dias[aISO(new Date(y, m, n))]) c++;
    }
    datos.push({ etiqueta: MESES[m].slice(0, 3), valor: c, total: diasDelMes });
  }

  const max = Math.max(1, ...datos.map(d => d.valor));
  cont.innerHTML = datos.map(d => `
    <div class="barra-col">
      <span class="barra-valor">${d.valor}</span>
      <div class="barra" style="height:${Math.round((d.valor / max) * 100)}%"></div>
      <span class="barra-label">${d.etiqueta}</span>
    </div>`).join('');
}

function renderEventos() {
  const cont = document.getElementById('listaEventos');
  const hoy = hoyISO();

  const proximos = eventosProximos();
  const pasados = estado.eventos
    .filter(e => e.fecha < hoy)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 10);

  if (!estado.eventos.length) {
    cont.innerHTML = '<p class="vacio">Todavía no agregaste fechas. Usá el botón "+ Agregar fecha" o hacé clic en un día del calendario.</p>';
    return;
  }

  let html = '';
  if (proximos.length) {
    html += '<h4>Próximas</h4>';
    html += proximos.map(e => filaEvento(e, hoy)).join('');
  }
  if (pasados.length) {
    html += '<h4>Anteriores</h4>';
    html += pasados.map(e => filaEvento(e, hoy)).join('');
  }
  cont.innerHTML = html;
}

// Texto extra de un evento: con quién estudiaste, y las notas.
function detalleEvento(e) {
  let extra = '';
  if (e.tipo === 'companero' && e.companero) extra += ' · con ' + escapar(e.companero);
  if (e.notas) extra += ' · ' + escapar(e.notas);
  return extra;
}

function filaEvento(e, hoy) {
  const dias = diffDias(hoy, e.fecha);
  const cuando = e.fecha === hoy ? 'HOY'
    : dias === 1 ? 'Mañana'
    : dias === 0 ? 'Hoy'
    : dias > 0 ? `En ${dias} días`
    : `Hace ${Math.abs(dias)} días`;
  const t = TIPOS[e.tipo] || TIPOS.otro;
  return `<div class="evento ${e.tipo}">
      <span class="ico">${t.ico}</span>
      <div class="info">
        <strong>${escapar(e.titulo)}</strong>
        <span>${t.label} · ${fechaLarga(e.fecha)}${detalleEvento(e)}</span>
      </div>
      <span class="cuando">${cuando}</span>
      <button class="btn-icon sm" data-borrar="${e.id}" title="Eliminar">🗑️</button>
    </div>`;
}

/* Escape de texto para evitar romper el HTML al pegar contenido.
   (Es la versión "sencilla" de sanitizar: alcanza para esta app.) */
function escapar(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ------------------------------------------------------------
   5) Registro automático y recordatorios
   ------------------------------------------------------------ */

function registrarHoy() {
  const hoy = hoyISO();
  if (!estado.dias[hoy]) {
    estado.dias[hoy] = true;
    guardar();
    return true;
  }
  return false;
}

function revisarRecordatorios() {
  if (!estado.ajustes.recordatorio) return;
  const hoy = hoyISO();
  const limite = estado.ajustes.diasAviso;

  for (const e of eventosProximos()) {
    const dias = diffDias(hoy, e.fecha);
    const esCompanero = e.tipo === 'companero';

    // Los estudios con compañero avisan SOLO el día anterior.
    // Los demás avisan dentro de la ventana "avisar con N días antes".
    if (esCompanero ? dias !== 1 : (dias < 0 || dias > limite)) continue;

    const clave = `${e.id}|${hoy}`;
    if (estado.notificados[clave]) continue;
    estado.notificados[clave] = true;

    const t = TIPOS[e.tipo] || TIPOS.otro;
    const texto = esCompanero
      ? `🧉 Mañana tenés que estudiar con ${e.companero || e.titulo}`
      : `${t.ico} ${e.titulo} — ${dias === 0 ? 'es hoy' : dias === 1 ? 'es mañana' : `es en ${dias} días`}`;

    notificar('PiniStudio', texto);
  }
  guardar();
}

function notificar(titulo, cuerpo) {
  // Si el navegador permite notificaciones, las usamos; si no, aviso en pantalla.
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Con Service Worker la notificación es del sistema operativo y más confiable.
      if (registroSW) {
        registroSW.showNotification(titulo, {
          body: cuerpo,
          icon: '📚',
          tag: 'pinistudio-recordatorio',
          requireInteraction: false
        });
        return;
      }
      new Notification(titulo, { body: cuerpo, icon: '📚' });
      return;
    } catch (e) { /* seguimos con el toast */ }
  }
  toast(cuerpo);
}

/* ------------------------------------------------------------
   6) Toasts (avisos dentro de la app)
   ------------------------------------------------------------ */

function toast(mensaje) {
  const cont = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = mensaje;
  cont.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ------------------------------------------------------------
   7) Modales
   ------------------------------------------------------------ */

function abrirModal(id) { document.getElementById(id).hidden = false; }
function cerrarModal(id) { document.getElementById(id).hidden = true; }

function abrirDia(iso) {
  document.getElementById('tituloDia').textContent = fechaLarga(iso);
  document.getElementById('campoFecha').value = iso;
  document.getElementById('campoTitulo').value = '';
  document.getElementById('campoNotas').value = '';
  document.getElementById('campoCompanero').value = '';
  actualizarCamposEvento();

  const studied = !!estado.dias[iso];
  const btn = document.getElementById('btnToggleEstudio');
  btn.textContent = studied ? 'Quitar marca de “estudiado”' : 'Marcar como estudiado';
  btn.dataset.fecha = iso;

  // Horas registradas de ese día
  const hs = horasTotalesDe(iso);
  document.getElementById('infoHorasDia').textContent =
    `⏱ Tiempo con la app abierta ese día: ${formatoHoras(hs)}` +
    (iso === hoyISO() ? ' (contando ahora mismo)' : '');

  // Botón de descanso (se activa y se desactiva día por día)
  const btnDesc = document.getElementById('btnToggleDescanso');
  const esDescanso = esDiaDeDescanso(iso);
  const manual = descansoManual(iso);
  btnDesc.textContent = esDescanso
    ? '✖️ Quitar el descanso de este día'
    : '🌊 Marcar este día como descanso';
  btnDesc.dataset.fecha = iso;
  btnDesc.classList.toggle('activo', esDescanso);

  // Explicación de cómo quedó el día
  const infoDesc = document.getElementById('infoDescanso');
  if (estado.dias[iso]) {
    infoDesc.textContent = '📗 Estudiado: por eso no se muestra el ícono de descanso 🌊.';
  } else if (manual === false) {
    infoDesc.textContent = '✖️ Descanso desactivado a mano en este día.';
  } else if (manual === true) {
    infoDesc.textContent = '🌊 Descanso activado a mano en este día.';
  } else if (descansoAutomatico(iso)) {
    infoDesc.textContent = '🌊 Es fin de semana: descanso automático (lo podés apagar arriba).';
  } else {
    infoDesc.textContent = 'Día de estudio normal.';
  }

  // Desglose por materia de ese día
  const desglose = document.getElementById('desgloseDia');
  const reg = estado.registro[iso] || {};
  const partes = Object.keys(reg)
    .map(id => ({ m: materiaPorId(id), seg: reg[id] }))
    .filter(p => p.m && p.seg > 0)
    .sort((a, b) => b.seg - a.seg);

  desglose.innerHTML = partes.length
    ? partes.map(p => `<div class="desglose-fila">
          <span class="emoji">${p.m.emoji}</span>
          <span>${escapar(p.m.nombre)}</span>
          <strong>${formatoHoras(p.seg)}</strong>
        </div>`).join('')
    : '<p class="vacio">Sin tiempo registrado para este día.</p>';

  // Selector de materia para sumar tiempo a mano
  const selTiempo = document.getElementById('tiempoMateria');
  if (selTiempo) {
    selTiempo.innerHTML = estado.materias.map(m =>
      `<option value="${m.id}" ${m.id === estado.materiaActiva ? 'selected' : ''}>${m.emoji} ${escapar(m.nombre)}</option>`
    ).join('');
  }

  const lista = document.getElementById('eventosDelDia');
  const evs = eventosDe(iso);
  lista.innerHTML = evs.length
    ? evs.map(e => `<div class="evento ${e.tipo}">
          <span class="ico">${(TIPOS[e.tipo] || TIPOS.otro).ico}</span>
          <div class="info"><strong>${escapar(e.titulo)}</strong>
            <span>${(TIPOS[e.tipo] || TIPOS.otro).label}${detalleEvento(e)}</span></div>
          <button class="btn-icon sm" data-borrar="${e.id}" title="Eliminar">🗑️</button>
        </div>`).join('')
    : '<p class="vacio">Sin fechas en este día.</p>';

  abrirModal('modalDia');
  setTimeout(() => document.getElementById('campoTitulo').focus(), 50);
}

function actualizarCamposEvento() {
  const esCompanero = document.getElementById('campoTipo').value === 'companero';
  document.getElementById('campoCompanero').hidden = !esCompanero;
}

function abrirAjustes() {
  document.getElementById('optAutoRegistro').checked = estado.ajustes.autoRegistro;
  document.getElementById('optFinesDeSemana').checked = estado.ajustes.finesDeSemana;
  document.getElementById('optRecordatorio').checked = estado.ajustes.recordatorio;
  document.getElementById('optDiasAviso').value = estado.ajustes.diasAviso;
  document.getElementById('optHoraAviso').value = estado.ajustes.horaAviso;
  document.getElementById('inpMinutosMate').value = minutosMate();
  document.getElementById('inpServidorNotif').value = estado.ajustes.servidorNotif || '';
  document.getElementById('optGoogleSync').checked = estado.ajustes.googleSync !== false;
  pintarEstadoPush();
  pintarEstadoGoogle(window._googleInfo);

  const nota = document.getElementById('notaPermiso');
  if (!('Notification' in window)) {
    nota.textContent = 'Este navegador no soporta notificaciones de escritorio.';
  } else if (Notification.permission === 'granted') {
    nota.textContent = 'Notificaciones activadas ✅';
  } else if (Notification.permission === 'denied') {
    nota.textContent = 'Las notificaciones están bloqueadas. Habilitalas desde los permisos del navegador.';
  } else {
    nota.textContent = 'Hacé clic en "Activar notificaciones" para recibir avisos en el escritorio.';
  }

  abrirModal('modalAjustes');
}

/* ------------------------------------------------------------
   8) Exportar / importar / descargar
   ------------------------------------------------------------ */

function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Exportar las fechas al calendario del sistema (Google Calendar, Outlook, etc.).
   Esto hace que los avisos te lleguen aunque la app esté cerrada. */
function escaparIcs(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function exportarIcs() {
  if (!estado.eventos.length) {
    toast('No hay fechas para exportar ❌');
    return;
  }
  const sello = aISO(new Date()).replace(/-/g, '') + 'T120000Z';
  const L = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PiniStudio//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PiniStudio'
  ];

  for (const e of estado.eventos) {
    const inicio = e.fecha.replace(/-/g, '');
    const fin = aISO(sumarDias(desdeISO(e.fecha), 1)).replace(/-/g, '');
    L.push('BEGIN:VEVENT');
    L.push('UID:' + e.id + '@pinistudio');
    L.push('DTSTAMP:' + sello);
    L.push('DTSTART;VALUE=DATE:' + inicio);
    L.push('DTEND;VALUE=DATE:' + fin);
    L.push('SUMMARY:' + escaparIcs(e.titulo));
    if (e.notas) L.push('DESCRIPTION:' + escaparIcs(e.notas));
    // Alarma: un día antes para exámenes y para estudios con compañero;
    // el mismo día para el resto.
    const diasAntes = (e.tipo === 'examen' || e.tipo === 'companero') ? 1 : 0;
    L.push('BEGIN:VALARM');
    L.push('TRIGGER:' + (diasAntes ? '-P' + diasAntes + 'D' : '-PT2H'));
    L.push('ACTION:DISPLAY');
    L.push('DESCRIPTION:' + escaparIcs(e.titulo));
    L.push('END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');

  descargar('pinistudio-fechas.ics', L.join('\r\n'), 'text/calendar;charset=utf-8');
  toast('Calendario exportado ✅ abrilo con tu agenda');
}

function exportarDatos() {
  descargar(`pinistudio-${hoyISO()}.json`, JSON.stringify(estado, null, 2), 'application/json');
  toast('Datos descargados ✅');
}

function importarDatos(archivo) {
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const d = JSON.parse(lector.result);
      if (!d || typeof d !== 'object') throw new Error('formato inválido');
      localStorage.setItem(CLAVE, JSON.stringify(Object.assign(estadoPorDefecto(), d)));
      location.reload();
    } catch (e) {
      toast('Ese archivo no es un respaldo válido ❌');
    }
  };
  lector.readAsText(archivo);
}

async function descargarCopiaApp() {
  try {
    const r = await fetch(location.href);
    if (!r.ok) throw new Error('sin acceso');
    const html = await r.text();
    descargar('pinistudio.html', html, 'text/html');
    toast('Copia descargada ✅');
  } catch (e) {
    toast('Abrí la app desde un servidor (http) para descargar la copia.');
  }
}

/* ------------------------------------------------------------
   8b) Notificaciones push (Web Push) — funcionan con la app cerrada
   ------------------------------------------------------------
   - El Service Worker (sw.js) es el que muestra la notificación del sistema.
   - La "suscripción" es la dirección donde el navegador recibe los avisos.
   - Un servidor (worker-push.js) manda los avisos a esa dirección.
   ------------------------------------------------------------ */

// Clave pública VAPID (la privada está en el servidor, nunca en la app).
const VAPID_PUBLIC_KEY = 'BMlloWwS3wediEqHVjaA8OXHhY8lWmd2RkQN0irQMCcEntxhHN6SqGjIlh0bYLMQJnMOn0jYvhFvgS2T1CM7tcw';

// Registro del Service Worker (guardado para mostrar notificaciones del sistema)
let registroSW = null;

// Convierte base64url (como está la clave) a bytes para la API de push.
function urlBase64ToUint8Array(base64String) {  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const salida = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) salida[i] = raw.charCodeAt(i);
  return salida;
}

async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  if (location.protocol === 'file:') return null;   // con file:// no hay Service Worker
  try {
    registroSW = await navigator.serviceWorker.register('sw.js');
    return registroSW;
  } catch (e) {
    console.warn('No se pudo registrar el Service Worker:', e);
    return null;
  }
}

async function activarPush() {
  if (!('Notification' in window)) {
    toast('Este navegador no soporta notificaciones ❌');
    return;
  }
  if (location.protocol === 'file:') {
    toast('Las push necesitan la app servida por http(s) o publicada 🌐');
    return;
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    toast('Permiso denegado ❌');
    pintarEstadoPush();
    return;
  }

  const reg = await registrarServiceWorker();
  if (!reg) {
    toast('No se pudo registrar el Service Worker ❌');
    return;
  }

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    estado.push = { sub: sub.toJSON(), activo: true };
    guardar();
    pintarEstadoPush();
    toast('Push activado ✅');
  } catch (e) {
    console.warn(e);
    toast('No se pudo activar el push ❌');
  }
}

// Envía los datos al servidor de avisos para que sepa qué fechas supervisar.
async function registrarEnServidor() {
  const url = (document.getElementById('inpServidorNotif').value || '').trim();
  if (!url) return toast('Escribí la URL de tu servidor de avisos');

  const reg = await registrarServiceWorker();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return toast('Primero activá el push 🔔');

  estado.ajustes.servidorNotif = url;
  guardar();

  try {
    const r = await fetch(url + '/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        diasAviso: estado.ajustes.diasAviso,
        eventos: estado.eventos.map(e => ({
          fecha: e.fecha, titulo: e.titulo, tipo: e.tipo, companero: e.companero || ''
        }))
      })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    toast('Registrado en el servidor ✅');
    pintarEstadoPush();
  } catch (e) {
    toast('No se pudo registrar ❌ ' + e.message);
  }
}

async function probarNotificacion() {
  const reg = await registrarServiceWorker();
  if (reg) {
    reg.active?.postMessage({ tipo: 'probar' });
    toast('Notificación enviada 🧪');
    return;
  }
  // Sin Service Worker: al menos la notificación normal
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('PiniStudio', { body: '¡Las notificaciones funcionan! 🔔' });
    toast('Notificación enviada 🧪');
  } else {
    toast('Activá el permiso de notificaciones primero');
  }
}

function pintarEstadoPush() {
  const el = document.getElementById('estadoPush');
  if (!el) return;

  const partes = [];
  partes.push('Permiso: ' + ('Notification' in window ? Notification.permission : 'no soportado'));

  if (estado.push && estado.push.activo) partes.push('Push: ✅ activo');
  else partes.push('Push: no activado');

  if (estado.ajustes.servidorNotif) partes.push('Servidor: ' + estado.ajustes.servidorNotif);
  else partes.push('Servidor: sin configurar');

  if (location.protocol === 'file:') {
    partes.push('⚠️ Abriste el archivo directamente: el push solo funciona servido por http(s) o publicado en internet');
  }
  el.textContent = partes.join(' · ');
}

/* ------------------------------------------------------------
   8c) Instalación de la app (PWA)
   ------------------------------------------------------------
   - Chrome/Edge: muestran el evento "beforeinstallprompt" y podemos
     mostrar un botón que instala la app con un clic.
   - Safari (iPhone): no hay evento; el usuario tiene que usar
     "Compartir > Añadir a pantalla de inicio". Por eso el botón
     "Cómo se instala" muestra las instrucciones.
   ------------------------------------------------------------ */

let promptInstalacion = null;

function esAppInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

function pintarEstadoInstalacion() {
  const el = document.getElementById('estadoInstalacion');
  if (!el) return;

  if (esAppInstalada()) {
    el.textContent = '✅ La app ya está instalada en este dispositivo.';
  } else if (promptInstalacion) {
    el.textContent = 'Podés instalarla con el botón de arriba 👆';
  } else {
    el.textContent = location.protocol === 'file:'
      ? 'Para instalarla, abrí la app desde una dirección web (http o https).'
      : 'En Android: menú del navegador → "Instalar app" / "Añadir a pantalla de inicio".';
  }

  const btn = document.getElementById('btnInstalar');
  if (btn) btn.hidden = !promptInstalacion || esAppInstalada();
}

async function instalarApp() {
  if (!promptInstalacion) {
    mostrarComoInstalar();
    return;
  }
  promptInstalacion.prompt();
  const { outcome } = await promptInstalacion.userChoice;
  if (outcome === 'accepted') {
    toast('App instalada ✅ ahora la tenés en el celu');
  }
  promptInstalacion = null;
  pintarEstadoInstalacion();
}

function mostrarComoInstalar() {
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const texto = esIOS
    ? '📲 En iPhone: tocá el botón de Compartir (⬆️) → "Añadir a pantalla de inicio" → "Agregar".'
    : '📲 En Android: tocá el menú (⋮) del navegador → "Instalar app" o "Añadir a pantalla de inicio".';
  toast(texto);
  const el = document.getElementById('estadoInstalacion');
  if (el) el.textContent = texto;
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();                       //_we_ el evento (Chrome muestra su propio cartel)
  promptInstalacion = e;
  pintarEstadoInstalacion();
});

window.addEventListener('appinstalled', () => {
  promptInstalacion = null;
  toast('¡PiniStudio instalado! 🎉');
  pintarEstadoInstalacion();
});

/* ------------------------------------------------------------
   8d) Google Calendar — las fechas también en tu cuenta de Google
   ------------------------------------------------------------
   - TODO pasa en el navegador: NO hay servidor ni backend.
   - El acceso se pide con el "token client" de Google Identity
     Services (GIS). Hace falta un Client ID (que es público, no
     es un secreto) y el scope calendar.app.created, que NO es
     sensible: Google no pide verificación de la app y todos los
     que usen PiniStudio pueden conectar su cuenta sin trámite.
   - El token dura 1 hora. Cuando se vence, se vuelve a pedir
     (Google abre la ventana de permiso sola si ya habías autorizado).
   - Cada fecha que guardás se crea como evento en un calendario
     "PiniStudio" de Google, con recordatorio (popup + email).
   - Si abrís el archivo con doble clic (file://), no hay OAuth:
     se avisa y se sigue usando el export .ics.
   ------------------------------------------------------------ */

// El Client ID de Google. NO es un secreto (va en el código de
// cualquier web que use Google). Lo copies de Google Cloud Console.
const GOOGLE_CLIENT_ID = '119848058510-ro0449o7222mju0uunkm3rmcq6cu3jk6.apps.googleusercontent.com';

// El scope: permite crear un calendario propio y manejar sus eventos.
// No da acceso a los otros calendarios del usuario.
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';

const GOOGLE_LIB = 'https://accounts.google.com/gsi/client';
const GOOGLE_API = 'https://www.googleapis.com/calendar/v3';

/* --- El token vive aparte de `estado` -------------------------
   A propósito: `estado` se exporta a un .json que el usuario
   comparte. El token NO debe viajar en ese archivo, así que lo
   guardamos en su propia clave de localStorage. */
const CLAVE_GOOGLE = 'pinistudio-google';

/* Un evento de la app -> un evento de Google Calendar.
   Google no entiende "días libres" ni "con compañero", así que lo
   metemos en la descripción y en el título. */
function eventoParaGoogle(ev) {
  const t = TIPOS[ev.tipo] || TIPOS.otro;
  const [h, m] = (estado.ajustes.horaAviso || '18:00').split(':').map(Number);

  // Empezamos a la hora del aviso, así el recordatorio de Google
  // salta ese día a esa hora (y no a la medianoche).
  const d = desdeISO(ev.fecha);
  d.setHours(h, m, 0, 0);

  const fin = new Date(d.getTime() + 60 * 60 * 1000);

  // Cuánto antes avisar:
  //  - con compañero -> 1 día antes (1440 min), como ya hace la app
  //  - examen        -> según "avisar con N días antes"
  //  - otros         -> el mismo día
  let minPopup;
  if (ev.tipo === 'companero') minPopup = 1440;
  else if (ev.tipo === 'examen') minPopup = (estado.ajustes.diasAviso || 3) * 1440;
  else minPopup = 60;

  const partes = [t.ico + ' ' + ev.titulo];
  if (ev.companero) partes.push('con ' + ev.companero);
  if (ev.notas) partes.push(ev.notas);

  return {
    id: ev.id,
    summary: partes[0],
    description: partes.slice(1).join(' · '),
    inicio: isoLocal(d),
    fin: isoLocal(fin),
    min_popup: minPopup,
    min_email: minPopup
  };
}

/* Fecha y hora local, sin la Z (que en Google la convierte a UTC). */
function isoLocal(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
         `T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function zonaHoraria() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires';
  } catch (e) {
    return 'America/Argentina/Buenos_Aires';
  }
}

/* --- Guardar / leer el token ---------------------------------- */

function leerGoogle() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_GOOGLE)) || null;
  } catch (e) {
    return null;
  }
}

function guardarGoogle(d) {
  localStorage.setItem(CLAVE_GOOGLE, JSON.stringify(d));
}

function borrarGoogle() {
  localStorage.removeItem(CLAVE_GOOGLE);
  estado.ajustes.googleConectado = false;
  guardar();
}

/* --- La librería de Google Identity Services --------------------
   Se carga sólo cuando hace falta (al conectar o al renovar),
   para que la app siga siendo liviana y funcione sin internet. */
let promesaGIS = null;

function cargarGIS() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    return Promise.resolve(window.google.accounts.oauth2);
  }
  if (promesaGIS) return promesaGIS;

  promesaGIS = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GOOGLE_LIB;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve(window.google.accounts.oauth2);
      } else {
        reject(new Error('No se pudo cargar Google'));
      }
    };
    s.onerror = () => reject(new Error('No se pudo cargar Google (sin internet?)'));
    document.head.appendChild(s);
  });
  return promesaGIS;
}

/* --- Conectar ----------------------------------------------------
   Abre la ventana de permisos de Google. Si el usuario ya había
   conectado antes, Google no vuelve a preguntar nada. */
function conectarGoogle() {
  if (location.protocol === 'file:') {
    return toast('Abrí la app desde internet para conectar Google 📡');
  }
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('REEMPLAZAR')) {
    return toast('Falta el Client ID de Google en la app ⚙️');
  }

  cargarGIS().then(oauth2 => {
    const cliente = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPE,
      callback: (resp) => {
        if (resp.error) {
          toast('No se pudo conectar: ' + (resp.error_description || resp.error));
          return;
        }
        guardarGoogle({
          token: resp.access_token,
          expira: Date.now() + (resp.expires_in || 3600) * 1000
        });
        estado.ajustes.googleConectado = true;
        guardar();
        pintarEstadoGoogle({ configurado: true, conectado: true });
        toast('¡Conectado con Google Calendar! 📅');
        sincronizarGoogle(false);
      },
      error_callback: (err) => {
        toast('No se pudo conectar con Google ❌');
      }
    });
    cliente.requestAccessToken();
  }).catch(e => {
    toast('No se pudo cargar Google: ' + e.message);
  });
}

async function desconectarGoogle() {
  if (!confirm('¿Desconectar Google Calendar? Los eventos que ya estaban no se borran.')) return;

  // Le pedimos a Google que revoque el acceso.
  const g = leerGoogle();
  if (g && g.token) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-formencoded' },
        body: new URLSearchParams({ token: g.token }).toString()
      });
    } catch (e) { /* si falla, seguimos igual */ }
  }

  borrarGoogle();
  pintarEstadoGoogle({ configurado: true, conectado: false });
  toast('Desconectado de Google Calendar');
}

/* --- Hablar con la API de Google ------------------------------- */

async function tokenGoogle() {
  const g = leerGoogle();
  if (!g || !g.token) return null;
  if (g.expira && Date.now() < g.expira - 60000) return g.token;
  return null;   // vencido: hay que volver a pedir permiso
}

/* Pide un token nuevo (abre la ventana de Google si hace falta). */
function renovarGoogle() {
  return new Promise((resolve) => {
    cargarGIS().then(oauth2 => {
      const cliente = oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPE,
        callback: (resp) => {
          if (resp.error) { resolve(null); return; }
          guardarGoogle({
            token: resp.access_token,
            expira: Date.now() + (resp.expires_in || 3600) * 1000
          });
          resolve(resp.access_token);
        },
        error_callback: () => resolve(null)
      });
      cliente.requestAccessToken();
    }).catch(() => resolve(null));
  });
}

/* Un pedido a la API de Google con el token. Si el token está
   vencido, pide uno nuevo y reintenta una vez. */
async function pedirGoogle(ruta, opciones = {}) {
  let token = await tokenGoogle();

  if (!token) {
    token = await renovarGoogle();
    if (!token) throw new Error('SIN_TOKEN');
  }

  const r = await fetch(GOOGLE_API + ruta, {
    ...opciones,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(opciones.headers || {})
    }
  });

  // 401 = el token venció justo ahora. Pedimos otro y reintentamos.
  if (r.status === 401) {
    const nuevo = await renovarGoogle();
    if (!nuevo) throw new Error('SIN_TOKEN');
    const r2 = await fetch(GOOGLE_API + ruta, {
      ...opciones,
      headers: {
        'Authorization': 'Bearer ' + nuevo,
        'Content-Type': 'application/json',
        ...(opciones.headers || {})
      }
    });
    if (!r2.ok) throw new Error('HTTP ' + r2.status);
    return r2.status === 204 ? null : r2.json();
  }

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 120));
  }
  return r.status === 204 ? null : r.json();
}

/* --- El calendario "PiniStudio" ---------------------------------
   Con calendar.app.created podemos crear calendarios propios. Si
   el usuario ya tiene uno, lo reutilizamos. */
async function calendarioGoogle() {
  const guardado = leerGoogle();
  if (guardado && guardado.calendario) return guardado.calendario;

  /* Intentamos reutilizar un calendario "PiniStudio" que ya exista.
     Con el scope calendar.app.created Google responde 403 al listar
     calendarios ("insufficient authentication scopes"), así que ese
     camino casi nunca funciona: si falla, creamos uno nuevo y
     guardamos su id en este navegador. */
  try {
    const lista = await pedirGoogle('/users/me/calendarList?minAccessRole=owner&maxResults=250');
    const encontrado = (lista.items || []).find(c => c.summary === 'PiniStudio');
    if (encontrado) {
      guardado.calendario = encontrado.id;
      guardarGoogle(guardado);
      return encontrado.id;
    }
  } catch (e) {
    // 403 con este scope: no podemos listar. Sigue y creamos uno.
  }

  const nuevo = await pedirGoogle('/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: 'PiniStudio',
      description: 'Fechas de estudio creadas por PiniStudio 📚',
      timeZone: zonaHoraria()
    })
  });

  const g = leerGoogle();
  g.calendario = nuevo.id;
  guardarGoogle(g);
  return nuevo.id;
}

/* --- Sincronizar ------------------------------------------------
   Manda TODAS las fechas. Comparamos con lo que ya está en Google
   y creamos, actualizamos o borramos lo que corresponda. */
async function sincronizarGoogle(silencioso) {
  if (!estado.ajustes.googleConectado && !leerGoogle()) return;
  if (!estado.ajustes.googleSync && silencioso) return;

  try {
    const calId = await calendarioGoogle();
    const existentes = await pedirGoogle(
      '/calendars/' + encodeURIComponent(calId) + '/events?maxResults=2500&showDeleted=false'
    );

    // Índice de lo que ya está en Google, por nuestro id interno.
    const porId = {};
    for (const ev of (existentes.items || [])) {
      const pid = ev.extendedProperties && ev.extendedProperties.private
        ? ev.extendedProperties.private.pinistudioId : null;
      if (pid) porId[pid] = ev;
    }

    const vistos = {};
    let creados = 0, actualizados = 0, borrados = 0;

    for (const ev of estado.eventos) {
      if (!ev || !ev.id) continue;
      vistos[ev.id] = true;

      const g = eventoParaGoogle(ev);
      const cuerpo = {
        summary: g.summary,
        description: g.description,
        start: { dateTime: g.inicio, timeZone: zonaHoraria() },
        end: { dateTime: g.fin, timeZone: zonaHoraria() },
        extendedProperties: { private: { pinistudioId: ev.id } },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: g.min_popup },
            { method: 'email', minutes: g.min_email }
          ]
        }
      };

      const previo = porId[ev.id];
      if (previo) {
        await pedirGoogle(
          '/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(previo.id),
          { method: 'PATCH', body: JSON.stringify(cuerpo) }
        );
        actualizados++;
      } else {
        await pedirGoogle(
          '/calendars/' + encodeURIComponent(calId) + '/events',
          { method: 'POST', body: JSON.stringify(cuerpo) }
        );
        creados++;
      }
    }

    // Los que quedaron en Google pero ya no están en la app: se borran.
    for (const pid of Object.keys(porId)) {
      if (vistos[pid]) continue;
      await pedirGoogle(
        '/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(porId[pid].id),
        { method: 'DELETE' }
      );
      borrados++;
    }

    if (!silencioso) {
      toast(`Sincronizado ✅ ${creados} nuevos, ${actualizados} actualizados`);
    }
  } catch (e) {
    if (e.message === 'SIN_TOKEN') {
      estado.ajustes.googleConectado = false;
      guardar();
      pintarEstadoGoogle({ configurado: true, conectado: false });
      if (!silencioso) toast('Se venció la conexión con Google. Volvé a conectar 🔗');
      return;
    }
    if (!silencioso) toast('No se pudo sincronizar ❌ ' + e.message);
    else console.warn('Google Calendar:', e.message);
  }
}

/* --- Pintar el estado en Ajustes ------------------------------- */

function pintarEstadoGoogle(info) {
  const el = document.getElementById('estadoGoogle');
  if (!el) return;

  const btnCon = document.getElementById('btnGoogleConectar');
  const btnDes = document.getElementById('btnGoogleDesconectar');
  const btnSinc = document.getElementById('btnGoogleSincronizar');

  if (btnCon) btnCon.hidden = estado.ajustes.googleConectado;
  if (btnDes) btnDes.hidden = !estado.ajustes.googleConectado;
  if (btnSinc) btnSinc.hidden = !estado.ajustes.googleConectado;

  if (!info) {
    el.textContent = 'Comprobando…';
    if (!window._googleConsultado) {
      window._googleConsultado = true;
      setTimeout(() => pintarEstadoGoogle({ configurado: true, conectado: !!leerGoogle() }), 0);
    }
    return;
  }

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('REEMPLAZAR')) {
    el.textContent = 'Falta el Client ID de Google en la app (ver GOOGLE-CALENDAR.md).';
    return;
  }
  if (estado.ajustes.googleConectado) {
    el.textContent = '✅ Conectado. Cada fecha que guardes se anota en tu Google Calendar.';
  } else {
    el.textContent = 'Conectá tu cuenta para que las fechas se anoten en Google Calendar.';
  }
}

/* ------------------------------------------------------------
   9) Eventos de la interfaz
   ------------------------------------------------------------ */

function conectar() {
  // ---- Materia activa (define a qué se le atribuye el tiempo) ----
  document.getElementById('selMateria').addEventListener('change', e => {
    estado.materiaActiva = e.target.value;
    guardar();
    render();
  });

  // Activar una materia haciendo clic en la fila
  document.getElementById('listaMaterias').addEventListener('click', e => {
    if (e.target.closest('[data-borrar-materia]')) return;   // el botón se encarga
    const fila = e.target.closest('[data-materia]');
    if (!fila) return;
    estado.materiaActiva = fila.dataset.materia;
    guardar();
    render();
  });

  // Borrar una materia
  document.getElementById('listaMaterias').addEventListener('click', e => {
    const btn = e.target.closest('[data-borrar-materia]');
    if (!btn) return;
    const id = btn.dataset.borrarMateria;
    const mat = materiaPorId(id);
    if (!confirm(`¿Borrar la materia "${mat ? mat.nombre : ''}"? Se pierde el tiempo registrado de ella.`)) return;
    estado.materias = estado.materias.filter(m => m.id !== id);
    for (const iso of Object.keys(estado.registro)) {
      delete estado.registro[iso][id];
      if (!Object.keys(estado.registro[iso]).length) delete estado.registro[iso];
    }
    if (estado.materiaActiva === id) estado.materiaActiva = estado.materias[0]?.id || null;
    guardar();
    render();
  });

  // Agregar una materia
  document.getElementById('formMateria').addEventListener('submit', e => {
    e.preventDefault();
    const nombre = document.getElementById('materiaNombre').value.trim();
    if (!nombre) return;
    const emoji = document.getElementById('materiaEmoji').value.trim() || '📚';
    const color = document.getElementById('materiaColor').value;
    const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    estado.materias.push({ id, nombre, emoji, color });
    estado.materiaActiva = id;
    guardar();
    document.getElementById('materiaNombre').value = '';
    document.getElementById('materiaEmoji').value = '';
    render();
    toast(`Materia "${nombre}" agregada ✅`);
  });

  // ---- Meta semanal ----
  document.getElementById('selMeta').addEventListener('change', e => {
    estado.ajustes.metaHorasSemana = Number(e.target.value);
    guardar();
    render();
    revisarMeta();
  });

  // ---- Meta diaria (cada usuario la cambia a su antojo) ----
  document.getElementById('inpMetaDia').addEventListener('change', e => {
    let valor = Number(e.target.value);
    if (!Number.isFinite(valor) || valor < 0) valor = 0;
    if (valor > 24) valor = 24;
    valor = Math.round(valor * 2) / 2;           // pasos de media hora
    estado.ajustes.metaHorasDia = valor;
    guardar();
    render();
    revisarMeta();
  });

  // ---- Período del gráfico de materias ----
  document.getElementById('selPeriodoMat').addEventListener('change', renderGraficoMaterias);

  // ---- Sumar tiempo a mano (por si estudiaste con la app cerrada) ----
  document.getElementById('formTiempo').addEventListener('submit', e => {
    e.preventDefault();
    const iso = document.getElementById('campoFecha').value;
    const materiaId = document.getElementById('tiempoMateria').value;
    const segundos = Number(document.getElementById('tiempoMinutos').value);
    if (!iso || !materiaId || !segundos) return;
    sumarTiempo(iso, materiaId, segundos);
    guardar();
    render();
    abrirDia(iso);
    revisarMeta();
    toast('Tiempo agregado ✅');
  });

  // ---- Instalación de la app (PWA) ----
  document.getElementById('btnInstalar').addEventListener('click', instalarApp);
  document.getElementById('btnInstalar2').addEventListener('click', instalarApp);
  document.getElementById('btnComoInstalar').addEventListener('click', mostrarComoInstalar);

  // ---- Google Calendar ----
  document.getElementById('btnGoogleConectar').addEventListener('click', conectarGoogle);
  document.getElementById('btnGoogleDesconectar').addEventListener('click', desconectarGoogle);
  document.getElementById('btnGoogleSincronizar').addEventListener('click', () => sincronizarGoogle(false));
  document.getElementById('optGoogleSync').addEventListener('change', e => {
    estado.ajustes.googleSync = e.target.checked; guardar();
  });
  // ---- Pausa "poné el agua para el mate" ----
  document.getElementById('btnMate').addEventListener('click', () => {
    if (enPausa()) terminarMate();
    else ponerElAgua();
  });
  document.getElementById('inpMinutosMate').addEventListener('change', e => {
    let valor = Number(e.target.value);
    if (!Number.isFinite(valor)) valor = 15;
    valor = Math.max(15, Math.min(180, Math.round(valor)));
    estado.ajustes.minutosMate = valor;
    guardar();
    renderMate();
  });

  // ---- Historial: clic en un mes para verlo en el calendario ----
  document.getElementById('historial').addEventListener('click', e => {
    const fila = e.target.closest('[data-mes]');
    if (!fila) return;
    const [y, m] = fila.dataset.mes.split('-').map(Number);
    mesVista = new Date(y, m - 1, 1);
    renderCalendario();
    const cal = document.getElementById('tituloMes');
    cal.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`Mostrando ${MESES[m - 1]} ${y}`);
  });

  // ---- Exportar las fechas al calendario del sistema (.ics) ----
  document.getElementById('btnExportarIcs').addEventListener('click', exportarIcs);

  // Navegación de meses
  document.getElementById('btnMesAnt').addEventListener('click', () => {
    mesVista = new Date(mesVista.getFullYear(), mesVista.getMonth() - 1, 1);
    renderCalendario();
  });
  document.getElementById('btnMesSig').addEventListener('click', () => {
    mesVista = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 1);
    renderCalendario();
  });

  // Clic en un día del calendario
  document.getElementById('calendario').addEventListener('click', e => {
    const celda = e.target.closest('.dia');
    if (celda) abrirDia(celda.dataset.fecha);
  });

  // Activar o desactivar el descanso de un día
  document.getElementById('btnToggleDescanso').addEventListener('click', e => {
    const iso = e.target.dataset.fecha;
    if (iso) alternarDescanso(iso);
  });

  // Marcar / desmarcar día como estudiado
  document.getElementById('btnToggleEstudio').addEventListener('click', e => {
    const iso = e.target.dataset.fecha;
    if (!iso) return;
    if (estado.dias[iso]) {
      delete estado.dias[iso];
      toast('Marca quitada');
    } else {
      estado.dias[iso] = true;
      toast('¡Día registrado! 🔥');
    }
    guardar();
    render();
    abrirDia(iso);
  });

  // Agregar evento
  document.getElementById('formEvento').addEventListener('submit', e => {
    e.preventDefault();
    const fecha = document.getElementById('campoFecha').value;
    const titulo = document.getElementById('campoTitulo').value.trim();
    const tipo = document.getElementById('campoTipo').value;
    const notas = document.getElementById('campoNotas').value.trim();
    const companero = document.getElementById('campoCompanero').value.trim();
    if (!titulo) return;

    estado.eventos.push({
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      fecha, titulo, tipo, companero, notas
    });
    guardar();
    render();
    abrirDia(fecha);
    toast('Fecha agregada ✅');
    // Si está conectado a Google, la anotamos allá también.
    if (estado.ajustes.googleConectado && estado.ajustes.googleSync) {
      sincronizarGoogle(true);
    }
  });

  // Al cambiar el tipo de fecha, mostramos el campo del compañero
  document.getElementById('campoTipo').addEventListener('change', actualizarCamposEvento);

  // Botón "+ Agregar fecha" (abre el modal del día de hoy)
  document.getElementById('btnNuevoEvento').addEventListener('click', () => {
    abrirDia(hoyISO());
  });

  // Eliminar evento (delegación: el botón se crea dinámicamente)
  document.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-borrar]');
    if (!btn) return;
    const id = btn.dataset.borrar;
    const ev = estado.eventos.find(x => x.id === id);
    estado.eventos = estado.eventos.filter(x => x.id !== id);
    guardar();
    render();
    if (ev && !document.getElementById('modalDia').hidden) abrirDia(ev.fecha);
    toast('Fecha eliminada');
    // La borramos también de Google Calendar.
    if (estado.ajustes.googleConectado && estado.ajustes.googleSync) {
      sincronizarGoogle(true);
    }
  });

  // Cerrar modales
  document.querySelectorAll('[data-cerrar]').forEach(b => {
    b.addEventListener('click', () => b.closest('.modal').hidden = true);
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.hidden = true; });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.hidden = true);
  });

  // Tema
  document.getElementById('btnTema').addEventListener('click', () => {
    estado.ajustes.tema = estado.ajustes.tema === 'oscuro' ? 'claro' : 'oscuro';
    guardar();
    renderTema();
  });

  // Ajustes
  document.getElementById('btnAjustes').addEventListener('click', abrirAjustes);
  document.getElementById('optAutoRegistro').addEventListener('change', e => {
    estado.ajustes.autoRegistro = e.target.checked; guardar();
  });
  document.getElementById('optFinesDeSemana').addEventListener('change', e => {
    estado.ajustes.finesDeSemana = e.target.checked; guardar(); render();
  });
  document.getElementById('optRecordatorio').addEventListener('change', e => {
    estado.ajustes.recordatorio = e.target.checked; guardar();
  });
  document.getElementById('optDiasAviso').addEventListener('change', e => {
    estado.ajustes.diasAviso = Number(e.target.value); guardar();
  });
  document.getElementById('optHoraAviso').addEventListener('change', e => {
    estado.ajustes.horaAviso = e.target.value; guardar();
  });
  document.getElementById('btnPermisoNotif').addEventListener('click', async () => {
    if (!('Notification' in window)) return toast('Este navegador no soporta notificaciones.');
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Notificaciones activadas ✅' : 'Permiso denegado');
    abrirAjustes();
  });

  // ---- Notificaciones push (con la app cerrada) ----
  document.getElementById('btnActivarPush').addEventListener('click', activarPush);
  document.getElementById('btnProbarNotif').addEventListener('click', probarNotificacion);
  document.getElementById('btnRegistrarServidor').addEventListener('click', registrarEnServidor);
  document.getElementById('inpServidorNotif').addEventListener('change', e => {
    estado.ajustes.servidorNotif = e.target.value.trim();
    guardar();
    pintarEstadoPush();
  });
  document.getElementById('btnBorrarTodo').addEventListener('click', () => {
    if (!confirm('Esto borra todos tus días estudiados y tus fechas. ¿Seguro?')) return;
    localStorage.removeItem(CLAVE);
    location.reload();
  });

  // Datos
  document.getElementById('btnExportar').addEventListener('click', exportarDatos);
  document.getElementById('btnImportar').addEventListener('click', () => {
    document.getElementById('archivoImportar').click();
  });
  document.getElementById('archivoImportar').addEventListener('change', e => {
    if (e.target.files[0]) importarDatos(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('btnDescargarApp').addEventListener('click', descargarCopiaApp);

  // Al volver a la pestaña, revisamos recordatorios y refrescamos el "hoy"
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { registrarHoy(); render(); revisarRecordatorios(); }
  });
}

/* ------------------------------------------------------------
   10) Arranque
   ------------------------------------------------------------ */

function iniciar() {
  conectar();

  // 0) Service Worker (notificaciones + app instalable + offline)
  registrarServiceWorker().then(reg => {
    if (reg) console.log('Service Worker listo');
    pintarEstadoInstalacion();
  });

  // 1) Reloj de horas (empieza a contar desde que se abre la app)
  iniciarReloj();

  // 2) Registro automático del día
  if (estado.ajustes.autoRegistro && registrarHoy()) {
    console.log('Día registrado automáticamente:', hoyISO());
  }

  // 3) Pintar todo
  render();
  pintarReloj();
  revisarMeta();

  // 4) Si la app estaba pausada (mate), seguimos la cuenta regresiva
  if (enPausa()) iniciarCuentaRegresiva();

  // 4) Avisos
  setTimeout(revisarRecordatorios, 800);
  setInterval(revisarRecordatorios, 60 * 60 * 1000);   // cada hora

  // 5) Google Calendar: vemos si hay una cuenta conectada y avisamos
  //    si recién volvimos de la pantalla de permisos de Google.
  const g = leerGoogle();
  estado.ajustes.googleConectado = !!g;
  pintarEstadoGoogle({ configurado: true, conectado: !!g });

  if (g && estado.ajustes.googleSync && estado.eventos.length) {
    // El token vence a la hora: si ya venció, sincronizarGoogle() lo
    // vuelve a pedir solo (Google abre la ventana de permiso).
    setTimeout(() => sincronizarGoogle(true), 1500);
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
