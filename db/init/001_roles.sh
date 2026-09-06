#!/usr/bin/env bash
set -euo pipefail

database_name="${POSTGRES_DB:-deledger}"
admin_user="${POSTGRES_USER:-postgres}"

read_secret() {
  local variable="$1"
  local file_variable="${variable}_FILE"
  local file_path="${!file_variable:-}"
  if [[ -n "$file_path" ]]; then
    [[ -r "$file_path" ]] || { echo "$file_variable is not readable" >&2; exit 1; }
    tr -d '\r\n' < "$file_path"
  else
    [[ -n "${!variable:-}" ]] || { echo "$variable is required" >&2; exit 1; }
    printf '%s' "${!variable}"
  fi
}

admin_password="$(read_secret POSTGRES_PASSWORD)"
web_password="$(read_secret DELEDGER_WEB_PASSWORD)"
identity_password="$(read_secret DELEDGER_IDENTITY_PASSWORD)"

export PGPASSWORD="$admin_password"
psql --username "$admin_user" --dbname "$database_name" --set ON_ERROR_STOP=1 \
  --set web_password="$web_password" --set identity_password="$identity_password" <<'SQL'
SELECT format('CREATE ROLE deledger_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'web_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deledger_web')\gexec
SELECT format('CREATE ROLE deledger_identity LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS PASSWORD %L', :'identity_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deledger_identity')\gexec
ALTER ROLE deledger_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'web_password';
ALTER ROLE deledger_identity LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS PASSWORD :'identity_password';
GRANT deledger_web TO deledger_identity;
ALTER ROLE deledger_web SET statement_timeout = '10s';
ALTER ROLE deledger_identity SET statement_timeout = '60s';
SQL
