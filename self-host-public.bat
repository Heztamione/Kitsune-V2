@echo off
chcp 65001 >nul
pushd "%~dp0"
cls

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERROR: Node.js was not found.
    echo  Install Node.js from https://nodejs.org and try again.
    pause
    exit /b 1
)

echo.
echo  SELF-HOSTING KITSUNE V2 FOR PUBLIC
echo  -----------------------------------
echo.
echo  This creates a temporary public URL for your Kitsune v2 app.
echo  Anyone on the internet can open it and use the chat in their browser.
echo.

node host-cloud-bridge.js
