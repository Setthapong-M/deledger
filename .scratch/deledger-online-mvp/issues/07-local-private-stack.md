# Adopt the local private MVP stack

Type: research
Status: resolved
Blocked by:

## Question

Can the managed Vercel and Supabase path be replaced by a local Next.js and open-source PostgreSQL deployment that invited Users reach through Cloudflare Zero Trust without a public domain?

## Answer

Run one local Next.js application and one local open-source PostgreSQL database. Connect only the web application to a named Cloudflare Tunnel and expose it as a private Access application reached through the Cloudflare One Client in Traffic and DNS mode; never expose PostgreSQL port 5432. Allow exact invited emails with Cloudflare Email OTP, validate the Access JWT at the application boundary, map its identity to an internal immutable User, and propagate that User only transaction-locally for PostgreSQL ownership policies. Use `pg_cron` plus idempotent catch-up operations for calendar work, encrypted off-device backups, and restore tests. The private beta is best effort with no SLA; its accepted recovery point is 24 hours with 30 days of backup retention. Full evidence and constraints: [Local PostgreSQL + Cloudflare Zero Trust](../research/postgresql-cloudflare-zero-trust-path.md).

This decision supersedes the Vercel + Supabase deployment path recorded by ticket 03. A public domain remains optional and deferred because every MVP User installs the Cloudflare One Client.
