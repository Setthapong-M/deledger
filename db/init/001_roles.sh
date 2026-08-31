#!/usr/bin/env bash
set -euo pipefail

database_name="${POSTGRES_DB:-deledger}"
admin_user="${POSTGRES_USER:-postgres}"
admin_password="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
web_password="${DELEDGER_WEB_PASSWORD:?DELEDGER_WEB_PASSWORD is required}"
maintenance_password="${DELEDGER_MAINTENANCE_PASSWORD:?DELEDGER_MAINTENANCE_PASSWORD is required}"
operator_password="${DELEDGER_OPERATOR_PASSWORD:?DELEDGER_OPERATOR_PASSWORD is required}"

export PGPASSWORD="$admin_password"
psql --username "$admin_user" --dbname "$database_name" --set ON_ERROR_STOP=1 \
  --set web_password="$web_password" \
  --set maintenance_password="$maintenance_password" \
  --set operator_password="$operator_password" <<'SQL'
SELECT format('CREATE ROLE deledger_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'web_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deledger_web')\gexec
SELECT format('CREATE ROLE deledger_maintenance LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'maintenance_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deledger_maintenance')\gexec
SELECT format('CREATE ROLE deledger_operator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD %L', :'operator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deledger_operator')\gexec
ALTER ROLE deledger_web LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'web_password';
ALTER ROLE deledger_maintenance LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'maintenance_password';
ALTER ROLE deledger_operator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD :'operator_password';

ALTER ROLE deledger_web SET statement_timeout = '10s';
ALTER ROLE deledger_maintenance SET statement_timeout = '60s';
ALTER ROLE deledger_operator SET statement_timeout = '60s';
SQL
