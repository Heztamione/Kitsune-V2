@echo off
setlocal
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb runAs"
  exit /b
)
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure-production.ps1"
if %errorlevel% neq 0 (
  echo.
  echo Production configuration failed. Review the error above.
)
pause
