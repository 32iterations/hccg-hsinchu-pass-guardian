#!/usr/bin/env bash
set -euo pipefail
payload="$(cat)"

# Block risky bash commands (strict allowlist approach for unattended mode)
if echo "$payload" | grep -Eqi '"tool_name":\s*"Bash".*"command":\s*".*\b(sudo|chmod|chattr|mount|curl|wget|scp|ssh)\b'; then
  echo "❌ Blocked: risky bash command not allowed in unattended mode." >&2
  exit 2
fi

# TDD enforcement for git commits
if echo "$payload" | grep -q '"command":\s*"git commit'; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

  if [[ "$branch" =~ -red- ]]; then
    echo "🔴 RED phase detected - validating test-only changes..."

    # RED commits must only include test files
    if git diff --cached --name-only | grep -vE '(\.test\.|\.spec\.|tests?/|__tests?__)' | grep -E '\.(js|jsx|ts|tsx)$' >/dev/null; then
      echo "❌ RED commit may only include test files." >&2
      exit 2
    fi

    # Tests must fail in RED phase
    if bash -lc 'npm test --silent 2>/dev/null || yarn test --silent 2>/dev/null || pnpm test --silent 2>/dev/null || ./gradlew test 2>/dev/null || xcodebuild test 2>/dev/null || false' 2>/dev/null; then
      echo "❌ RED commit must have failing tests (tests are passing)." >&2
      exit 2
    fi
    echo "✅ RED phase validation passed"

  elif [[ "$branch" =~ -green- ]]; then
    echo "🟢 GREEN phase detected - validating all tests pass..."

    # GREEN commits must have all tests passing
    if ! bash -lc 'npm test --silent 2>/dev/null || yarn test --silent 2>/dev/null || pnpm test --silent 2>/dev/null || ./gradlew test 2>/dev/null || xcodebuild test 2>/dev/null'; then
      echo "❌ GREEN commit requires all tests passing." >&2
      exit 2
    fi
    echo "✅ GREEN phase validation passed"
  fi
fi

exit 0