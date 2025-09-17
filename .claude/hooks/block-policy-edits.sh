#!/usr/bin/env bash
set -euo pipefail

# Block attempts to edit protected policy files
payload="$(cat)"

# Check if trying to edit CLAUDE.md or policy files
if echo "$payload" | grep -qE '"file_path":\s*"[^"]*CLAUDE\.md"' || \
   echo "$payload" | grep -qE '"file_path":\s*"[^"]*\.policy/'; then
  echo "❌ Editing CLAUDE.md or .policy files is forbidden by project policy." >&2
  echo "   Please create an ADR proposal in docs/ADR/ instead." >&2
  exit 2  # PreToolUse: exit 2 blocks the tool call
fi

# Check if trying to access secrets
if echo "$payload" | grep -qE '"file_path":\s*"[^"]*\.env"' || \
   echo "$payload" | grep -qE '"file_path":\s*"[^"]*secrets/'; then
  echo "❌ Accessing .env or secrets is forbidden." >&2
  echo "   Use mock values or environment variables instead." >&2
  exit 2
fi

exit 0