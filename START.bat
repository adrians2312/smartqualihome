@echo off
title SMARTQUALIHOME - One-Click Start
color 0A
echo ============================================================
echo  SMARTQUALIHOME - One-Click Local Setup
echo  For friend: Just double-click this file after extracting ZIP
echo  1) Start XAMPP -> Click "Start" on Apache and MySQL
echo  2) Double-click START.bat (this file)
echo  That's it!
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found!
    echo   Please install Python 3.10+ from https://www.python.org/
    echo   Check "Add python.exe to PATH" during install
    pause
    exit /b
)

echo [1/4] Checking virtual environment...
if not exist ".venv\Scripts\python.exe" (
    echo   Creating .venv (first time only, ~10 sec)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create venv
        pause
        exit /b
    )
) else (
    echo   .venv found
)

echo.
echo [2/4] Installing requirements (first time takes 1-2 min)...
".venv\Scripts\pip.exe" install -r requirements.txt
if %errorlevel% neq 0 (
    echo [WARN] pip install had warnings, trying again...
    ".venv\Scripts\pip.exe" install --no-cache-dir -r requirements.txt
)

echo.
echo [3/4] Setting up database (auto-imports migrations/schema.sql)...
".venv\Scripts\python.exe" install.py --db-only
if %errorlevel% neq 0 (
    echo [WARN] MySQL setup had warnings, will try SQLite fallback
)

echo.
echo [4/4] Starting server at http://127.0.0.1:5000
echo   Login accounts:
echo     Admin  - admin@smartqualihome.com / Admin@2026!
echo     Agent  - agent@smartqualihome.com / Agent@2026!
echo     Client - client@smartqualihome.com / Client@2026!
echo.
echo   Your browser will open automatically. Press CTRL+C to stop.
echo   Keep this window open while testing.
echo ============================================================
timeout /t 2 >nul
start http://127.0.0.1:5000
".venv\Scripts\python.exe" run.py
pause
