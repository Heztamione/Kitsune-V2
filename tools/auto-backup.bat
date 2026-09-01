@echo off
setlocal

rem Kitsune v2 Auto-Backup launcher for Windows
rem Set these before running, or edit them here:

if "%KITSUNE_URL%"=="" set KITSUNE_URL=https://kitsune-v2-1.onrender.com
if "%KITSUNE_BACKUP_DIR%"=="" set KITSUNE_BACKUP_DIR=%APPDATA%\kitsune\backups
if "%KITSUNE_BACKUP_INTERVAL_MS%"=="" set KITSUNE_BACKUP_INTERVAL_MS=900000
if "%KITSUNE_BACKUP_KEEP%"=="" set KITSUNE_BACKUP_KEEP=10

if "%KITSUNE_USERNAME%"=="" (
  echo Set KITSUNE_USERNAME and KITSUNE_PASSWORD before running.
  echo Example:
  echo   set KITSUNE_USERNAME=asa_diaries
  echo   set KITSUNE_PASSWORD=yourpassword
  exit /b 1
)

if "%KITSUNE_PASSWORD%"=="" (
  echo Set KITSUNE_USERNAME and KITSUNE_PASSWORD before running.
  exit /b 1
)

cd /d "%~dp0.."
node "tools\auto-backup.js"
