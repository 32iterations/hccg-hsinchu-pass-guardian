#!/bin/bash
cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend

echo "📦 Testing backend server startup..."

# Start server
node server-ci.js > test.log 2>&1 &
PID=$!
echo "Started server with PID: $PID"

# Wait for startup
sleep 3

# Check if still running
if kill -0 $PID 2>/dev/null; then
  echo "✅ Server process is running"
  
  # Test endpoints
  echo "Testing health endpoint..."
  curl -s http://localhost:3000/health | jq '.' || echo "No JSON response"
  
  echo "Testing API health endpoint..."
  curl -s http://localhost:3000/api/health | jq '.' || echo "No JSON response"
  
  echo "Testing other endpoints..."
  curl -s http://localhost:3000/api/cases | jq '.' || echo "No JSON response"
  curl -s http://localhost:3000/api/kpi | jq '.' || echo "No JSON response"
  
  # Clean up
  kill $PID
  echo "✅ Server test completed successfully"
else
  echo "❌ Server crashed. Logs:"
  cat test.log
  exit 1
fi
