@echo off
setlocal

net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -Command "Start-Process -FilePath '%~f0' -Verb runAs"
  exit /b
)

set "HOSTS=%WINDIR%\System32\drivers\etc\hosts"
set "TMP=%TEMP%\kitsune_hosts.tmp"

findstr /C:"127.0.0.1 kitsune.com" "%HOSTS%" >nul 2>&1
if %errorlevel% == 0 (
  echo Kitsune host entries already exist.
  pause
  exit /b
)

copy /Y "%HOSTS%" "%HOSTS%.bak.kitsune" >nul 2>&1
type "%HOSTS%" > "%TMP%"
echo. >> "%TMP%"
echo # Kitsune v2 local entries >> "%TMP%"
echo 127.0.0.1 kitsune.com >> "%TMP%"
echo 127.0.0.1 www.kitsune.com >> "%TMP%"
copy /Y "%TMP%" "%HOSTS%" >nul 2>&1
ipconfig /flushdns >nul 2>&1

echo Local hosts added. Open http://kitsune.com:8080/
pause
