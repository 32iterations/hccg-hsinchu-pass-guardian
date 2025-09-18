#!/bin/bash

# Real-time monitoring dashboard for 4 Claude instances
while true; do
  clear
  echo "========================================="
  echo "🚀 HSINCHU PASS GUARDIAN - PARALLEL DEV"
  echo "========================================="
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""

  # Check tmux sessions
  echo "📊 Active Claude Sessions:"
  tmux ls | grep claude- | while read line; do
    session=$(echo $line | cut -d: -f1)
    echo "  ✅ $session"
  done
  echo ""

  # Check shared status
  if [ -f /tmp/claude-status/shared-state.json ]; then
    echo "📝 Latest Status Updates:"
    cat /tmp/claude-status/shared-state.json | python3 -m json.tool 2>/dev/null | head -20
  fi
  echo ""

  # Check file locks
  echo "🔒 Active File Locks:"
  ls -la /tmp/claude-locks/ 2>/dev/null | grep -v "^total" | tail -n +2
  echo ""

  # Check test results
  if [ -f /tmp/claude-status/test-results.json ]; then
    echo "🧪 Test Results:"
    cat /tmp/claude-status/test-results.json | python3 -m json.tool 2>/dev/null
  fi
  echo ""

  # Check individual status files
  echo "📄 Individual Status Files:"
  for status_file in database mobile geofence dashboard; do
    if [ -f /tmp/claude-status/${status_file}-status.txt ]; then
      echo "  ${status_file}: $(tail -1 /tmp/claude-status/${status_file}-status.txt 2>/dev/null)"
    fi
  done

  echo ""
  echo "Press Ctrl+C to exit monitoring"
  echo "========================================="

  sleep 5
done