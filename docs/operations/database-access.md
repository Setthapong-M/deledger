# Database ownership and SQL exceptions

Prisma owns the nine application tables and the migration history. Nest owns financial calculations, identity, profile, month lifecycle, operator actions and scheduling. Next never receives database credentials.

`deledger_identity` resolves credentials and executes operator/maintenance operations with scoped table grants. An authenticated request resolves its identity, switches to `deledger_web` with `SET LOCAL ROLE`, binds the verified User and executes catch-up plus the requested operation in the same transaction. `deledger_web` has forced RLS and only the table operations needed by those services; snapshots are append-only and expense details cannot be updated in place. The migration administrator is never a runtime connection.

Permitted SQL exceptions:

| Facility | Reason | Evidence |
| --- | --- | --- |
| Transaction-local role and `set_config` | Bind verified identity on the same pooled connection; clear on commit/rollback | API database and QAS HTTP integration tests verify owner isolation, role restriction and connection reuse |
| User row and identifier advisory locks | Serialize financial revisions, archive/restore and first identity claims across processes | API accounting, identity and database tests cover concurrent writes, catch-up, contact claims and whole-transaction rollback/retry |
| Migration DDL for forced RLS, grants, checks, partial indexes and deferrable uniqueness | Preserve PostgreSQL invariants unsupported by the Prisma schema language | Fresh migrations, negative database permission tests, reorder tests and backup/restore smoke |
| Read `_prisma_migrations` metadata | Fail readiness for missing or unfinished shipped migrations; this is Prisma infrastructure metadata rather than business access | Operations readiness and compiled-container authenticated readiness smoke |

All values in runtime SQL are parameterized. Ordinary application reads and writes use Prisma model methods. No PostgreSQL business functions or pg_cron jobs remain. Money travels as decimal strings; revisions as bigint strings; date-only values are mapped explicitly and business calendar boundaries use Asia/Bangkok.

Use the checked-in Prisma migrations to bootstrap a new database. Before replacing an existing legacy volume, verify its Compose project, database name, role, port and selected volume against the intended Deledger environment. Automatic reset scripts accept only the disposable test target. Local and QAS resets are separate operator cutover actions; neither is inferred from an arbitrary connection string.
