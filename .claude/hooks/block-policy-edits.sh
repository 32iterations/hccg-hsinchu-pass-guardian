#!/bin/bash

# Block edits to policy files
if [[ "$CLAUDE_TOOL_ARGS" == *".policy/"* ]] || [[ "$CLAUDE_TOOL_ARGS" == *"CLAUDE.md"* ]]; then
  echo "❌ Policy files cannot be edited"
  exit 1
fi

exit 0