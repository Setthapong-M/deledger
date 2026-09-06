# Database and isolation standards

[schema.prisma](../../../api/prisma/schema.prisma) owns the source schema; Prisma migrations own history and Prisma clients own application access. `db/` bootstraps login roles; migration SQL defines constraints, grants and RLS.

## Transaction boundary

[withUserTransaction](../../../api/src/server/db/transaction.ts) verifies session/JWT, resolves identity, switches transaction-locally to `deledger_web`, sets owner context, locks the User, revalidates identity/session, catches up and runs the operation. Database steps share one transaction connection. Owner identity comes from this boundary, never caller-supplied owner headers/body fields.

| Role | Use |
| --- | --- |
| `deledger_web` | Restricted user work under forced RLS; neither table owner nor BYPASSRLS |
| `deledger_identity` | Scoped identity/operator/scheduler seam; BYPASSRLS, NOINHERIT; switches role for user work |
| PostgreSQL administrator | Bootstrap, migrations and authorized recovery; never frontend/ordinary API credentials |

Preserve explicit owner predicates and forced RLS. Financial writes lock and check expected revision. `P2034` retries the entire transaction with at most three attempts in total; local signup has a separate narrow unique-conflict retry, not blanket write retries. Avoid external side effects inside retryable transactions.

## SQL and schema

Use parameterized Prisma raw queries only for necessary PostgreSQL RLS/context, role switching, locking and metadata. Migration SQL may express features Prisma cannot represent. Each new exception needs a concrete reason and a real PostgreSQL test. Business SQL functions and another database-access library do not belong in use cases.

- Preserve exact Decimal storage, composite owner/month relationships and foreign keys. Test derived totals larger than single inputs.
- Add owner association, forced RLS and scoped grants with every new user-owned table. Verify with runtime roles, not just admin.
- Preserve applied migrations/checksums; add a new directory using the [migration workflow](../../guides_flows/migrations.md).
- Reset is not a normal migration repair. Verify database/project/volume and explicit authorization before a local/QAS reset; test wrappers target only `deledger_test`.

See [database access](../../../docs/operations/database-access.md) for operational credentials/networks.
