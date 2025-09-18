#!/bin/bash

# TDD Guard - Ensure tests are written before implementation
# This hook can check for test files or enforce TDD practices

# Example: Check if running tests before making code changes
if [[ "$CLAUDE_TOOL_ARGS" == *"npm run"* ]] || [[ "$CLAUDE_TOOL_ARGS" == *"yarn"* ]] || [[ "$CLAUDE_TOOL_ARGS" == *"pnpm"* ]]; then
  # Allow test commands to run
  exit 0
fi

# Add custom TDD enforcement logic here if needed
# For example, check if tests exist for new features being implemented

exit 0