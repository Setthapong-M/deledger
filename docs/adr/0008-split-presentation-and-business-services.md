# Separate presentation from business services with NestJS and Prisma

Status: accepted

Next.js retains the existing presentation and same-origin API forwarding, while NestJS owns authentication, API contracts, accounting, identity, operator actions and scheduling; Prisma owns PostgreSQL access, schema and a fresh migration history. This replaces the single-Next topology of ADR 0005/0007 and the stored-function ownership without changing their local/QAS isolation, Cloudflare Access/WARP private ingress or fail-closed production boundary; old data need not be migrated.

Prisma transactions bind a verified User to transaction-local RLS and serialize changes with User locks. PostgreSQL-specific locking, RLS, grants and unsupported constraints remain narrowly documented SQL exceptions; money and calendar rules stay in Nest. The extra process and internal privileged identity seam cost operational complexity but make business ownership explicit and preserve atomic financial behavior.
