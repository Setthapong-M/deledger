# Operator runbook

Use `pnpm operator:user invite --email <address>` to create an invited identity, then add that exact address to the Cloudflare Access allow policy. `archive`, `restore`, and `transfer-email` require an interactive confirmation. `export` writes an encrypted artifact only when an explicit output directory and `DELEDGER_EXPORT_KEY` are present.

QAS access remains Cloudflare Access first: an invited email with a valid Access JWT enters Deledger without a second application login or OTP. The profile page shows the QAS email and phone as read-only; only the optional date of birth can be edited. `DELEDGER_ENV=prod` is unsupported in this release and makes the Nest process fail during startup until the app-owned OTP design is delivered.

Archiving is a soft-delete lifecycle operation. It never removes financial rows. Restoration may require a fresh supplied opening and marks the gap in History when a calendar boundary was crossed.

For a private-route outage, check PostgreSQL and Tunnel. For the authorized public ingress, follow the [public QAS runbook](deploy-public-qas.md), including DNS, router, TLS and proxy peer restrictions. Nest retries catch-up every minute after startup; check API readiness after the database is healthy. Do not expose additional ports to troubleshoot.

The local host and Tunnel are best-effort and have no uptime SLA. `BACKUP_MODE=disabled` is the current temporary policy: there is no recovery path, and the backup/restore timers must remain disabled. Do not remove, replace, or recreate the only database volume unless permanent loss of all Deledger data is intended. When external storage becomes available, activate and verify the documented enforced backup mode before relying on recovery.

Operator commands run Nest service code through Prisma and use `IDENTITY_DATABASE_URL` with the scoped identity role, plus the normal runtime configuration. Exports include email and phone identity facts but exclude local sessions. The AES-256-GCM `DELEDGER-EXPORT-1` format is unchanged; decrypted amounts and revisions use exact strings.
