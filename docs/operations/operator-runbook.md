# Operator runbook

Use `pnpm operator:user invite --email <address>` to create an invited identity, then add that exact address to the Cloudflare Access allow policy. `archive`, `restore`, and `transfer-email` require an interactive confirmation. `export` writes an encrypted artifact only when an explicit output directory and `DELEDGER_EXPORT_KEY` are present.

Archiving is a soft-delete lifecycle operation. It never removes financial rows. Restoration may require a fresh supplied opening and marks the gap in History when a calendar boundary was crossed.

For an outage, check the PostgreSQL health state, the private Tunnel, and the backup mount. Run startup catch-up after the database is healthy. Do not expose a host port or bypass WARP to troubleshoot.

The local host and Tunnel are best-effort and have no uptime SLA. Keep the age identity offline and perform a restore drill before changing the only database volume.
