# =============================================================
#  Levanta PiniStudio con un link público (sin cuentas)
#  Uso:  powershell -ExecutionPolicy Bypass -File .\iniciar-tunel.ps1
#
#  Arranca el servidor local + un túnel de Cloudflare y te imprime
#  el link para compartir. NO hace falta ninguna cuenta.
#
#  Para que funcione hace falta cloudflared.exe. Si no está, lo
#  descarga solo (solo la primera vez).
# =============================================================

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$temp = Join-Path $env:TEMP 'opencode'
$exe = Join-Path $temp 'cloudflared.exe'
$puerto = 8090

# --- 1) cloudflared ---
if (-not (Test-Path $exe)) {
  Write-Host "Descargando cloudflared (solo la primera vez)..." -ForegroundColor Yellow
  New-Item -ItemType Directory -Path $temp -Force | Out-Null
  try {
    Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $exe -UseBasicParsing -TimeoutSec 180
  } catch {
    Write-Host "No se pudo descargar: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Descargalo a mano de: https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Yellow
    exit 1
  }
}

# --- 2) Servidor local ---
$existe = Get-NetTCPConnection -LocalPort $puerto -State Listen -ErrorAction SilentlyContinue
if (-not $existe) {
  Write-Host "Levantando el servidor local..." -ForegroundColor Cyan
  Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$raiz\servidor-lan.ps1`""
  Start-Sleep -Seconds 3
}

# --- 3) Túnel ---
Write-Host ""
Write-Host "  Levantando el tunel publico..." -ForegroundColor Cyan
Write-Host "  (dejalo abierta esta ventana mientras quieras compartir)" -ForegroundColor DarkGray
Write-Host ""

$log = Join-Path $temp 'tunel.log'
Remove-Item $log, "$log.err" -Force -ErrorAction SilentlyContinue

Start-Process -FilePath $exe -ArgumentList 'tunnel', '--url', "http://localhost:$puerto", '--no-autoupdate' `
  -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError "$log.err"

$url = $null
for ($i = 0; $i -lt 30 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path "$log.err") {
    $m = Select-String -Path "$log.err" -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}

if ($url) {
  Write-Host ""
  Write-Host "  =============================================" -ForegroundColor Green
  Write-Host "   PiniStudio esta en:" -ForegroundColor Green
  Write-Host ""
  Write-Host "   $url" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  =============================================" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Mandale ese link por WhatsApp. No hace falta cuenta." -ForegroundColor Yellow
  Write-Host "  Ojo: el link cambia cada vez que lo reinicies," -ForegroundColor DarkGray
  Write-Host "  y la compu tiene que quedar encendida." -ForegroundColor DarkGray
  Write-Host ""
} else {
  Write-Host "No se pudo obtener el link. Mirá $log.err" -ForegroundColor Red
}

Write-Host "  Ctrl+C para cortar." -ForegroundColor DarkGray
while ($true) { Start-Sleep -Seconds 5 }
