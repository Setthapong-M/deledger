# Inventory current behavior and choose preservation tests

Type: research
Label: wayfinder:research
Status: resolved
Owner: /root/behavior_inventory
Blocked by: None

## Question

What exact user, operator, scheduler and database behaviors must move, and where are they implemented and tested at HEAD plus the preserved working changes? Inventory API contracts (including local identity/profile), database functions/triggers/constraints/RLS/cron, domain derivations, deployments and recovery. Identify uncovered cases and discrepancies between docs and implementation. Propose a concrete behavior matrix and the highest useful seams for parity verification; recommendations are not user-approved decisions.

## Deliverable

A repository-source-cited inventory on a `research/` branch, linked here with its branch/commit and local location. No application changes.

## Answer

Complete repository-source inventory: [behavior-inventory.md](../behavior-inventory.md). Covers all HTTP contracts, financial derivations and lifecycle, nine application tables, fifteen database functions, RLS/constraints/cron, local/QAS identity/profile, operator commands, deployment/recovery/UI and existing test seams. Research inspected source and preserved diff; did not execute tests or change application/database state.

Primary source branch: `research/stack-migration-behavior` at `52cd9f2914c2d8c916d2a74f48f6a43dc2a851d1`. Worktree: `/tmp/deledger-research-behavior`; artifact copied into main workspace. Only artifact committed on research branch.

Decisions must explicitly reconcile: multi-month catch-up creates intermediate open rows until a later invocation; closed detail PUT permits replacement/new confirmation despite hidden UI action; downstream dependency is immediate preceding Ending Balance; existing contact replacement can conflict with its own active-owner unique index; export/restore lists omit newer identity tables. These are source findings, not approved product changes. Request transaction invokes catch-up once before its operation; no automatic second catch-up inside that wrapper.
