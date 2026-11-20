# =============================================================
#  REPARACION post-corrupcion
#  Un bug de PowerShell (arrays anidados aplanados) reemplazo
#  caracteres sueltos en algunos archivos. Este script revierte
#  cada cambio con un mapa explicito token -> token correcto.
#
#  app.js y styles.css:  'P' -> 'L'
#  servidor-lan.ps1:    'A' -> 'l'  y  'P' -> 'I'
#  worker-push.js y README.md: 'A' -> 'L'  y  'P' -> 'I'
# =============================================================

$ErrorActionPreference = 'Stop'
$p = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- caracteres acentuados (para no depender de la codificacion) ---
$i = [char]0xED   # i con acento
$o = [char]0xF3   # o con acento

function Restaurar($archivo, $pares) {
  $ruta = Join-Path $p $archivo
  $txt = [System.IO.File]::ReadAllText($ruta, [System.Text.Encoding]::UTF8)
  $antes = $txt

  # primero los tokens mas largos (para que no se pisen entre si)
  foreach ($par in ($pares | Sort-Object { -($_.f.Length) })) {
    $txt = $txt.Replace($par.f, $par.t)
  }

  if ($txt -ne $antes) {
    [System.IO.File]::WriteAllText($ruta, $txt, (New-Object System.Text.UTF8Encoding $false))
    "  reparado: $archivo ($($pares.Count) reglas)"
  } else {
    "  sin cambios: $archivo"
  }
}

Write-Host "Reparando..." -ForegroundColor Cyan

# ---------------- app.js ----------------
$mapaApp = @(
  @{ f = 'LLAN DE ESTUDIO';        t = 'PINISTUDIO' }
  @{ f = 'LINISTUDIO';             t = 'PINISTUDIO' }
  @{ f = 'VALID_LUBLIC_KEY';       t = 'VAPID_PUBLIC_KEY' }
  @{ f = 'DESCRILTION';            t = 'DESCRIPTION' }
  @{ f = 'DISLLAY';                t = 'DISPLAY' }
  @{ f = 'DTSTAML';                t = 'DTSTAMP' }
  @{ f = 'LRODID';                 t = 'PRODID' }
  @{ f = 'LUBLISH';                t = 'PUBLISH' }
  @{ f = 'Lanel';                  t = 'Panel' }
  @{ f = 'Lausa';                  t = 'Pausa' }
  @{ f = ('Ler' + $i + 'odo');     t = ('Per' + $i + 'odo') }
  @{ f = 'Lermiso';                t = 'Permiso' }
  @{ f = 'LiniStudio';             t = 'PiniStudio' }
  @{ f = 'Lintar';                 t = 'Pintar' }
  @{ f = 'Loner';                  t = 'Poner' }
  @{ f = 'Loniendo';               t = 'Poniendo' }
  @{ f = 'Lorcentaje';             t = 'Porcentaje' }
  @{ f = 'Lrimero';                t = 'Primero' }
  @{ f = 'Lrogreso';               t = 'Progreso' }
  @{ f = ('Lr' + $o + 'ximas');    t = ('Pr' + $o + 'ximas') }
  @{ f = ('Lr' + $o + 'ximos');    t = ('Pr' + $o + 'ximos') }
  @{ f = 'Lush';                   t = 'Push' }
  @{ f = 'Lor';                    t = 'Por' }
  @{ f = 'HTTL';                   t = 'HTTP' }
  @{ f = 'LOST';                   t = 'POST' }
  @{ f = 'ALI';                    t = 'API' }
  @{ f = 'activarLush';            t = 'activarPush' }
  @{ f = 'btnActivarLush';         t = 'btnActivarPush' }
  @{ f = 'btnLermisoNotif';        t = 'btnPermisoNotif' }
  @{ f = 'btnLrobarNotif';         t = 'btnProbarNotif' }
  @{ f = 'enLausa';                t = 'enPausa' }
  @{ f = 'estadoLorDefecto';       t = 'estadoPorDefecto' }
  @{ f = 'estadoLush';             t = 'estadoPush' }
  @{ f = 'eventosLroximos';        t = 'eventosProximos' }
  @{ f = 'materiaLorId';           t = 'materiaPorId' }
  @{ f = 'notaLermiso';            t = 'notaPermiso' }
  @{ f = 'pintarEstadoLush';       t = 'pintarEstadoPush' }
  @{ f = 'requestLermission';      t = 'requestPermission' }
  @{ f = 'segundosRestantesLausa'; t = 'segundosRestantesPausa' }
  @{ f = 'selLeriodoMat';          t = 'selPeriodoMat' }
  @{ f = 'valorLrevio';            t = 'valorPrevio' }
  @{ f = '-LT2H';                  t = '-PT2H' }
  @{ f = ("'-L' + diasAntes");     t = ("'-P' + diasAntes") }
)
Restaurar 'app.js' $mapaApp

# ---------------- styles.css ----------------
$mapaCss = @(
  @{ f = 'LLAN DE ESTUDIO'; t = 'PINISTUDIO' }
  @{ f = 'Laleta';          t = 'Paleta' }
  @{ f = 'mateLulso';       t = 'matePulso' }
)
Restaurar 'styles.css' $mapaCss

Write-Host "Listo." -ForegroundColor Green
