@echo off
setlocal
title Kill All Frontnback Dev Servers

echo.
echo ==========================================
echo   Kill ALL Frontnback Dev Servers
echo ==========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = 3002,3003,3004,3005,5000,5001,5173,5174,5175,8000,8001,8080,8081,8088,8090,9000,9001;" ^
  "$serverNames = 'node.exe','electron.exe','python.exe','pythonw.exe','bun.exe','deno.exe','php.exe','ruby.exe','java.exe','javaw.exe','dotnet.exe','go.exe';" ^
  "$processes = Get-CimInstance Win32_Process | Where-Object { $serverNames -contains $_.Name };" ^
  "$processIndex = @{}; foreach ($proc in $processes) { $processIndex[$proc.ProcessId] = $proc };" ^
  "$listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {" ^
  "  ($ports -contains $_.LocalPort) -and $processIndex.ContainsKey($_.OwningProcess)" ^
  "};" ^
  "if (-not $listening) {" ^
  "  Write-Host 'No matching frontend/backend dev ports are listening.' -ForegroundColor Yellow;" ^
  "  exit 0" ^
  "}" ^
  "Write-Host 'Found listening ports:' -ForegroundColor Cyan;" ^
  "  $listening | Sort-Object LocalPort | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize;" ^
  "$targetPids = $listening.OwningProcess | Sort-Object -Unique;" ^
  "Write-Host '';" ^
  "Write-Host 'Processes to kill:' -ForegroundColor Cyan;" ^
  "$processes | Where-Object { $targetPids -contains $_.ProcessId } | Select-Object ProcessId, Name, CommandLine | Format-Table -AutoSize;" ^
  "foreach ($targetPid in $targetPids) {" ^
  "  try {" ^
  "    Stop-Process -Id $targetPid -Force -ErrorAction Stop;" ^
  "    Write-Host ('Killed PID ' + $targetPid) -ForegroundColor Green;" ^
  "  } catch {" ^
  "    Write-Host ('Failed to kill PID ' + $targetPid + ': ' + $_.Exception.Message) -ForegroundColor Red;" ^
  "  }" ^
  "}" ^
  "Start-Sleep -Milliseconds 700;" ^
  "$remaining = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {" ^
  "  ($ports -contains $_.LocalPort) -and $processIndex.ContainsKey($_.OwningProcess)" ^
  "} | Sort-Object LocalPort;" ^
  "if ($remaining) {" ^
  "  Write-Host '';" ^
  "  Write-Host 'Ports still listening after cleanup:' -ForegroundColor Yellow;" ^
  "  $remaining | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize;" ^
  "} else {" ^
  "  Write-Host '';" ^
  "  Write-Host 'All matching frontend/backend dev ports are clear.' -ForegroundColor Green;" ^
  "}"

echo.
pause
endlocal
