@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Asset Composer - Repair and Start

rem ============================================================
rem Asset Composer Windows repair + launcher
rem Put this file in: E:\vectoreditor
rem ============================================================

set "ROOT=%~dp0"
set "FRONT_PORT=5173"
set "BACK_PORT=3001"
set "FRONT_URL=http://localhost:%FRONT_PORT%"
set "BACK_URL=http://localhost:%BACK_PORT%"
set "NEED_REPAIR=0"

cd /d "%ROOT%"

echo.
echo ============================================================
echo   ASSET COMPOSER - WINDOWS REPAIR AND START
echo ============================================================
echo   Project:  %ROOT%
echo   Frontend: %FRONT_URL%
echo   Backend:  %BACK_URL%
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
  echo [ERROR] Node.js was not found in PATH.
  pause
  exit /b 1
)

where corepack >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Corepack was not found.
  echo Install Node.js 22 LTS or install Corepack, then try again.
  pause
  exit /b 1
)

rem Use Git Bash for the existing Unix-style root preinstall script.
if exist "%ProgramFiles%\Git\bin\bash.exe" (
  set "npm_config_script_shell=%ProgramFiles%\Git\bin\bash.exe"
) else if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" (
  set "npm_config_script_shell=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
) else (
  where bash >nul 2>&1
  if not errorlevel 1 (
    for /f "delims=" %%B in ('where bash') do if not defined npm_config_script_shell set "npm_config_script_shell=%%B"
  )
)

if not defined npm_config_script_shell (
  echo [WARNING] Git Bash was not found.
  echo The project has a Unix-style preinstall script and installation may fail.
  echo Install Git for Windows with Git Bash if the next step fails.
  echo.
)

rem The Replit lockfile intentionally excluded Windows native packages.
if exist "%ROOT%pnpm-lock.yaml" (
  findstr /R /C:"win32-x64.*: '-'" "%ROOT%pnpm-lock.yaml" >nul 2>&1
  if not errorlevel 1 set "NEED_REPAIR=1"
)

if not exist "%ROOT%node_modules\.pnpm" set "NEED_REPAIR=1"

if exist "%ROOT%node_modules\.pnpm" (
  dir /b "%ROOT%node_modules\.pnpm\@rollup+rollup-win32-x64-msvc@*" >nul 2>&1
  if errorlevel 1 set "NEED_REPAIR=1"

  dir /b "%ROOT%node_modules\.pnpm\@esbuild+win32-x64@*" >nul 2>&1
  if errorlevel 1 set "NEED_REPAIR=1"
)

if "%NEED_REPAIR%"=="1" (
  echo [REPAIR] Windows native dependencies are missing.
  echo [REPAIR] This is expected after copying node_modules from Replit/Linux.
  echo.

  if exist "%ROOT%pnpm-lock.yaml" (
    if not exist "%ROOT%.local\backup" mkdir "%ROOT%.local\backup" >nul 2>&1
    copy /Y "%ROOT%pnpm-lock.yaml" "%ROOT%.local\backup\pnpm-lock.replit-backup.yaml" >nul

    echo [REPAIR] Removing Replit platform-exclusion overrides from pnpm-lock.yaml...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$p = Join-Path $env:ROOT 'pnpm-lock.yaml';" ^
      "$lines = Get-Content -LiteralPath $p;" ^
      "$fixed = $lines | Where-Object { $_ -notmatch '^\s{2}.+:\s+''-''\s*$' };" ^
      "[System.IO.File]::WriteAllLines($p, $fixed, (New-Object System.Text.UTF8Encoding($false)))"
    if errorlevel 1 (
      echo [ERROR] Could not update pnpm-lock.yaml.
      pause
      exit /b 1
    )
  )

  if exist "%ROOT%node_modules" (
    echo [REPAIR] Removing incompatible node_modules...
    rmdir /s /q "%ROOT%node_modules"
    if exist "%ROOT%node_modules" (
      echo [ERROR] node_modules could not be removed.
      echo Close all Node, Vite, backend and editor terminal windows, then run this file again.
      pause
      exit /b 1
    )
  )

  echo [REPAIR] Installing clean Windows dependencies with pnpm...
  echo This can take several minutes.
  echo.
  call corepack pnpm install --force --no-frozen-lockfile
  if errorlevel 1 (
    echo.
    echo [ERROR] pnpm install failed.
    echo Review the error above. Do not run npm install in this workspace.
    pause
    exit /b 1
  )

  echo.
  echo [REPAIR] Dependency repair completed.
  echo.
) else (
  echo [OK] Windows native dependencies appear to be installed.
  echo.
)

rem Verify the key native packages after repair.
dir /b "%ROOT%node_modules\.pnpm\@rollup+rollup-win32-x64-msvc@*" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Rollup Windows binary is still missing.
  echo Run this BAT again after closing every Node terminal.
  pause
  exit /b 1
)

dir /b "%ROOT%node_modules\.pnpm\@esbuild+win32-x64@*" >nul 2>&1
if errorlevel 1 (
  echo [ERROR] esbuild Windows binary is still missing.
  echo Run this BAT again after closing every Node terminal.
  pause
  exit /b 1
)

echo [1/2] Starting backend...
start "Asset Composer Backend :%BACK_PORT%" cmd /k "cd /d ""%ROOT%"" && set ""PORT=%BACK_PORT%"" && set ""NODE_ENV=development"" && set ""npm_config_script_shell=%npm_config_script_shell%"" && echo Building backend... && call corepack pnpm --filter @workspace/api-server build && echo. && echo Starting backend on %BACK_URL% && call corepack pnpm --filter @workspace/api-server start"

echo [2/2] Starting frontend...
start "Asset Composer Frontend :%FRONT_PORT%" cmd /k "cd /d ""%ROOT%"" && set ""PORT=%FRONT_PORT%"" && set ""NODE_ENV=development"" && set ""npm_config_script_shell=%npm_config_script_shell%"" && echo Starting frontend on %FRONT_URL% && call corepack pnpm --filter @workspace/asset-composer dev"

echo.
echo Waiting for the frontend...
timeout /t 8 /nobreak >nul

start "" "%FRONT_URL%"

echo.
echo ============================================================
echo   STARTED
echo ============================================================
echo   Keep both terminal windows open.
echo   Frontend: %FRONT_URL%
echo   Backend:  %BACK_URL%
echo ============================================================
echo.
timeout /t 3 /nobreak >nul
endlocal
exit /b 0
