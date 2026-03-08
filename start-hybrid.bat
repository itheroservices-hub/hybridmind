@echo off
REM Start complete HybridMind Hybrid System

echo ======================================
echo  HybridMind - Hybrid Architecture
echo ======================================
echo  Starting Node.js + Python services
echo ======================================
echo.

echo [1/2] Starting Python AI Service...
start "HybridMind Python Service" cmd /c start-python-service.bat

timeout /t 5 /nobreak > nul

echo.
echo [2/2] Starting Node.js Backend...
start "HybridMind Node.js Backend" cmd /c start-backend.bat

echo.
echo ======================================
echo  Both services are starting...
echo ======================================
echo  Node.js Backend: http://localhost:3000
echo  Python Service:  http://localhost:8000
echo  Python API Docs: http://localhost:8000/docs
echo ======================================
echo.
echo Make sure to enable Python service in .env:
echo   ENABLE_PYTHON_SERVICE=true
echo.

pause
