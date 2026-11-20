# =============================================================
#  Desplegar PiniStudio en Vercel (desde la API, sin Node)
#  Uso:  powershell -ExecutionPolicy Bypass -File .\desplegar-vercel.ps1
#
#  Necesita un token de Vercel. Opciones para giveaway:
#    1) variable de entorno:  $env:VERCEL_TOKEN = "tu_token"
#    2) archivo:  .vercel-token.txt  (en este mismo directorio)
#
#  El token se crea en: https://vercel.com/account/tokens
# =============================================================

param(
  [string]$Token = $env:VERCEL_TOKEN,
  [string]$Nombre = 'pinistudio',
  [string]$Carpeta = 'publicar'
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$carpetaFull = Join-Path $raiz $Carpeta

# --- 1) Token ---
if (-not $Token) {
  $archivoToken = Join-Path $raiz '.vercel-token.txt'
  if (Test-Path $archivoToken) {
    $Token = ([System.IO.File]::ReadAllText($archivoToken)).Trim()
  }
}
if (-not $Token) {
  Write-Host ''
  Write-Host '  FALTA EL TOKEN' -ForegroundColor Red
  Write-Host ''
  Write-Host '  1) Entra a https://vercel.com/account/tokens' -ForegroundColor Yellow
  Write-Host '  2) Crear Token (nombre: "pinistudio")' -ForegroundColor Yellow
  Write-Host '  3) Pegalo en un archivo llamado .vercel-token.txt' -ForegroundColor Yellow
  Write-Host '     en esta carpeta, o setealo asi:' -ForegroundColor Yellow
  Write-Host '     $env:VERCEL_TOKEN = "pegar_aqui"' -ForegroundColor White
  Write-Host ''
  exit 1
}

if (-not (Test-Path $carpetaFull)) {
  Write-Host "No existe la carpeta $Carpeta" -ForegroundColor Red
  exit 1
}

# --- 2) Recolectar archivos ---
Write-Host '  Armando el paquete...' -ForegroundColor Cyan
$files = @()

Get-ChildItem $carpetaFull -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($carpetaFull.Length + 1).Replace('\', '/')
  if ($_.Extension -eq '.png') {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    $files += @{ file = $rel; data = [Convert]::ToBase64String($bytes); encoding = 'base64' }
  } else {
    $texto = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
    $files += @{ file = $rel; data = $texto; encoding = 'utf-8' }
  }
}

# vercel.json: sitio estatico + el Service Worker siempre fresco
$vercelJson = @'
{
  "version": 2,
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    { "source": "/sw.js", "headers": [ { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" } ] },
    { "source": "/manifest.json", "headers": [ { "key": "Content-Type", "value": "application/manifest+json" } ] }
  ]
}
'@
$files += @{ file = 'vercel.json'; data = $vercelJson; encoding = 'utf-8' }

Write-Host "  $($files.Count) archivos listos" -ForegroundColor DarkGray

# --- 3) Crear el deployment ---
$body = @{
  name       = $Nombre
  files      = $files
  target     = 'production'
  projectSettings = @{ framework = $null; outputDirectory = $null }
} | ConvertTo-Json -Depth 8 -Compress

Write-Host '  Subiendo a Vercel...' -ForegroundColor Cyan

try {
  $resp = Invoke-WebRequest -Uri 'https://api.vercel.com/v13/deployments' -Method POST `
    -Headers @{ Authorization = "Bearer $Token" } `
    -ContentType 'application/json' -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
    -UseBasicParsing -TimeoutSec 180
} catch {
  Write-Host ''
  Write-Host "  ERROR al desplegar: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.Exception.Response) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "  detalle: $($reader.ReadToEnd())" -ForegroundColor DarkRed
  }
  exit 1
}

$dep = $resp.Content | ConvertFrom-Json

Write-Host ''
Write-Host '  =============================================' -ForegroundColor Green
Write-Host '   DESPLIEGUE OK' -ForegroundColor Green
Write-Host ''
Write-Host "   $($dep.url)" -ForegroundColor Cyan
Write-Host ''
Write-Host '  =============================================' -ForegroundColor Green
Write-Host ''
Write-Host "  Estado: $($dep.readyState)" -ForegroundColor DarkGray

# --- 4) Alias fijo (https://<nombre>.vercel.app) ---
try {
  $aliasBody = @{ alias = $Nombre; deploymentId = $dep.id } | ConvertTo-Json -Compress
  $r2 = Invoke-WebRequest -Uri 'https://api.vercel.com/v13/aliases' -Method POST `
    -Headers @{ Authorization = "Bearer $Token" } `
    -ContentType 'application/json' -Body $aliasBody -UseBasicParsing -TimeoutSec 60
  $al = ($r2.Content | ConvertFrom-Json).alias
  Write-Host "  Alias fijo: https://$al" -ForegroundColor Green
} catch {
  Write-Host '  (no se pudo crear el alias fijo: quiza ya existe ese nombre)' -ForegroundColor DarkYellow
}

# --- 5) Dejar el sitio PUBLICO (sin login de Vercel) ---
# Por defecto Vercel protege los despliegues con "Vercel Authentication",
# que hace que los tengan que iniciar sesion. Lo desactivamos.
try {
  $projId = $dep.projectId
  $hJson = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
  $null = Invoke-WebRequest -Uri "https://api.vercel.com/v9/projects/$projId" -Method PATCH `
    -Headers $hJson -Body '{"ssoProtection":null}' -UseBasicParsing -TimeoutSec 60
  Write-Host '  Sitio publico (sin login) OK' -ForegroundColor Green
} catch {
  Write-Host '  (aviso: no se pudo desactivar el login; el sitio podria pedir iniciar sesion)' -ForegroundColor DarkYellow
}

Write-Host ''
Write-Host '  Mandale ese link por WhatsApp.' -ForegroundColor Yellow
Write-Host ''
