@echo off
echo Starting HybridMind Backend Server...
cd /d "%~dp0"
start "HybridMind Backend" cmd /k "npm start"
echo.
echo Backend server is starting in a new window.
echo Keep that window open while using the VS Code extension.
echo.
pause
