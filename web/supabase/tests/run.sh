#!/usr/bin/env bash
# Database test runner: builds a throw-away Postgres database that behaves like a Supabase
# project, applies the repo's SQL in the documented order, then runs the SQL test suites.
#
#   ./supabase/tests/run.sh                      # creates & drops a local DB called sl_test
#   DATABASE_URL=postgresql://… ./run.sh         # use an EMPTY, disposable database (CI)
#
# NEVER point this at a real project: it creates roles and a stub `auth` schema.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SUPABASE_DIR="$(dirname "$HERE")"
WEB_DIR="$(dirname "$SUPABASE_DIR")"

if [[ -z "${DATABASE_URL:-}" ]]; then
  dropdb --if-exists sl_test >/dev/null 2>&1 || true
  createdb sl_test
  URL="postgresql:///sl_test"
  CLEANUP=1
else
  URL="$DATABASE_URL"
  CLEANUP=0
fi

# Result sets are discarded (-o /dev/null); errors still reach stderr. Notices ("ok  label") are
# counted per file so a green run still shows how much was asserted.
run()   { local out; out="$(psql "$URL" -v ON_ERROR_STOP=1 -q -X -o /dev/null "$@" 2>&1)"; local rc=$?
          LAST_OK=$(grep -c 'NOTICE:  ok ' <<<"$out" || true)
          grep -v -E '^$|NOTICE|^HINT|wal_level|^DETAIL|^CONTEXT' <<<"$out" || true; return $rc; }

echo "▸ stub Supabase (roles, auth schema, default grants)"
run -f "$HERE/00_supabase_stub.sql"

echo "▸ base schema + notification triggers (legacy setup files)"
run -f "$WEB_DIR/supabase_schema.sql"
run -f "$WEB_DIR/supabase_notifications.sql"

echo "▸ migrations (in order)"
for f in "$SUPABASE_DIR"/migrations/*.sql; do
  echo "   $(basename "$f")"
  run -f "$f"
done

echo "▸ migrations again (must be idempotent)"
for f in "$SUPABASE_DIR"/migrations/*.sql; do run -f "$f"; done

echo "▸ test helpers"
run -f "$HERE/01_helpers.sql"

FAILED=0
for t in "$HERE"/[1-9]*.test.sql; do
  [[ -e "$t" ]] || continue
  echo "▸ $(basename "$t")"
  if run -f "$t"; then echo "   ✔ $LAST_OK assertions"; else FAILED=1; echo "✗ FAILED: $(basename "$t")"; fi
done

if [[ -x "$HERE/concurrency.sh" ]]; then
  echo "▸ concurrency.sh"
  if ! URL="$URL" "$HERE/concurrency.sh"; then FAILED=1; echo "✗ FAILED: concurrency.sh"; fi
fi

if [[ "$CLEANUP" == 1 ]]; then dropdb --if-exists sl_test >/dev/null 2>&1 || true; fi
if [[ "$FAILED" == 0 ]]; then echo "✔ all database tests passed"; else echo "✗ database tests failed"; exit 1; fi
