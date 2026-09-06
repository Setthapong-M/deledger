# Prisma migration workflow

1. Read [database standards](../standards/backend/database.md), [schema](../../api/prisma/schema.prisma) and current migrations. Identify constraints, owner relationships, RLS/grants and downstream readers.
2. Verify the exact development target before authoring. `prisma migrate dev` needs appropriate development/shadow databases and may request reset; never point it at QAS or accept an unexpected reset. Use an isolated disposable authoring database.
3. Update schema and add a new timestamp-and-description migration directory. Use installed Prisma CLI/help to generate a draft or author required SQL; preserve applied migrations/checksums.
4. Inspect SQL for data loss, numeric precision, constraints, indexes, RLS and grants. Explain/test PostgreSQL-specific exceptions. `pnpm db:migrate` uses `prisma migrate deploy` to apply committed migrations, not author them.
5. Run `pnpm db:generate` and `pnpm typecheck`; verify a fresh schema through integration tests. After the initial baseline, also test upgrading the previous Prisma schema with synthetic data: reset-only tests do not prove upgrade safety.
6. Test affected use cases and both runtime roles. Update readiness/release assertions when adding tables/invariants; review backup/restore effects.
7. Deploy through the [private-beta runbook](../../docs/operations/deploy-private-beta.md), explicitly building the migration image. Keep admin credentials separate from API runtime.

Set `MIGRATION_DATABASE_URL` and `DATABASE_URL` consistently for the intended admin target with local migration commands; see [prisma.config.ts](../../api/prisma.config.ts). QAS uses the file-secret runner in `infra/migrate/`.

The stack cutover intentionally started new history. That one-time decision does not authorize later resets or changes to applied migrations.
