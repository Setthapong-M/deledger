# Verify supported versions and Prisma PostgreSQL constraints

Type: research
Label: wayfinder:research
Status: resolved
Blocked by: None

## Question

Which mutually compatible, published versions and runtime configuration should the selected stack use? Verify the actual repository package/runtime pins against official Next.js, NestJS, Prisma and PostgreSQL documentation and package metadata. Check Prisma's current major, ESM/CJS and generator/adapter configuration, transactions and connection-local RLS context, Decimal/BigInt/date serialization, migration customization and unsupported PostgreSQL features. Separate verified facts from recommendations and report uncertainty rather than assuming an older assessment was right. Do not reconsider stack selection.

## Deliverable

A cited research artifact on a `research/` branch, linked here with its branch/commit and local location. No application changes.

## Answer

Verified published package metadata and official documentation. Recommend preserving Node 22.23.1 / pnpm 11.1.3 / Next 16.3.3 / TS 7.0.2 / PostgreSQL 18.6, adding matching Nest 12.0.1 packages and explicitly pinned Prisma CLI/client/adapter 7.10.0. Prisma latest currently resolves to 8.0.0-rc.13, so unqualified installs are unsuitable. Prisma 7 supports the required PostgreSQL features through its transaction API and narrowly scoped custom SQL/migrations; the artifact defines configuration and tests needed to establish runtime parity. This is a research recommendation, not an additional user decision.

Artifact: [version-research.md](../version-research.md). Research branch: `research/stack-migration-versions`; commit: `bb03021`; isolated source: `/tmp/deledger-research-versions/.scratch/stack-migration/version-research.md`. Artifact copied into this workspace for map/spec consumption. No application changes or database reset.
