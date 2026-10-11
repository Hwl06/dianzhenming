@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  pause
  exit /b 1
)
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8788/health' -TimeoutSec 1; if ($r.ok) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  start "Electrical Diagnosis Backend 8788" /D "%~dp0" cmd /k "node server.mjs"
  timeout /t 3 /nobreak >nul
)
start "" "http://127.0.0.1:8788/"