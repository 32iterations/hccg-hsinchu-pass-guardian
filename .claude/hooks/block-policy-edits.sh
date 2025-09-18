#!/usr/bin/env bash
set -euo pipefail
# Claude 會把工具輸入以 JSON 丟到 stdin；我們用簡單 grep 快速守門即可。
payload="$(cat)"
if echo "$payload" | grep -q '"file_path": ".*/CLAUDE.md"'; then
  echo "Editing CLAUDE.md is forbidden by project policy." >&2
  exit 2  # PreToolUse: exit 2 會直接阻擋這次工具呼叫
fi
exit 0