# Add or change a use case

1. Define behavior in the effort tracker; read glossary, applicable ADRs and [impact map](../architecture/impact-map.md). Identify what changes atomically.
2. Select the closest route/service/domain example. Put deterministic derivations in domain and orchestration in a service taking the existing transaction client/verified owner context.
3. Add validation and shared envelope/error mapping. Register the controller route, with literal paths before competing parameters. Retain the common authentication/transaction boundary.
4. Implement Prisma repository operations. Complete the [migration workflow](migrations.md) if schema changes; inspect owner filters, RLS and rollback.
5. Update frontend API types/UI for contract changes. Consume server reconciliation/capabilities; handle conflicts without silent overwrites.
6. Prove the risk boundary: domain tests for arithmetic, PostgreSQL tests for atomicity/isolation, component tests for interaction and E2E for cross-process behavior.
7. Run selected gates, review the diff and update owning documentation when conventions/boundaries change.

Done means the requested route-to-database behavior works, failure/authorization paths are covered and consumers agree. A controller stub or mocked-only journey does not prove database correctness.
