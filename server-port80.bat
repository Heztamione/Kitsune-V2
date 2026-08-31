@echo off
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process -FilePath '%~f0' -Verb runAs"
  exit /b
)

pushd "%~dp0"
set PORT=80
node server.js
pause
