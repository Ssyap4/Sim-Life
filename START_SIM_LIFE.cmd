@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Sim-Life - our shared home
echo.
echo Local URL: http://127.0.0.1:3111/
echo Invite codes: server-data\access.json (keep private)
echo.
call npm run build
if errorlevel 1 (
  echo Build failed. Check messages above.
  pause
  exit /b 1
)
call npm run start
echo.
echo Server stopped.
pause
