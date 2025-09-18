#!/bin/bash

# Enhanced monitoring for all Claude instances
monitor_instance() {
  local session=$1
  local name=$2
  echo "┌─────────────────────────────────────────────"
  echo "│ 🤖 $name ($session)"
  echo "├─────────────────────────────────────────────"

  # Check if session exists
  if tmux has-session -t $session 2>/dev/null; then
    echo "│ ✅ Session Active"

    # Get last 15 lines of output
    echo "│ 📝 Latest Activity:"
    tmux capture-pane -t $session -p 2>/dev/null | tail -15 | while IFS= read -r line; do
      # Truncate long lines
      if [ ${#line} -gt 70 ]; then
        line="${line:0:67}..."
      fi
      echo "│   $line"
    done

    # Check for recent activity (if pane has been updated)
    local pane_info=$(tmux list-panes -t $session -F "#{pane_current_command}" 2>/dev/null | head -1)
    echo "│ 🔄 Current Command: $pane_info"
  else
    echo "│ ❌ Session Not Found"
  fi
  echo "└─────────────────────────────────────────────"
  echo ""
}

# Main monitoring loop
while true; do
  clear
  echo "╔═══════════════════════════════════════════════════════════════════════╗"
  echo "║          🚀 HSINCHU PASS GUARDIAN - REAL-TIME MONITORING 🚀           ║"
  echo "╠═══════════════════════════════════════════════════════════════════════╣"
  echo "║ Time: $(date '+%Y-%m-%d %H:%M:%S')                                    ║"
  echo "╚═══════════════════════════════════════════════════════════════════════╝"
  echo ""

  # Monitor each instance
  monitor_instance "claude-db" "DATABASE SPECIALIST"
  monitor_instance "claude-mobile" "MOBILE DEVELOPER"
  monitor_instance "claude-geo" "GEOFENCING EXPERT"
  monitor_instance "claude-dash" "DASHBOARD & DEPLOY"

  # Show shared status
  echo "┌─────────────────────────────────────────────"
  echo "│ 📊 SHARED STATUS"
  echo "├─────────────────────────────────────────────"

  # Check file locks
  lock_count=$(ls /tmp/claude-locks/ 2>/dev/null | wc -l)
  echo "│ 🔒 Active File Locks: $lock_count"
  if [ $lock_count -gt 0 ]; then
    ls /tmp/claude-locks/ 2>/dev/null | head -5 | while read lock; do
      echo "│   - $lock"
    done
  fi

  # Check test results
  if [ -f /tmp/claude-status/test-results.json ]; then
    total=$(cat /tmp/claude-status/test-results.json | grep -o '"total_tests":[0-9]*' | cut -d: -f2)
    passing=$(cat /tmp/claude-status/test-results.json | grep -o '"passing":[0-9]*' | cut -d: -f2)
    failing=$(cat /tmp/claude-status/test-results.json | grep -o '"failing":[0-9]*' | cut -d: -f2)
    echo "│ 🧪 Tests: Total: $total | ✅ Pass: $passing | ❌ Fail: $failing"
  fi

  # Check individual status files
  echo "│ 📄 Status Files:"
  for status_file in database mobile geofence dashboard; do
    if [ -f /tmp/claude-status/${status_file}-status.txt ]; then
      last_update=$(stat -c %y /tmp/claude-status/${status_file}-status.txt 2>/dev/null | cut -d' ' -f2 | cut -d'.' -f1)
      echo "│   $status_file: Updated $last_update"
    else
      echo "│   $status_file: No updates yet"
    fi
  done
  echo "└─────────────────────────────────────────────"
  echo ""

  # Estimated completion times
  echo "⏱️  ESTIMATED COMPLETION TIMES:"
  echo "  • Database (claude-db):     ~45-60 mins - PostgreSQL setup + migrations + TDD"
  echo "  • Mobile (claude-mobile):   ~60-90 mins - API integration + BLE + Firebase + TDD"
  echo "  • Geofence (claude-geo):    ~45-60 mins - Geofencing + alerts + notifications + TDD"
  echo "  • Dashboard (claude-dash):  ~60-75 mins - Admin UI + Docker + deployment + TDD"
  echo ""
  echo "Press Ctrl+C to exit | Refreshing every 10 seconds..."

  sleep 10
done