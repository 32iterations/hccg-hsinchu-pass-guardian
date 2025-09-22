#!/bin/bash

echo "🚀 Testing CI Backend Server Locally"
echo "===================================="

cd /home/ubuntu/dev/hccg-hsinchu-pass-guardian/backend

# Kill any existing servers on port 3000
echo "Cleaning up any existing processes on port 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Start the test server
echo "Starting test server..."
node test-server.js > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to start..."
for i in {1..10}; do
  if curl -f -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi

  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server process died!"
    echo "Server logs:"
    cat server.log
    exit 1
  fi

  echo "  Attempt $i/10..."
  sleep 1
done

# Test endpoints
echo ""
echo "Testing health endpoints..."
echo "-------------------------"
echo "GET /health:"
curl -s http://localhost:3000/health | jq '.'

echo ""
echo "GET /api/health:"
curl -s http://localhost:3000/api/health | jq '.'

echo ""
echo "GET /api/cases:"
curl -s http://localhost:3000/api/cases | jq '.'

echo ""
echo "GET /api/kpi:"
curl -s http://localhost:3000/api/kpi | jq '.'

# Run performance tests
echo ""
echo "Running performance tests..."
echo "---------------------------"
echo "Testing /api/health endpoint with autocannon (10 connections, 5 seconds):"
autocannon -c 10 -d 5 -j http://localhost:3000/api/health 2>/dev/null | jq '{
  latency_ms: .latency.mean,
  throughput_bytes: .throughput.mean,
  requests_per_sec: .requests.mean,
  errors: .errors
}'

# Clean up
echo ""
echo "Cleaning up..."
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "✅ All tests completed successfully!"