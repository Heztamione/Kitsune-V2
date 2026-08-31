@echo off
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process -FilePath '%~f0' -Verb runAs"
  exit /b
)

set "HOSTS=%WINDIR%\System32\drivers\etc\hosts"
set "TMP=%TEMP%\kitsune_hosts_remove.tmp"

type "%HOSTS%" | findstr /V /C:"127.0.0.1 kitsune.com" | findstr /V /C:"127.0.0.1 www.kitsune.com" | findstr /V /C:"# Kitsune v2 local entries" > "%TMP%"
copy /Y "%TMP%" "%HOSTS%" >nul 2>&1
ipconfig /flushdns >nul 2>&1

if exist "%HOSTS%.bak.kitsune" del /F /Q "%HOSTS%.bak.kitsune" >nul 2>&1

echo Local hosts removed.
pause
