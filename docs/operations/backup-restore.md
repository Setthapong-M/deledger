# Backup and restore

Daily backups run at 03:15 Bangkok time and are encrypted with `age` before they leave the database process. The Compose `backup` profile runs on the private `data` network with a read/write bind mount; it does not require or create a PostgreSQL host port. The backup target must be a mounted filesystem at `/mnt/deledger-backups`, separate from the PostgreSQL volume. The last good artifact is preserved when dump, encryption, checksum, or mount validation fails.

Weekly verification decrypts the newest checksum-valid artifact into a uniquely named, network-isolated PostgreSQL container built from the same Deledger PostgreSQL image as production. It checks the migration head, seven-table boundary, forced RLS, constraints, `pg_cron`, and executes a row-count query for every expected table before removing only its own generated container and volume. A failed or overdue verification makes readiness fail closed.

For disaster recovery, provision a clean host, restore the secret custody, validate the artifact checksum, restore into a clean PostgreSQL volume, run migrations only after inspection, and complete the Cloudflare/WARP checklist before reopening access.
