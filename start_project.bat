@echo off
title HemaVision AI Launcher
echo ========================================================
echo Starting HemaVision AI (FastAPI Backend + React UI)
echo ========================================================

cd /d "%~dp0"

echo [1/2] Launching Backend API server (Port 8000)...
start "HemaVision AI - Backend" cmd /k "cd /d "%~dp0" && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo [2/2] Launching React UI (Port 8080)...
start "HemaVision AI - React UI" cmd /k "cd /d "%~dp0ui" && npm run dev"

timeout /t 4 /nobreak >nul

echo Opening application in default browser...
start http://localhost:8080

echo ========================================================
echo HemaVision AI is now running at http://localhost:8080
echo Leave the two open terminal windows running in the background.
echo ========================================================
pause
