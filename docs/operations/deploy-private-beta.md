# Deploy the private beta

1. Confirm the host is patched and Docker is running. This private beta currently uses `BACKUP_MODE=disabled`: do not create `/mnt/deledger-backups`, configure a temporary target, or enable backup/restore timers. Loss of the host disk or PostgreSQL volume permanently loses the data.
   For a guided first run, execute `ENV_FILE=/etc/deledger/runtime.env /home/admin/vault/deledger/scripts/setup-private-beta.sh` and complete each paused operator step.
2. Create four file-backed Compose secrets for the PostgreSQL admin and three Deledger roles under `/etc/deledger/secrets` (or the `DELEDGER_SECRET_DIR` recorded in the runtime environment), with no world permissions. Keep values outside this repository.
3. Copy the production environment values to the operator-managed environment file. Set `BACKUP_MODE=disabled`, the private Access team domain, audience, and Tunnel token; never put these in Git.
4. Build and start PostgreSQL and the web image with `docker compose -f infra/compose.yaml up -d --build`.
5. Run `docker compose --env-file /etc/deledger/runtime.env --profile operations -f infra/compose.yaml run --rm --build migrate`, then install and run the startup catch-up service. Both stay on the private data network and read the admin password only from the container secret; PostgreSQL remains unpublished on the host.
6. Install and enable only the startup-catch-up systemd timer. Do not install or enable the backup and restore-verification timers while backup mode is disabled.
7. Complete `infra/cloudflare/access-policy-checklist.md`, enroll WARP clients, and test one invited account.
8. Check `/api/health/live` through the private route and authenticated readiness. Run `scripts/verify-release.sh`; it must print the no-recovery warning and still validate production secrets, Cloudflare configuration, PostgreSQL, RLS, migrations, cron, images, tests, and network isolation.

There is no public hostname or automatic deployment. A rollback changes the web image only; database migrations are forward-only unless a reviewed down migration is explicitly run by the operator.

To enable backups later, follow `backup-restore.md`, set `BACKUP_MODE=enforced`, and include both `infra/compose.yaml` and `infra/compose.backup.yaml`. Never point enforced mode at storage on the same physical disk merely to satisfy readiness.
