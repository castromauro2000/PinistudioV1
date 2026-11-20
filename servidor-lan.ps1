# =============================================================
#  Servidor para la RED LOCAL (Wi-Fi) - sin permisos de administrador
#  Uso:  powershell -ExecutionPolicy Bypass -File .\servidor-lan.ps1
#
#  Con esto, cualquier persona que este en tu misma Wi-Fi puede
#  abrir la app en su celular o compu entrando a:
#      http://TU-IP:8090
#  (tu IP aparece en la consola al arrancar)
# =============================================================

$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$puerto = 8090

$mapa = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.ics'  = 'text/calendar; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.ico'  = 'image/x-icon'
  '.zip'  = 'application/zip'
}

# IP local para mostrar
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "  PiniStudio en la red local" -ForegroundColor Green
Write-Host "  http://${ip}:$puerto" -ForegroundColor Cyan
Write-Host "  Pasale ese link a tus amigos (misma Wi-Fi)." -ForegroundColor Yellow
Write-Host "  Ctrl+C para cortar." -ForegroundColor DarkGray
Write-Host ""

$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $puerto)
$listener.Start()

while ($true) {
  try {
    $cliente = $listener.AcceptTcpClient()
    $stream = $cliente.GetStream()
    $lector = New-Object System.IO.StreamReader($stream)

    $linea = $lector.ReadLine()
    if (-not $linea) { $cliente.Close(); continue }

    # leemos el resto de las cabeceras hasta la linea vacia
    while (($h = $lector.ReadLine()) -ne '' -and $null -ne $h) { }

    $partes = $linea -split ' '
    $ruta = if ($partes.Count -ge 2) { $partes[1] } else { '/' }
    $ruta = $ruta -replace '\?.*$', ''          # sin query string
    if ($ruta -eq '/') { $ruta = '/index.html' }

    $archivo = Join-Path $raiz ($ruta.TrimStart('/').Replace('/', '\'))

    if (Test-Path $archivo -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($archivo).ToLower()
      $tipo = if ($mapa.ContainsKey($ext)) { $mapa[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($archivo)

      $encabezado = "HTTP/1.1 200 OK`r`nContent-Type: $tipo`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
      $head = [System.Text.Encoding]::ASCII.GetBytes($encabezado)
      $stream.Write($head, 0, $head.Length)
      $stream.Write($bytes, 0, $bytes.Length)
      Write-Host "  200 $ruta ($([math]::Round($bytes.Length/1KB,1)) KB)  desde $($cliente.Client.RemoteEndPoint.Address)"
    } else {
      $cuerpo = [System.Text.Encoding]::UTF8.GetBytes("404 - no encontrado")
      $encabezado = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($cuerpo.Length)`r`nConnection: close`r`n`r`n"
      $head = [System.Text.Encoding]::ASCII.GetBytes($encabezado)
      $stream.Write($head, 0, $head.Length)
      $stream.Write($cuerpo, 0, $cuerpo.Length)
      Write-Host "  404 $ruta  desde $($cliente.Client.RemoteEndPoint.Address)"
    }

    $stream.Flush()
    $cliente.Close()
  } catch {
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
  }
}
