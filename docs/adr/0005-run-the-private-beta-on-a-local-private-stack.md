# Run the private beta on a local private stack

The MVP runs one local Next.js application and open-source PostgreSQL database behind a Cloudflare private Access application, named Tunnel, and mandatory Cloudflare One Client rather than Vercel and Supabase. This keeps service subscriptions at zero and avoids a public domain during the private beta, at the cost of client installation, best-effort local uptime, and operator-owned patching, monitoring, encrypted off-device backups, and recovery.
