# Run local development alongside QAS

Status: accepted

The private beta remains behind Cloudflare Access and a named Tunnel as recorded in ADR 0005. Development also provides a separate local environment that uses the same source code, a loopback-only Next.js process, and a dedicated PostgreSQL database, volume, network, credentials, and local-session cookie. Local authentication accepts one email or Thai mobile identifier without a password or OTP so developers can switch test Users quickly.

The environment selector is explicit: `local` enables the local session adapter, `qas` keeps Cloudflare Access JWT validation and invitation checks, and an invited QAS User enters Deledger immediately after Cloudflare approval without a second app login. QAS email and phone fields remain read-only in this release. `prod` remains unavailable until an app-owned OTP design is approved; a production process fails during startup rather than silently selecting QAS. Local data and credentials never target the QAS database, and local setup commands fail closed when pointed at a non-local database. This is a development convenience and does not change the private-beta deployment, Cloudflare policy, or public production boundary.
