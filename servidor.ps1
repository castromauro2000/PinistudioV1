# =============================================================
#  Servidor local simple para desarrollo (sin instalar nada).
#  Uso:  powershell -ExecutionPolicy Bypass -File .\servidor.ps1
#  Luego abrí:  http://localhost:8080
# =============================================================

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$puerto = 8080
$log = Join-Path $raiz 'servidor.log'

$mapa = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
}

function Registrar($mensaje) {
  $linea = "[$(Get-Date -Format 'HH:mm:ss')] $mensaje"
  Add-Content -Path $log -Value $linea -Encoding UTF8
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$puerto/")
$listener.Start()
Registrar "Servidor escuchando en http://localhost:$puerto"

while ($listener.IsListening) {
  try {
    $contexto = $listener.GetContext()
    $ruta = $contexto.Request.Url.AbsolutePath
    if ($ruta -eq '/') { $ruta = '/index.html' }

    $archivo = Join-Path $raiz ($ruta.TrimStart('/').Replace('/', '\'))

    # Sin caché: al guardar un archivo y recargar, siempre vemos lo último.
    try {
      $contexto.Response.Headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    } catch { Registrar "No se pudo setear Cache-Control: $($_.Exception.Message)" }

    if (Test-Path $archivo -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($archivo).ToLower()
      $tipo = if ($mapa.ContainsKey($ext)) { $mapa[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($archivo)

      $contexto.Response.ContentType = $tipo
      $contexto.Response.ContentLength64 = $bytes.Length
      $contexto.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      Registrar "200 $ruta ($($bytes.Length) bytes)"
    } else {
      $cuerpo = [System.Text.Encoding]::UTF8.GetBytes("404 - no encontrado: $ruta")
      $contexto.Response.StatusCode = 404
      $contexto.Response.ContentType = 'text/plain; charset=utf-8'
      $contexto.Response.ContentLength64 = $cuerpo.Length
      $contexto.Response.OutputStream.Write($cuerpo, 0, $cuerpo.Length)
      Registrar "404 $ruta"
    }
    $contexto.Response.Close()
  } catch {
    Registrar "ERROR: $($_.Exception.Message)"
    try { $contexto.Response.Abort() } catch {}
  }
}

$listener.Stop()
Registrar "Servidor detenido"
