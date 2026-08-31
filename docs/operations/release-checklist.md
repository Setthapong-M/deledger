# Release checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [ ] `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:ops`, `pnpm test:coverage`
- [ ] `docker build -f db/Dockerfile .` and `docker build -f web/Dockerfile .`
- [ ] `docker compose -f infra/compose.yaml config --quiet` with operator environment
- [ ] Migration head, forced RLS, role flags, and pg_cron schedule verified
- [ ] Production Compose has no host-published ports and separates edge/data networks
- [ ] Backup mount, newest encrypted backup, checksum, and weekly restore marker verified
- [ ] No `.env`, prototypes, plaintext export, backup identity, or runtime artifacts are staged
- [ ] PR is opened against `main`; do not merge, tag, release, or deploy automatically

## Gate 8 evidence (2026-08-31)

- Passed: `pnpm typecheck`, `pnpm lint`, `pnpm build`, unit tests, PostgreSQL integration tests, operations tests, coverage (94.89% statements / 89.39% branches), and the complete `DELEDGER_E2E_PROJECTS=chromium,firefox pnpm test:all` run.
- Passed: `docker build -f db/Dockerfile .`, `docker build -f web/Dockerfile .`, production Compose config, systemd unit syntax, and staged-path/private-key checks.
- Environment note: this host lacks two WebKit OS libraries; the GitHub Actions workflow installs browser dependencies and runs the full Chromium/Firefox/WebKit/mobile-WebKit matrix.
- Pending operator activation: `/mnt/deledger-backups` mount, backup artifact, restore marker, production secrets, and Cloudflare/WARP policy. `scripts/verify-release.sh` intentionally remains fail-closed until those values exist.
