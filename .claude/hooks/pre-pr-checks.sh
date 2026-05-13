#!/usr/bin/env bash
# PreToolUse hook for Bash: blocks `gh pr create` if tsc or lint fail.
# Reads the tool input JSON from stdin to find the command.
set -u

input=$(cat)
cmd=$(echo "$input" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

# Only intercept gh pr create.
case "$cmd" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

echo "Running pre-PR checks (tsc + lint)..." >&2

if ! pnpm exec tsc --noEmit >&2; then
  echo "❌ Pre-PR check failed: TypeScript errors. Fix, then retry." >&2
  exit 2
fi

if ! pnpm lint >&2; then
  echo "❌ Pre-PR check failed: lint errors. Fix, then retry." >&2
  exit 2
fi

echo "✅ Pre-PR checks passed." >&2
exit 0
