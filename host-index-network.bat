@echo off
chcp 65001 >nul
pushd "%~dp0"
cls

echo.
echo  KITSUNE V2 NETWORK HOST
echo  -----------------------
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERROR: Node.js was not found.
    echo  Install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
)

for /f "tokens=*" %%a in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias (Get-NetRoute -DestinationPrefix 0.0.0.0/0 ^| Select-Object -First 1).InterfaceAlias).IPAddress"') do set LOCAL_IP=%%a
if "%LOCAL_IP%"=="" set LOCAL_IP=localhost

echo  Allowing port 8080 through Windows Firewall...
netsh advfirewall firewall add rule name="Kitsune v2 Server" dir=in action=allow protocol=TCP localport=8080 >nul 2>&1
if %errorlevel% == 0 (
    echo  Firewall rule added.
) else (
    echo  Could not add firewall rule. Run as admin if other devices cannot connect.
)

echo.
echo  Starting Kitsune v2 server...
echo.
echo  On this PC:  http://localhost:8080/
echo  Network:     http://%LOCAL_IP%:8080/
echo  Web app:     http://%LOCAL_IP%:8080/app/
echo.
echo  Share the Network URL with phones / other PCs on the same Wi-Fi.
echo  Press Ctrl+C to stop.
echo.

start "" "http://%LOCAL_IP%:8080/"
node server.js
