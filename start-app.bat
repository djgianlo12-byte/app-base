@echo off
title Base44 App Server
cd /d "%~dp0"

echo ==============================================
echo  Base44 App - Development Server
echo ==============================================
echo.

if not exist "node_modules\" (
    echo Node modules niet gevonden. Installeren...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo FOUT bij npm install!
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ============================================
echo  Server starten...
echo  Je app is bereikbaar op:
echo    - PC:      http://localhost:5173
echo    - iPhone:  http://192.168.2.16:5173
echo ============================================
echo.
echo Druk op Ctrl+C om te stoppen.
echo.

npm run dev

echo.
echo Server gestopt (of er ging iets fout).
echo.
pause
