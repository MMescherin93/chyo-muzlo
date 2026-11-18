# Запуск «Чьё музло?!»: поднимает локальный сервер и открывает браузер.
# Ярлык запускает этот скрипт через powershell -ExecutionPolicy Bypass.

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location -LiteralPath $root

$port = 8080
$url  = "http://localhost:$port"

# Проверяем именно TCP-порт: Invoke-WebRequest в PowerShell 5.1 умеет
# зависать на автоопределении прокси, поэтому им не пользуемся.
function Test-Server {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect('127.0.0.1', $port, $null, $null)
    if (-not $iar.AsyncWaitHandle.WaitOne(800)) { return $false }
    $client.EndConnect($iar)
    return $true
  } catch {
    return $false
  } finally {
    try { $client.Close() } catch { }
  }
}

if (-not (Test-Server)) {
  # Соберёт приложение и запустит сервер; окно остаётся открытым (Ctrl+C — стоп).
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm run host' -WorkingDirectory $root

  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline -and -not (Test-Server)) {
    Start-Sleep -Milliseconds 700
  }
}

if (Test-Server) {
  if (-not $env:MUZLO_NO_BROWSER) {
    Start-Process $url
  }
} else {
  Write-Host ''
  Write-Host 'Не удалось запустить сервер «Чьё музло?!».' -ForegroundColor Red
  Write-Host 'Открой терминал в папке проекта и выполни: npm run host'
  Read-Host 'Enter — закрыть'
}
