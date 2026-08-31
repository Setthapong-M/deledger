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
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}" \
CLOUDFLARE_TEAM_DOMAIN="${CLOUDFLARE_TEAM_DOMAIN:?CLOUDFLARE_TEAM_DOMAIN is required}" \
CLOUDFLARE_ACCESS_AUD="${CLOUDFLARE_ACCESS_AUD:?CLOUDFLARE_ACCESS_AUD is required}" \
CLOUDFLARE_TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:?CLOUDFLARE_TUNNEL_TOKEN is required}" \
  docker compose -f infra/compose.yaml config --quiet
grep -q '^    internal: true$' <(docker compose -f infra/compose.yaml config)
if docker compose -f infra/compose.yaml config | grep -q '^    ports:'; then
  echo "production Compose must not publish host ports" >&2
  exit 1
fi
[[ -d /mnt/deledger-backups ]] && mountpoint -q /mnt/deledger-backups || { echo "backup mount is required" >&2; exit 1; }
find /mnt/deledger-backups -maxdepth 1 -type f -name 'deledger-*.dump.age' -print -quit | grep -q . || { echo "encrypted backup is required" >&2; exit 1; }
[[ -f /mnt/deledger-backups/.restore-verify.last-success ]] || { echo "weekly restore marker is required" >&2; exit 1; }
printf 'release checks passed\n'
