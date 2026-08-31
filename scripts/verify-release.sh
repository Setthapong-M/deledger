#!/usr/bin/env bash
set -euo pipefail

[[ "$(node --version)" == "v22.23.1" ]] || { echo "Node 22.23.1 required" >&2; exit 1; }
[[ "$(pnpm --version)" == "11.1.3" ]] || { echo "pnpm 11.1.3 required" >&2; exit 1; }
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test:all
docker build -f db/Dockerfile .
docker build -f web/Dockerfile .
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${CLOUDFLARE_TEAM_DOMAIN:?CLOUDFLARE_TEAM_DOMAIN is required}"
: "${CLOUDFLARE_ACCESS_AUD:?CLOUDFLARE_ACCESS_AUD is required}"
: "${CLOUDFLARE_TUNNEL_TOKEN:?CLOUDFLARE_TUNNEL_TOKEN is required}"
export DATABASE_URL CLOUDFLARE_TEAM_DOMAIN CLOUDFLARE_ACCESS_AUD CLOUDFLARE_TUNNEL_TOKEN

compose=(docker compose)
if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
  [[ -r "$COMPOSE_ENV_FILE" ]] || { echo "COMPOSE_ENV_FILE is not readable: $COMPOSE_ENV_FILE" >&2; exit 1; }
  compose+=(--env-file "$COMPOSE_ENV_FILE")
fi
compose+=(-f infra/compose.yaml)

"${compose[@]}" config --quiet
grep -q '^    internal: true$' <("${compose[@]}" config)
if "${compose[@]}" config | grep -q '^    ports:'; then
  echo "production Compose must not publish host ports" >&2
  exit 1
fi
[[ -d /mnt/deledger-backups ]] && mountpoint -q /mnt/deledger-backups || { echo "backup mount is required" >&2; exit 1; }
find /mnt/deledger-backups -maxdepth 1 -type f -name 'deledger-*.dump.age' -print -quit | grep -q . || { echo "encrypted backup is required" >&2; exit 1; }
[[ -f /mnt/deledger-backups/.restore-verify.last-success ]] || { echo "weekly restore marker is required" >&2; exit 1; }
printf 'release checks passed\n'
