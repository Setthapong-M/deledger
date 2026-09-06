# Settle fresh-database cutover and full-system acceptance

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 03, 04, 06

## Question

Which verified local/QAS targets will be migrated, and what makes the entire migration complete? Choose target identity checks before destructive reset, fresh Prisma bootstrap/seed, isolated tests, operator commands, readiness, backup/restore and deployment verification. Agree test seams and evidence for every behavior in the inventory, treatment of current working changes, and rollback/recovery after replacing the old stack. Translate the resolved decisions into a spec and separate blocked implementation tickets before application work begins. No database reset during wayfinding.

## Answer

Validate fresh Prisma bootstrap against an isolated Deledger test database first. Verify actual database name, host/port, role, Compose project/volume and environment before any reset; never reset QAS by inferring its identity from an arbitrary URL. Retire old node-pg-migrate/pg_cron/business functions after all callers migrate. Preserve runtime/identity/operator privilege separation, local/QAS credentials/network separation, operator export encryption and encrypted backup/restore. Readiness checks Prisma migration state, connectivity, Nest scheduler and backup evidence. Baseline eight modified files are part of current source behavior and must be carried into matching replacements. Highest parity seam is real Nest HTTP + PostgreSQL, supplemented by pure domain tests, database RLS/constraints/atomicity tests, existing unchanged UI tests/E2E, and operations bootstrap/recovery tests. Execute on integration branch through complete vertical features; final green gate covers typecheck, build, unit/integration/E2E/ops, fresh migrations and legacy caller scan. No deployment to external infrastructure or public production is required. Full migration is incomplete until every implementation ticket and final gate pass.

## Comments

Resolved under explicit user delegation to the agent on 2026-09-06.
