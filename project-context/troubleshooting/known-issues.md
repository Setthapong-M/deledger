# Known issues

These are reproduced migration/release findings, not claims about current outages. Inspect current code before applying a remedy. Evidence: [validation](../../.scratch/stack-migration/validation.md).

| Symptom | Cause / check | Correct response |
| --- | --- | --- |
| Local rejects Cloudflare config | Inherited QAS environment | Use local launcher; E2E clears team/audience/tunnel variables. Retain strict environment checks. |
| `/months/current` treated as month key | Parameter route registered first | Preserve literal-before-parameter controller ordering; test real HTTP. |
| Profile reverts after save | Disposed fetch resolves after newer state | Ignore obsolete effect results; test controlled response order. |
| Migration attempts `pg_cron` | Cached legacy operations-profile image | Use runbook `run --rm --build migrate`; inspect image/target instead of adding old extensions. |
| E2E Next lock failure | Same-checkout local Next uses `.next/dev` | Stop owning dev process or use a separate checkout; ports do not isolate build directories. |
| Ready fails, live passes | Migration, scheduler or backup readiness | Check readiness implementation, migration state and scheduler in correct environment; liveness is only HTTP process health. |
| QAS uninvited after reset | New database has no invitations | Follow operator invite and Access allow-policy workflow; retain JWT verification. |
| JWKS fetch fails | Egress/DNS/TLS/team URL | Check `api-egress` and configured HTTPS domain; preserve private inbound networks. |
| Runtime image scan fails | Host permissions or development maps | Preserve API build/runtime split and compiled artifact ownership; exclude dependency maps and scan as runtime user. |
| Revision conflict | Concurrent change to owner/month | Reconcile against latest response; do not blindly replay with a new revision. |

New entries need reproduction, affected commit/version, root cause, fix evidence and remaining limitation. Keep credentials and personal data out. Route financial symptoms through accounting tests/glossary before changing calculations.
