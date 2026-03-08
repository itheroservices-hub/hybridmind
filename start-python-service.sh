#!/bin/bash
# Start HybridMind Python AI Service

echo "===================================="
echo " HybridMind Python AI Service"
echo "===================================="
echo ""

cd hybridmind-python-service

echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python not found! Please install Python 3.8+"
    exit 1
fi
python3 --version

echo ""
echo "Installing dependencies..."
pip3 install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo ""
echo "Starting service on http://localhost:8000..."
echo "API docs will be available at http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

python3 main.py
