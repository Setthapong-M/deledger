# Settle Prisma transactions and Nest-owned month lifecycle

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 01, 02

## Question

Choose the transaction and locking model for User isolation, stale revisions, simultaneous writes, archive/restore, catch-up and background Automatic Close. Specify the exact SQL exceptions and their tests, privileged operator/maintenance access, retry policy, database invariants versus Nest business rules, and how scheduled work remains idempotent across restarts and replicas. Preserve Asia/Bangkok and exact money representations, distinct close gates, one-time setup copies and confirmation snapshots, downstream correction behavior and Tracking Gaps. Decide how existing pg_cron/function paths are replaced rather than retained as hidden business owners.

## Related decision

[Decide preservation versus correction for existing inconsistencies](06-parity-discrepancies.md) owns the catch-up, closed-detail and downstream parity ambiguities exposed by research. Do not assume its pending resolutions.

## Answer

All ordinary database access uses Prisma model operations. Separate restricted User client and privileged identity/operator/maintenance client replace SECURITY DEFINER business entry points. Auth performs cryptographic verification outside database transactions; identity lookup, archive check, owner binding, catch-up and requested mutation execute atomically on one Prisma transaction. User operations serialize on app_user FOR UPDATE, then revision comparison under that lock; operator/archive/catch-up take the same lock. Transaction-local RLS setting and locks use parameterized raw SQL; checks/partial indexes/deferrable uniqueness and grants use Prisma custom migrations. Lock ownership and all tenant access remain inside the same transaction. Use bounded P2034 retry for database conflicts only, never retry a DomainError stale revision. Nest owns exact Decimal/string calculations and injected Bangkok clock, startup/background/request catch-up. Periodic catch-up is idempotent across replicas through User locks, catches missed months in one pass, and never creates tracking inside archive/resume gaps. SQL contains no lifecycle/auth/calculation business functions. Money and revisions remain strings in JSON. Clock changes are a test seam, not a runtime environment override.

## Comments

Resolved under explicit user delegation to the agent on 2026-09-06.
