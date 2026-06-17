@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Asset Composer - Windows Fix V2

set "ROOT=%~dp0"
set "FRONT_PORT=5173"
set "BACK_PORT=3001"
set "FRONT_URL=http://localhost:%FRONT_PORT%"
set "BACK_URL=http://localhost:%BACK_PORT%"

cd /d "%ROOT%"

echo.
echo ============================================================
echo   ASSET COMPOSER - WINDOWS FIX V2
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
    echo [ERROR] Corepack was not found in PATH.
    pause
    exit /b 1
)

echo [1/4] Creating the Windows-safe package fixer...
if not exist "%ROOT%scripts" mkdir "%ROOT%scripts"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$b=[Convert]::FromBase64String('Y29uc3QgZnMgPSByZXF1aXJlKCJub2RlOmZzIik7CmNvbnN0IHBhdGggPSByZXF1aXJlKCJub2RlOnBhdGgiKTsKCmNvbnN0IHJvb3QgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAiLi4iKTsKY29uc3QgcGFja2FnZVBhdGggPSBwYXRoLmpvaW4ocm9vdCwgInBhY2thZ2UuanNvbiIpOwpjb25zdCBiYWNrdXBQYXRoID0gcGF0aC5qb2luKHJvb3QsICJwYWNrYWdlLmpzb24uYmVmb3JlLXdpbmRvd3MtZml4LmJhayIpOwpjb25zdCBwcmVpbnN0YWxsUGF0aCA9IHBhdGguam9pbihyb290LCAic2NyaXB0cyIsICJwcmVpbnN0YWxsLmNqcyIpOwoKaWYgKCFmcy5leGlzdHNTeW5jKHBhY2thZ2VQYXRoKSkgewogIGNvbnNvbGUuZXJyb3IoIltFUlJPUl0gcGFja2FnZS5qc29uIHdhcyBub3QgZm91bmQ6IiwgcGFja2FnZVBhdGgpOwogIHByb2Nlc3MuZXhpdCgxKTsKfQoKaWYgKCFmcy5leGlzdHNTeW5jKGJhY2t1cFBhdGgpKSB7CiAgZnMuY29weUZpbGVTeW5jKHBhY2thZ2VQYXRoLCBiYWNrdXBQYXRoKTsKICBjb25zb2xlLmxvZygiW09LXSBCYWNrdXAgY3JlYXRlZDoiLCBiYWNrdXBQYXRoKTsKfQoKY29uc3QgcmF3ID0gZnMucmVhZEZpbGVTeW5jKHBhY2thZ2VQYXRoLCAidXRmOCIpLnJlcGxhY2UoL15cdUZFRkYvLCAiIik7CmxldCBwa2c7CnRyeSB7CiAgcGtnID0gSlNPTi5wYXJzZShyYXcpOwp9IGNhdGNoIChlcnJvcikgewogIGNvbnNvbGUuZXJyb3IoIltFUlJPUl0gcGFja2FnZS5qc29uIGlzIG5vdCB2YWxpZCBKU09OLiIpOwogIGNvbnNvbGUuZXJyb3IoZXJyb3IpOwogIHByb2Nlc3MuZXhpdCgxKTsKfQoKcGtnLnNjcmlwdHMgPSBwa2cuc2NyaXB0cyB8fCB7fTsKcGtnLnNjcmlwdHMucHJlaW5zdGFsbCA9ICJub2RlIHNjcmlwdHMvcHJlaW5zdGFsbC5janMiOwoKZnMubWtkaXJTeW5jKHBhdGguZGlybmFtZShwcmVpbnN0YWxsUGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pOwpmcy53cml0ZUZpbGVTeW5jKAogIHByZWluc3RhbGxQYXRoLAogIGBjb25zdCBmcyA9IHJlcXVpcmUoIm5vZGU6ZnMiKTsKCmZvciAoY29uc3QgZmlsZSBvZiBbInBhY2thZ2UtbG9jay5qc29uIiwgInlhcm4ubG9jayJdKSB7CiAgdHJ5IHsKICAgIGZzLnJtU3luYyhmaWxlLCB7IGZvcmNlOiB0cnVlIH0pOwogIH0gY2F0Y2ggewogICAgLy8gSWdub3JlIGNsZWFudXAgZXJyb3JzLgogIH0KfQoKY29uc3QgdXNlckFnZW50ID0gcHJvY2Vzcy5lbnYubnBtX2NvbmZpZ191c2VyX2FnZW50IHx8ICIiOwppZiAoIXVzZXJBZ2VudC5zdGFydHNXaXRoKCJwbnBtLyIpKSB7CiAgY29uc29sZS5lcnJvcigiVXNlIHBucG0gaW5zdGVhZCIpOwogIHByb2Nlc3MuZXhpdCgxKTsKfQpgLAogICJ1dGY4IgopOwoKZnMud3JpdGVGaWxlU3luYyhwYWNrYWdlUGF0aCwgSlNPTi5zdHJpbmdpZnkocGtnLCBudWxsLCAyKSArICJcbiIsICJ1dGY4Iik7Cgpjb25zb2xlLmxvZygiW09LXSBwYWNrYWdlLmpzb24gcHJlaW5zdGFsbCB3YXMgY2hhbmdlZCB0bzoiKTsKY29uc29sZS5sb2coJyAgICAgInByZWluc3RhbGwiOiAibm9kZSBzY3JpcHRzL3ByZWluc3RhbGwuY2pzIicpOwpjb25zb2xlLmxvZygiW09LXSBDcmVhdGVkOiIsIHByZWluc3RhbGxQYXRoKTsK');[IO.File]::WriteAllBytes((Join-Path $env:ROOT 'scripts\fix-windows-preinstall.cjs'),$b)"
if errorlevel 1 (
    echo [ERROR] Could not create scripts\fix-windows-preinstall.cjs
    pause
    exit /b 1
)

