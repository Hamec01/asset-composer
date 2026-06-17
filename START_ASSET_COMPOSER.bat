@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Asset Composer Launcher

rem ------------------------------------------------------------
rem Asset Composer local launcher
rem Place this file in the project root:
rem E:\vectoreditor\START_ASSET_COMPOSER.bat
rem ------------------------------------------------------------

set "ROOT=%~dp0"
set "FRONT_PORT=5173"
set "BACK_PORT=3001"
set "FRONT_URL=http://localhost:%FRONT_PORT%"
set "BACK_HEALTH=http://localhost:%BACK_PORT%/api/healthz"

cd /d "%ROOT%"

echo.
echo ============================================================
echo   ASSET COMPOSER - LOCAL DEVELOPMENT
echo ============================================================
echo   Project:  %ROOT%
echo   Frontend: %FRONT_URL%
echo   Backend:  %BACK_HEALTH%
echo ============================================================
echo.

rem Verify project root.
if not exist "%ROOT%package.json" (
    echo [ERROR] package.json was not found.
    echo Put this BAT file directly in E:\vectoreditor
    echo.
    pause
    exit /b 1
)

if not exist "%ROOT%pnpm-workspace.yaml" (
    echo [ERROR] pnpm-workspace.yaml was not found.
    echo This does not look like the Asset Composer workspace root.
    echo.
    pause
    exit /b 1
)

rem Verify Node.js.
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH.
    echo Install Node.js LTS, then reopen this file.
    echo.
    pause
    exit /b 1
)

rem Verify pnpm; try Corepack if pnpm is unavailable.
where pnpm >nul 2>&1
if errorlevel 1 (
    echo [INFO] pnpm was not found. Trying Corepack...
    where corepack >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Neither pnpm nor Corepack was found.
        echo Install Node.js LTS and run: corepack enable
        echo.
        pause
        exit /b 1
    )
    call corepack enable
    if errorlevel 1 (
        echo [ERROR] Corepack could not enable pnpm.
        echo Open PowerShell as Administrator and run: corepack enable
        echo.
        pause
        exit /b 1
    )
)

rem Install dependencies only when the workspace node_modules is missing.
if not exist "%ROOT%node_modules\.pnpm" (
    echo [INFO] Dependencies are not installed. Running pnpm install...
    echo.
    call pnpm install
    if errorlevel 1 (
        echo.
        echo [ERROR] pnpm install failed.
        pause
        exit /b 1
    )
    echo.
)

rem Warn when requested ports are already occupied.
netstat -ano | findstr /R /C:":%BACK_PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] Port %BACK_PORT% is already in use.
    echo The backend may already be running.
    echo.
)

netstat -ano | findstr /R /C:":%FRONT_PORT% .*LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] Port %FRONT_PORT% is already in use.
    echo The frontend may already be running.
    echo.
)

echo [1/2] Starting backend on port %BACK_PORT%...
start "Asset Composer Backend :%BACK_PORT%" cmd /k "pushd ""%ROOT%"" && set ""PORT=%BACK_PORT%"" && set ""NODE_ENV=development"" && echo Building backend... && call pnpm --filter @workspace/api-server build && echo. && echo Backend URL: %BACK_HEALTH% && call pnpm --filter @workspace/api-server start"

echo [2/2] Starting frontend on port %FRONT_PORT%...
start "Asset Composer Frontend :%FRONT_PORT%" cmd /k "pushd ""%ROOT%"" && set ""PORT=%FRONT_PORT%"" && set ""NODE_ENV=development"" && echo Frontend URL: %FRONT_URL% && call pnpm --filter @workspace/asset-composer dev"

echo.
echo Waiting for the development servers...
timeout /t 7 /nobreak >nul

echo Opening Asset Composer in the browser...
start "" "%FRONT_URL%"

echo.
echo ============================================================
echo   Two terminal windows were opened:
echo     - Asset Composer Backend
echo     - Asset Composer Frontend
echo.
echo   Keep both windows open while using the editor.
echo   Close both windows to stop the local servers.
echo ============================================================
echo.
timeout /t 3 /nobreak >nul
endlocal
exit /b 0
