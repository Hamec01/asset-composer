@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Asset Composer - Fix Preinstall and Start

set "ROOT=%~dp0"
set "FRONT_PORT=5173"
set "BACK_PORT=3001"
set "FRONT_URL=http://localhost:%FRONT_PORT%"
set "BACK_URL=http://localhost:%BACK_PORT%"

cd /d "%ROOT%"

echo.
echo ============================================================
echo   ASSET COMPOSER - FIX WINDOWS PREINSTALL
echo ============================================================
echo   Project: %ROOT%
echo ============================================================
echo.

if not exist "%ROOT%package.json" (
  echo [ERROR] package.json was not found.
  echo Put this BAT file directly in E:\vectoreditor
  pause
  exit /b 1
)

if not exist "%ROOT%pnpm-workspace.yaml" (
  echo [ERROR] pnpm-workspace.yaml was not found.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  pause
  exit /b 1
)

where corepack >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Corepack was not found.
  pause
  exit /b 1
)

echo [1/5] Backing up package.json...
if not exist "%ROOT%package.json.before-windows-fix.bak" (
  copy /Y "%ROOT%package.json" "%ROOT%package.json.before-windows-fix.bak" >nul
)

echo [2/5] Creating a cross-platform preinstall script...
if not exist "%ROOT%scripts" mkdir "%ROOT%scripts"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$bytes=[Convert]::FromBase64String('Y29uc3QgZnMgPSByZXF1aXJlKCJub2RlOmZzIik7Cgpmb3IgKGNvbnN0IGZpbGUgb2YgWyJwYWNrYWdlLWxvY2suanNvbiIsICJ5YXJuLmxvY2siXSkgewogIHRyeSB7CiAgICBmcy5ybVN5bmMoZmlsZSwgeyBmb3JjZTogdHJ1ZSB9KTsKICB9IGNhdGNoIHsKICAgIC8vIElnbm9yZSBjbGVhbnVwIGVycm9yczsgcG5wbSBpdHNlbGYgd2lsbCByZXBvcnQgcmVhbCBpbnN0YWxsIGZhaWx1cmVzLgogIH0KfQoKY29uc3QgdXNlckFnZW50ID0gcHJvY2Vzcy5lbnYubnBtX2NvbmZpZ191c2VyX2FnZW50IHx8ICIiOwppZiAoIXVzZXJBZ2VudC5zdGFydHNXaXRoKCJwbnBtLyIpKSB7CiAgY29uc29sZS5lcnJvcigiVXNlIHBucG0gaW5zdGVhZCIpOwogIHByb2Nlc3MuZXhpdCgxKTsKfQo=');" ^
  "[IO.File]::WriteAllBytes((Join-Path $env:ROOT 'scripts\preinstall.cjs'),$bytes)"
if errorlevel 1 (
  echo [ERROR] Could not create scripts\preinstall.cjs
  pause
  exit /b 1
)

echo [3/5] Replacing the Unix-only root preinstall command...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p=Join-Path $env:ROOT 'package.json';" ^
  "$raw=[IO.File]::ReadAllText($p);" ^
  "$pattern='(?m)^(\s*)""preinstall""\s*:\s*.*,$';" ^
  "$replacement='$1""preinstall"": ""node scripts/preinstall.cjs"","';" ^
  "$fixed=[regex]::Replace($raw,$pattern,$replacement);" ^
  "if($fixed -eq $raw){throw 'The preinstall line was not found or was already changed unexpectedly.'};" ^
  "[IO.File]::WriteAllText($p,$fixed,(New-Object Text.UTF8Encoding($false)))"
if errorlevel 1 (
  echo.
  echo [ERROR] package.json could not be patched.
  echo Open package.json and replace the preinstall script manually with:
  echo "preinstall": "node scripts/preinstall.cjs",
  pause
  exit /b 1
)

echo [4/5] Completing the Windows pnpm installation...
echo.
call corepack pnpm install --force --no-frozen-lockfile
if errorlevel 1 (
  echo.
  echo [ERROR] pnpm install still failed.
  echo The cross-platform preinstall patch was written successfully.
  echo Review the new error above.
  pause
  exit /b 1
)

echo.
echo [5/5] Starting backend and frontend...
echo.

start "Asset Composer Backend :%BACK_PORT%" cmd /k "cd /d ""%ROOT%"" && set ""PORT=%BACK_PORT%"" && set ""NODE_ENV=development"" && echo Building backend... && call corepack pnpm --filter @workspace/api-server build && echo. && echo Starting backend at %BACK_URL% && call corepack pnpm --filter @workspace/api-server start"

start "Asset Composer Frontend :%FRONT_PORT%" cmd /k "cd /d ""%ROOT%"" && set ""PORT=%FRONT_PORT%"" && set ""NODE_ENV=development"" && echo Starting frontend at %FRONT_URL% && call corepack pnpm --filter @workspace/asset-composer dev"

echo Waiting for the frontend...
timeout /t 8 /nobreak >nul
start "" "%FRONT_URL%"

echo.
echo ============================================================
echo   PATCHED AND STARTED
echo ============================================================
echo   Frontend: %FRONT_URL%
echo   Backend:  %BACK_URL%
echo.
echo   Keep both terminal windows open.
echo ============================================================
echo.
timeout /t 3 /nobreak >nul
endlocal
exit /b 0
