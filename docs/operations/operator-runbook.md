# Operator runbook

Use `pnpm operator:user invite --email <address>` to create an invited identity, then add that exact address to the Cloudflare Access allow policy. `archive`, `restore`, and `transfer-email` require an interactive confirmation. `export` writes an encrypted artifact only when an explicit output directory and `DELEDGER_EXPORT_KEY` are present.

Archiving is a soft-delete lifecycle operation. It never removes financial rows. Restoration may require a fresh supplied opening and marks the gap in History when a calendar boundary was crossed.

For an outage, check the PostgreSQL health state and the private Tunnel. Run startup catch-up after the database is healthy. Do not expose a host port or bypass WARP to troubleshoot.

The local host and Tunnel are best-effort and have no uptime SLA. `BACKUP_MODE=disabled` is the current temporary policy: there is no recovery path, and the backup/restore timers must remain disabled. Do not remove, replace, or recreate the only database volume unless permanent loss of all Deledger data is intended. When external storage becomes available, activate and verify the documented enforced backup mode before relying on recovery.
