@echo off
cd /d "%~dp0"
if not exist "server-data\access.json" (
  echo Start Sim-Life server first to generate the private player codes.
  pause
  exit /b 1
)
start "" notepad.exe "%~dp0server-data\access.json"
