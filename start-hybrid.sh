#!/bin/bash
# Start complete HybridMind Hybrid System

echo "======================================"
echo " HybridMind - Hybrid Architecture"
echo "======================================"
echo " Starting Node.js + Python services"
echo "======================================"
echo ""

echo "[1/2] Starting Python AI Service..."
./start-python-service.sh &
PYTHON_PID=$!

sleep 5

echo ""
echo "[2/2] Starting Node.js Backend..."
./start-backend.sh &
NODEJS_PID=$!

echo ""
echo "======================================"
echo " Both services are running!"
echo "======================================"
echo " Node.js Backend: http://localhost:3000"
echo " Python Service:  http://localhost:8000"
echo " Python API Docs: http://localhost:8000/docs"
echo "======================================"
echo ""
echo "Make sure to enable Python service in .env:"
echo "  ENABLE_PYTHON_SERVICE=true"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait $PYTHON_PID $NODEJS_PID
