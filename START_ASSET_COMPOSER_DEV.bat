@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Asset Composer Dev Launcher

set "ROOT=%~dp0"
set "FRONT_PORT="
set "BACK_PORT="
set "FRONT_URL="
set "BACK_HEALTH="

cd /d "%ROOT%"

echo.
echo ============================================================
echo   ASSET COMPOSER - DEV LAUNCHER
echo ============================================================
echo   Project:  %ROOT%
echo   Frontend: %FRONT_URL%
echo   Backend:  %BACK_HEALTH%
echo ============================================================
echo.

if not exist "%ROOT%package.json" (
  echo [ERROR] package.json was not found.
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
  echo [ERROR] Node.js was not found in PATH.
  pause
  exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
  where corepack >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] pnpm and Corepack were not found.
    pause
    exit /b 1
  )
  call corepack enable
  if errorlevel 1 (
    echo [ERROR] Could not enable pnpm through Corepack.
    pause
    exit /b 1
  )
)

for /f %%P in ('powershell -NoProfile -Command "$p=5174; while (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue) { $p++ }; $p"') do set "FRONT_PORT=%%P"
for /f %%P in ('powershell -NoProfile -Command "$p=3002; while (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue) { $p++ }; $p"') do set "BACK_PORT=%%P"

set "FRONT_URL=http://localhost:%FRONT_PORT%"
set "BACK_HEALTH=http://localhost:%BACK_PORT%/api/healthz"

if not exist "%ROOT%node_modules\.pnpm" (
  echo [INFO] Installing dependencies...
  call pnpm install
  if errorlevel 1 (
    echo [ERROR] pnpm install failed.
    pause
    exit /b 1
  )
  echo.
)

echo [1/2] Starting backend on port %BACK_PORT%...
start "Asset Composer Backend :%BACK_PORT%" cmd /k "cd /d ""%ROOT%\scripts"" && set ""PORT=%BACK_PORT%"" && set ""NODE_ENV=development"" && echo Backend health: %BACK_HEALTH% && call pnpm exec tsx watch ..\artifacts\api-server\src\index.ts"

echo [2/2] Starting frontend on port %FRONT_PORT%...
start "Asset Composer Frontend :%FRONT_PORT%" cmd /k "cd /d ""%ROOT%"" && set ""NODE_ENV=development"" && echo Frontend URL: %FRONT_URL% && call pnpm --filter @workspace/asset-composer dev -- --port %FRONT_PORT%"

echo.
echo Waiting for the frontend...
timeout /t 6 /nobreak >nul

start "" "%FRONT_URL%"

echo.
echo ============================================================
echo   Started
echo ============================================================
echo   Keep both terminal windows open.
echo   Frontend: %FRONT_URL%
echo   Backend:  %BACK_HEALTH%
echo ============================================================
echo.
timeout /t 3 /nobreak >nul
endlocal
exit /b 0
