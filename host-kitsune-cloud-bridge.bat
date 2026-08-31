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

node host-cloud-bridge.js
