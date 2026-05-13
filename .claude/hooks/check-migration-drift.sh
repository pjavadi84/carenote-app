#!/usr/bin/env bash
# SessionStart hook: warn if either Supabase prod project has pending migrations
# vs the local supabase/migrations/ directory. Silent when in sync.
# Requires: supabase CLI authenticated (`supabase login` or SUPABASE_ACCESS_TOKEN).
set -u

check_project() {
  local ref="$1" label="$2"
  local output
  output=$(supabase migration list --project-ref "$ref" 2>/dev/null) || return 0
  local pending
  pending=$(echo "$output" | awk -F '|' '
    /^[[:space:]]+[0-9]+/ {
      remote=$2; gsub(/[[:space:]]/, "", remote)
      if (remote == "") c++
    }
    END { print c+0 }
  ')
  if [ "$pending" -gt 0 ]; then
    echo "⚠️  $label is $pending migration(s) behind. Run: supabase link --project-ref $ref && supabase db push --linked --dry-run"
  fi
}

command -v supabase >/dev/null 2>&1 || exit 0
check_project "dqjxlovjehhdoehiehyo" "Supabase US prod (kinroster-prod)"
check_project "qwcjrdiifkklwhazjmgx" "Supabase Taiwan prod (kinroster-tw-prod)"
exit 0