echo [2/4] Patching package.json and creating scripts\preinstall.cjs...
node "%ROOT%scripts\fix-windows-preinstall.cjs"
if errorlevel 1 (
    echo [ERROR] The Node.js fixer failed.
    pause
    exit /b 1
)

echo.
echo [3/4] Completing the Windows dependency installation...
echo This can take several minutes.
echo.
call corepack pnpm install --force --no-frozen-lockfile
if errorlevel 1 (
    echo.
    echo [ERROR] pnpm install failed.
    echo Copy the full error text from this window.
    pause
    exit /b 1
)

echo.
echo Checking native Windows packages...

dir /b "%ROOT%node_modules\.pnpm\@rollup+rollup-win32-x64-msvc@*" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] @rollup/rollup-win32-x64-msvc is still missing.
    pause
    exit /b 1
)

dir /b "%ROOT%node_modules\.pnpm\@esbuild+win32-x64@*" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] @esbuild/win32-x64 is still missing.
    pause
    exit /b 1
)

echo [OK] Rollup and esbuild Windows binaries are installed.
echo.

echo [4/4] Starting backend and frontend...

start "Asset Composer Backend :%BACK_PORT%" cmd /k "cd /d ""%ROOT%"" && set ""PORT=%BACK_PORT%"" && set ""NODE_ENV=development"" && echo Building backend... && call corepack pnpm --filter @workspace/api-server build && echo. && echo Starting backend at %BACK_URL% && call corepack pnpm --filter @workspace/api-server start"

start "Asset Composer Frontend :%FRONT_PORT%" cmd /k "cd /d ""%ROOT%"" && set ""PORT=%FRONT_PORT%"" && set ""NODE_ENV=development"" && echo Starting frontend at %FRONT_URL% && call corepack pnpm --filter @workspace/asset-composer dev"

echo.
echo Waiting for the frontend...
timeout /t 8 /nobreak >nul
start "" "%FRONT_URL%"

echo.
echo ============================================================
echo   START COMMANDS SENT
echo ============================================================
echo   Keep both terminal windows open.
echo   Frontend: %FRONT_URL%
echo   Backend:  %BACK_URL%
echo ============================================================
echo.
timeout /t 3 /nobreak >nul

endlocal
exit /b 0
