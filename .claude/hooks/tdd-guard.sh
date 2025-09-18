#!/usr/bin/env bash
set -euo pipefail
payload="$(cat)"

# 擋危險命令的「粗暴保險絲」（更嚴格可改成 allowlist）
if echo "$payload" | grep -Eqi '"tool_name":\s*"Bash".*"command":\s*"(?:sudo|chmod|chattr|mount|curl|wget|scp|ssh)\b'; then
  echo "Blocked: risky bash command not allowed in unattended mode." >&2
  exit 2
fi

# 針對 git commit/push 做 TDD 檢查
if echo "$payload" | grep -q '"command": "git commit'; then
  branch="$(git rev-parse --abbrev-ref HEAD || true)"

  if [[ "$branch" =~ -red- ]]; then
    # 只允許改動測試檔，且測試必須失敗（RED）
    if git diff --cached --name-only | grep -vE '(\.test\.|Tests?/).*' >/dev/null; then
      echo "RED commit may only include test files." >&2; exit 2
    fi
    if bash -lc 'npm test --silent || yarn test --silent || pnpm test --silent || ./gradlew test || xcodebuild test || false'; then
      echo "RED commit must fail tests (expected failing tests first)." >&2; exit 2
    fi
  elif [[ "$branch" =~ -green- ]]; then
    # GREEN 必須全部通過
    if ! bash -lc 'npm test --silent || yarn test --silent || pnpm test --silent || ./gradlew test || xcodebuild test'; then
      echo "GREEN commit requires all tests passing." >&2; exit 2
    fi
  fi
fi
exit 0