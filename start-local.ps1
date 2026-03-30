$port = 4173
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting Unknown Signal at http://127.0.0.1:$port"
Write-Host "Press Ctrl+C to stop."

Set-Location $root
python -m http.server $port
