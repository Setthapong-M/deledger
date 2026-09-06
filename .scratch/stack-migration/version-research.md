# Stack migration: verified versions and PostgreSQL constraints

Research date: 2026-09-06. Source revision: `9264d45`. Research only; recommendations below are not additional user decisions.

## Published versions and recommendation

The repository pins are real published/current values, not evidence of corrupt package metadata. Root and web request Node `22.23.1`; the local runtime reports exactly that version. Root requests pnpm `11.1.3`; web has Next `16.3.3`, React `19.2.8`, TypeScript `7.0.2`, Tailwind `4.3.3`; PostgreSQL Dockerfiles use `18.6-bookworm`.

Read-only `npm view` queries on this date returned the following. Version-qualified registry URLs provide reproducible metadata independently of moving dist-tags.

| Package | Verified version | Constraint / migration recommendation |
| --- | --- | --- |
| Next | Existing `16.3.3`; latest `16.3.4` | Existing package requires Node >=20.9 and accepts React ^19.0.0. Preserve existing frontend pins initially. [Metadata](https://registry.npmjs.org/next/16.3.3) |
| Nest core | Latest `12.0.1` | Requires Node >=20 in metadata and matching common/platform-express ^12.0.0, RxJS ^7.1.0, reflect-metadata ^0.1.12 or ^0.2.0. Recommend matching Nest `12.0.1` core/common/platform-express. [Metadata](https://registry.npmjs.org/@nestjs%2fcore/12.0.1) |
| Prisma CLI/client/adapter | Stable `7.10.0`; `latest` points to `8.0.0-rc.13`, `prev` to `7.10.0` | Explicitly pin all three to `7.10.0`; do not install bare `latest`. CLI engines ^20.19, ^22.12, or >=24; TypeScript peer >=5.4.0. Existing Node and TS satisfy those declarations. [CLI metadata](https://registry.npmjs.org/prisma/7.10.0), [adapter metadata](https://registry.npmjs.org/@prisma%2fadapter-pg/7.10.0), [moving tags](https://registry.npmjs.org/-/package/prisma/dist-tags) |
| pnpm | Existing `11.1.3`; latest `12.3.4` | Existing version requires Node >=22.13. Preserve `11.1.3`. [Metadata](https://registry.npmjs.org/pnpm/11.1.3) |
| TypeScript | Latest `7.0.2` | Preserve existing compiler initially; validate the Nest build and generated Prisma client together. [Metadata](https://registry.npmjs.org/typescript/7.0.2) |
| PostgreSQL | Existing `18.6` | This release exists; Prisma 7 lists PostgreSQL 18 support. Preserve current major/patch. [PostgreSQL docs release banner](https://www.postgresql.org/docs/18/functions-admin.html), [Prisma 7 supported databases](https://www.prisma.io/docs/orm/v7/reference/supported-databases) |
| pg | Existing/latest `8.23.0` | Retain only through Prisma's PostgreSQL adapter for application access. [Metadata](https://registry.npmjs.org/pg/8.23.0) |

Nest's current guide is **11 → 12**, not 10 → 11. Nest 12 packages are ESM; Node 22 needs >=22.12 to consume them, including via `require(esm)`. Its schematics require >=22.22.3 on the 22 line. Existing 22.23.1 meets both. An ESM application with TypeScript `NodeNext` avoids mixing assumptions; the guide also permits CommonJS applications on compatible Node. [Nest migration guide](https://docs.nestjs.com/migration-guide)

This establishes declared compatibility, not a completed integration test. A generated-client compile, Nest HTTP bootstrap, database round trip, and full existing frontend build must verify the combination during implementation. Do not silently downgrade TS based on an older article recommending 5.9.

## Prisma 7 configuration

Prisma's documentation now defaults to Prisma 8 in some paths. Use `/docs/orm/v7/` for the selected stable line. Prisma 7 uses a required database driver adapter, moves CLI connection configuration to `prisma.config.ts`, and needs explicit environment loading. Configure the schema provider as `postgresql`, generator as `prisma-client`, and an explicit output under the API source tree. Instantiate the generated client with `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`. Keep CLI/migration and runtime credentials separate. Configure adapter pool size/connection timeout explicitly because pg defaults differ from older Prisma engines. [Prisma 7 upgrade guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)

The new generator emits TypeScript and supports `moduleFormat = "esm"` **and** `"cjs"`; “Prisma 7 cannot generate CJS” is false. For a compiled Node ESM API, recommend `moduleFormat = "esm"`, `generatedFileExtension = "ts"`, `importFileExtension = "js"`, package `type: module`, and NodeNext compilation. Validate the compiled output, not only a tsx development path. Keep the generated server client out of Next/browser imports. [Generator reference](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators)

## Transactions, RLS, locking

Prisma 7 interactive `$transaction(async tx => ...)` keeps its queries on one connection. It supports isolation level, acquisition wait, and execution timeout options. Serializable write conflicts/deadlocks surface as P2034 and require bounded whole-transaction retry when that policy is chosen. Keep network requests outside the transaction. [Prisma 7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)

PostgreSQL `set_config(name, value, true)` lasts only for the current transaction. Therefore the recommended tenant seam sets a parameterized authenticated identity on `tx`, then executes **every** tenant query through that same `tx`; setting identity on the root client before a separate query is unsafe with pooling. This is an inference from the two transaction guarantees, to be proven with concurrent-user and connection-reuse tests. [PostgreSQL settings functions](https://www.postgresql.org/docs/18/functions-admin.html)

The runtime role must not be superuser or have BYPASSRLS. Table ownership normally bypasses RLS unless FORCE ROW LEVEL SECURITY is used. Use separate migration owner and restricted runtime roles, explicit user filters as appropriate, and RLS policies covering both reads and writes. Constraints bypass row security, so map uniqueness/foreign-key errors without leaking another user's data. [PostgreSQL row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)

Raw SQL remains justified for transaction-local identity, RLS DDL, and required row/advisory locks. Keep it parameterized and behind a small reviewed database seam; do not move business calculations back into SQL under that exception. Revision compare-and-update, dependent writes, snapshot updates, and next-month propagation belong in one Nest operation/Prisma transaction. Tests must exercise stale revisions, competing close/edit operations, rollback, and cross-user isolation; these are application requirements, not guarantees supplied automatically by choosing an ORM.

## Types and migrations

Prisma Decimal uses Decimal.js; BigInt does not serialize with normal JSON.stringify; DateTime input uses JavaScript Date objects. Recommend constructing money from validated decimal strings, never converting through JS floating-point arithmetic, explicitly mapping money and BigInt to existing wire formats, and distinguishing date-only/month keys from instants. Compute calendar boundaries with Asia/Bangkok explicitly. ORM Date objects alone do not preserve the domain's business timezone rules. [Prisma special fields](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types)

Prisma Migrate supports creating a migration with `--create-only`, editing its SQL for unsupported schema features, then applying and committing that migration. RLS/check constraints/grants that the schema cannot fully express must live in the Prisma-owned migration history, with assertions against a freshly migrated database. Prisma schema and custom migrations together become the source; `db push` is insufficient for release verification. Do not retain old business functions/triggers just because custom migrations support them. [Unsupported database features](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features)

The user permits a fresh database, but this research performed no reset, connection mutation, application changes, or installs. Implementation must verify the actual Deledger target before destructive reset and prove a clean bootstrap including role setup, migration application, client generation, and deterministic seed.
