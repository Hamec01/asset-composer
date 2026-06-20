@echo off
setlocal
title Asset Composer Frontnback Kill

set "PROJECT_ROOT=D:\asset-composer"

echo.
echo ==========================================
echo   Asset Composer Frontnback Kill
echo ==========================================
echo   Project root: %PROJECT_ROOT%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$projectRoot = '%PROJECT_ROOT%';" ^
  "$targets = Get-CimInstance Win32_Process | Where-Object {" ^
  "  ($_.Name -eq 'node.exe' -or $_.Name -eq 'electron.exe') -and" ^
  "  ($_.CommandLine -like ('*' + $projectRoot + '*') -or $_.ExecutablePath -like ('*' + $projectRoot + '*'))" ^
  "};" ^
  "if (-not $targets) {" ^
  "  Write-Host 'No Asset Composer frontend/backend processes found.' -ForegroundColor Yellow;" ^
  "  exit 0" ^
  "}" ^
  "Write-Host 'Found processes:' -ForegroundColor Cyan;" ^
  "$targets | Sort-Object ProcessId | Select-Object ProcessId, Name, CommandLine | Format-Table -AutoSize;" ^
  "$targetPids = $targets.ProcessId | Sort-Object -Unique;" ^
  "foreach ($targetPid in $targetPids) {" ^
  "  try {" ^
  "    Stop-Process -Id $targetPid -Force -ErrorAction Stop;" ^
  "    Write-Host ('Killed PID ' + $targetPid) -ForegroundColor Green;" ^
  "  } catch {" ^
  "    Write-Host ('Failed to kill PID ' + $targetPid + ': ' + $_.Exception.Message) -ForegroundColor Red;" ^
  "  }" ^
  "}" ^
  "Start-Sleep -Milliseconds 700;" ^
  "$ports = 3002,3003,3004,3005,5173,5174,5175;" ^
  "$listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort } | Sort-Object LocalPort;" ^
  "if ($listening) {" ^
  "  Write-Host '';" ^
  "  Write-Host 'Ports still listening after cleanup:' -ForegroundColor Yellow;" ^
  "  $listening | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize;" ^
  "} else {" ^
  "  Write-Host '';" ^
  "  Write-Host 'Asset Composer frontend/backend ports are clear.' -ForegroundColor Green;" ^
  "}"

echo.
pause
endlocal
