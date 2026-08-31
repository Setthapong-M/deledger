# Release checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [ ] `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:ops`, `pnpm test:coverage`
- [ ] `docker build -f db/Dockerfile .`, `docker build -f web/Dockerfile .`, and `docker build -f infra/migrate/Dockerfile .`
- [ ] `docker compose -f infra/compose.yaml config --quiet` with operator environment
- [ ] Running PostgreSQL reports the current migration head, forced RLS on all seven tables, safe role flags/ownership, and the exact pg_cron schedule
- [ ] Production bootstrap succeeds from owner-only file-backed secrets and the one-shot migration service reaches PostgreSQL without a host port
- [ ] Production Compose has no host-published ports and separates edge/data networks
- [ ] Runtime explicitly sets `BACKUP_MODE=disabled`, release output shows the no-recovery warning, and no backup/restore timers are enabled
- [ ] No `.env`, prototypes, plaintext export, backup identity, or runtime artifacts are staged
- [ ] PR is opened against `main`; do not merge, tag, release, or deploy automatically

## Gate 8 evidence (2026-08-31)

- Passed: `pnpm typecheck`, `pnpm lint`, `pnpm build`, unit tests, PostgreSQL integration tests, operations tests, coverage (94.89% statements / 89.39% branches), and the complete `DELEDGER_E2E_PROJECTS=chromium,firefox pnpm test:all` run.
- Passed: `docker build -f db/Dockerfile .`, `docker build -f web/Dockerfile .`, `docker build -f infra/backup/Dockerfile .`, production Compose config, systemd unit syntax, and staged-path/private-key checks.
- Passed: startup catch-up waits for a healthy PostgreSQL container, reads its password only from the Docker secret, and all repo-backed systemd units retain read-only access under `ProtectHome`.
- Environment note: this host lacks two WebKit OS libraries; the GitHub Actions workflow installs browser dependencies and runs the full Chromium/Firefox/WebKit/mobile-WebKit matrix.
- User decision (2026-08-31): backup activation is deferred because no external storage is connected. Do not create a temporary/local substitute. The beta accepts permanent data loss after host disk or PostgreSQL volume failure.
- Pending operator activation: production secrets and Cloudflare/WARP policy. In explicit `BACKUP_MODE=disabled`, `scripts/verify-release.sh` skips only backup-specific tooling/artifact checks and emits a warning; every other release check remains fail-closed.
