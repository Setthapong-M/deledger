# Release checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [ ] `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:ops`, `pnpm test:coverage`
- [ ] `docker build -f db/Dockerfile .`, `docker build -f web/Dockerfile .`, `docker build -f api/Dockerfile .`, and `docker build -f infra/migrate/Dockerfile .`
- [ ] `docker compose -f infra/compose.yaml config --quiet` with operator environment
- [ ] Running PostgreSQL reports the current migration head, forced RLS on all nine application tables, safe role flags/ownership, and successful Nest startup/periodic catch-up
- [ ] Production bootstrap succeeds from owner-only file-backed secrets and the one-shot migration service reaches PostgreSQL without a host port
- [ ] Production Compose has no host-published ports and separates edge/app/data networks, and Next has no database credentials
- [ ] Runtime explicitly sets `BACKUP_MODE=disabled`, release output shows the no-recovery warning, and no backup/restore timers are enabled
- [ ] No `.env`, prototypes, plaintext export, backup identity, or runtime artifacts are staged
- [ ] PR is opened against `main`; do not merge, tag, release, or deploy automatically
- [ ] Build images tagged `deledger-migration-api`, `deledger-migration-web`, `deledger-migration-migrate` and run `bash scripts/test-stack-containers.sh`: isolated fresh migrations, compiled operator, signed QAS JWT through Next, scheduler and Prisma readiness, with no host ports
