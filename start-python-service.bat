@echo off
REM Start HybridMind Python AI Service

echo ====================================
echo  HybridMind Python AI Service
echo ====================================
echo.

cd hybridmind-python-service

echo Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python not found! Please install Python 3.8+
    pause
    exit /b 1
)

echo.
echo Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Starting service on http://localhost:8000...
echo API docs will be available at http://localhost:8000/docs
echo.
echo Press Ctrl+C to stop the service
echo.

python main.py
