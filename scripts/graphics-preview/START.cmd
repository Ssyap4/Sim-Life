@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer from https://nodejs.org and open START.cmd again.
  pause
  exit /b 1
)
chcp 65001 >nul
node preview.cjs
if errorlevel 1 pause
