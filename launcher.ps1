# Запуск «Чьё музло?!»: поднимает локальный сервер и открывает лобби.
# Ярлык запускает этот скрипт через powershell -ExecutionPolicy Bypass.

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location -LiteralPath $root

$port = 8080
$url  = "http://localhost:$port"

# Проверяем именно TCP-порт: Invoke-WebRequest в PowerShell 5.1 умеет
# зависать на автоопределении прокси, поэтому им не пользуемся.
function Get-ServerPid {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -First 1
    return $conn.OwningProcess
  } catch {
    return $null
  }
}

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

# Если на порту висит СТАРЫЙ экземпляр нашего сервера — перезапускаем,
# чтобы подхватить свежую сборку приложения.
$existingPid = Get-ServerPid
if ($existingPid) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$existingPid" -ErrorAction SilentlyContinue
  if ($proc -and $proc.CommandLine -and $proc.CommandLine -match 'server[\\/]index\.mjs') {
    Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 700
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
