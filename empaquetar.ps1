# =============================================================
#  EMPAQUETADOR — crea una versión de un solo archivo
#  (plan-estudio.html) que se puede compartir y abrir con doble clic.
#
#  Uso:  powershell -ExecutionPolicy Bypass -File .\empaquetar.ps1
#
#  OJO: el reemplazo se hace con un MatchEvaluator (scriptblock) y no
#  con -replace "normal", porque .NET interpreta los $ del texto de
#  reemplazo (por ejemplo los ${...} de las plantillas de JavaScript)
#  como grupos de captura.
# =============================================================

$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path

function Leer-UTF8($ruta) {
  return [System.IO.File]::ReadAllText($ruta, [System.Text.Encoding]::UTF8)
}

$html = Leer-UTF8 (Join-Path $base 'index.html')
$css  = Leer-UTF8 (Join-Path $base 'styles.css')
$js   = Leer-UTF8 (Join-Path $base 'app.js')

# --- Reemplazos literales (MatchEvaluator = texto sin interpretación) ---
$html = [regex]::Replace(
  $html,
  '(?s)<link rel="stylesheet" href="styles\.css(?:\?v=\d+)?">',
  { param($m) "<style>`r`n" + $css + "`r`n</style>" }
)

$html = [regex]::Replace(
  $html,
  '(?s)<script src="app\.js(?:\?v=\d+)?"></script>',
  { param($m) "<script>`r`n" + $js + "`r`n</script>" }
)

$salida = Join-Path $base 'pinistudio.html'
[System.IO.File]::WriteAllText($salida, $html, (New-Object System.Text.UTF8Encoding $false))

$peso = [math]::Round((Get-Item $salida).Length / 1KB, 1)
Write-Host "Listo -> $salida ($peso KB)"
Write-Host "Compartilo como archivo: pinistudio.html"

# --- Control: verificar que las plantillas de JS sobrevivieron ---
$plantillas = ([regex]::Matches($html, '\$\{')).Count
Write-Host "Plantillas \${...} en el archivo final: $plantillas (si es 0, algo se rompio)"
