# Deploy the private beta

1. Confirm the host is patched, Docker is running, and a separate filesystem is mounted at `/mnt/deledger-backups`.
   For a guided first run, execute `ENV_FILE=/etc/deledger/runtime.env /home/admin/vault/deledger/scripts/setup-private-beta.sh` and complete each paused operator step.
2. Create external Compose secrets for the PostgreSQL admin and three Deledger roles. Keep values outside this repository.
3. Copy the production environment values to the operator-managed environment file. Set the private Access team domain, audience, and Tunnel token; never put these in Git.
4. Build and start PostgreSQL and the web image with `docker compose -f infra/compose.yaml up -d --build`.
5. Run migrations from the operator shell with `DATABASE_URL` set to the migration connection, then run the startup catch-up service.
6. Install and enable the backup, restore-verification, and startup-catch-up systemd timers.
7. Complete `infra/cloudflare/access-policy-checklist.md`, enroll WARP clients, and test one invited account.
8. Check `/api/health/live` through the private route and authenticated readiness only after backup readiness is true. `scripts/verify-release.sh` must remain fail-closed until the mount, encrypted artifact, restore marker, production secrets, and Cloudflare/WARP policy all exist.

There is no public hostname or automatic deployment. A rollback changes the web image only; database migrations are forward-only unless a reviewed down migration is explicitly run by the operator.
