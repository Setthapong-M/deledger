#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

local_web_port="${LOCAL_WEB_PORT:-3000}"
local_api_port="${LOCAL_API_PORT:-3001}"
local_database_config="$(node scripts/local-database.mjs)"
mapfile -t local_database_values <<< "$local_database_config"
export LOCAL_DATABASE_NAME="${local_database_values[0]}"
local_admin_database_url="${local_database_values[1]}"
local_web_database_url="${local_database_values[2]}"
local_identity_database_url="${local_database_values[3]}"
export DELEDGER_LOCAL_PGDATA_VOLUME="${local_database_values[4]}"
compose=(docker compose -f infra/compose.local.yaml --project-name deledger_local)

"${compose[@]}" up -d --build --wait
pnpm --dir api generate
MIGRATION_DATABASE_URL="$local_admin_database_url" DATABASE_URL="$local_admin_database_url" pnpm db:migrate

export DELEDGER_ENV=local
export APP_ORIGIN="${LOCAL_APP_ORIGIN:-http://127.0.0.1:${local_web_port}}"
export BUSINESS_TIME_ZONE=Asia/Bangkok
export BACKUP_MODE=disabled
HOSTNAME=127.0.0.1 PORT="$local_api_port" DATABASE_URL="$local_web_database_url" IDENTITY_DATABASE_URL="$local_identity_database_url" pnpm --dir api dev &
api_pid=$!
cleanup() { kill "$api_pid" "${web_pid:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
env -i PATH="$PATH" HOME="$HOME" DELEDGER_ENV=local API_ORIGIN="http://127.0.0.1:${local_api_port}" pnpm --dir web dev --hostname 127.0.0.1 --port "$local_web_port" &
web_pid=$!
wait -n "$api_pid" "$web_pid"
