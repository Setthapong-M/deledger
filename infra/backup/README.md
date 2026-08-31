# Encrypted backup

Mount a physically separate filesystem at `/mnt/deledger-backups` before starting the stack. `backup.sh` streams a PostgreSQL custom dump through `age`, verifies a non-empty artifact, writes a checksum beside it, and only then applies the 30-day retention rule. Plaintext dumps and the age identity never enter the mount.

The production Compose `backup` profile packages the PostgreSQL client and `age` in an isolated, non-root image on the `data` network. The systemd service invokes `docker compose run --rm backup`, so the backup job never depends on a host-published PostgreSQL port. The host backup service account needs permission to invoke Docker and the mounted target must be writable by UID 1001.

`restore-verify.sh` selects the newest checksum-valid artifact and restores it into a uniquely named, network-isolated PostgreSQL container and volume based on the built `deledger-postgres:latest` image (override with `DELEDGER_DB_IMAGE` only when the operator has reviewed an equivalent image). The cleanup trap removes only resources carrying that generated name. It verifies the migration head, seven-table boundary, forced RLS, constraints, `pg_cron`, and that each table's row-count query succeeds before writing the success marker.

On success it updates `.restore-verify.last-success` on the mounted target; the protected readiness check requires that marker and a backup newer than 26 hours.
