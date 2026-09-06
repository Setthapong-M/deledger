# Deploy the private beta

1. Confirm the host is patched and Docker is running. This private beta currently uses `BACKUP_MODE=disabled`: do not create `/mnt/deledger-backups`, configure a temporary target, or enable backup/restore timers. Loss of the host disk or PostgreSQL volume permanently loses the data.
   For a guided first run, execute `ENV_FILE=/etc/deledger/runtime.env /home/admin/vault/deledger/scripts/setup-private-beta.sh` and complete each paused operator step.
2. Create three file-backed Compose secrets (`postgres_password`, `web_password`, `identity_password`) for the PostgreSQL admin and two Deledger roles under `/etc/deledger/secrets` (or the `DELEDGER_SECRET_DIR` recorded in the runtime environment), with no world permissions. Keep values outside this repository.
3. Copy the production environment values to the operator-managed environment file. Set `BACKUP_MODE=disabled`, the private Access team domain, audience, and Tunnel token; never put these in Git.
4. Build and start PostgreSQL with `docker compose --env-file /etc/deledger/runtime.env -f infra/compose.yaml up -d --build postgres`. Inspect the database name and selected volume before replacing any pre-migration database.
5. Run `docker compose --env-file /etc/deledger/runtime.env --profile operations -f infra/compose.yaml run --rm --build migrate`, which runs Prisma migrations on the private data network and reads the admin password from its container secret. PostgreSQL remains unpublished on the host.
6. Start Next, Nest and Tunnel with `docker compose --env-file /etc/deledger/runtime.env -f infra/compose.yaml up -d --build`. Nest performs startup and periodic catch-up; no catch-up systemd timer is needed. Do not install or enable the backup and restore-verification timers while backup mode is disabled.
7. Complete `infra/cloudflare/access-policy-checklist.md`, enroll WARP clients, and test one invited account.
8. Check `/api/health/live` through the private route and authenticated readiness. Run `scripts/verify-release.sh`; it must print the no-recovery warning and still validate production secrets, Cloudflare configuration, PostgreSQL, RLS, migrations, scheduler readiness, images, tests, and network isolation.

There is no public hostname or automatic deployment. Roll back compatible Next and Nest images together; Prisma migrations are forward-only. The initial migration requires a fresh database, so legacy volumes must be inspected before an explicitly authorized reset.

To enable backups later, follow `backup-restore.md`, set `BACKUP_MODE=enforced`, and include both `infra/compose.yaml` and `infra/compose.backup.yaml`. Never point enforced mode at storage on the same physical disk merely to satisfy readiness.

Set `DATABASE_URL` to `deledger_web` and `IDENTITY_DATABASE_URL` to `deledger_identity` on the same Deledger database. These credentials are injected only into Nest. Next receives the internal API origin and has no data-network membership. The identity role has BYPASSRLS with grants scoped to application tables; verified request work switches transaction-locally to `deledger_web`.

Nest alone joins the non-internal `api-egress` network to fetch Cloudflare JWKS over HTTPS. This network publishes no host ports and does not join the Tunnel or frontend; inbound application traffic continues through Tunnel → Next → Nest. The app and data networks remain internal.
