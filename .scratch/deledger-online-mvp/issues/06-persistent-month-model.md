# Define the persistent month model

Type: research
Status: resolved
Blocked by: 01, 02, 05, 07

## Question

Using the resolved Deledger domain decisions, local prototypes, ADRs, and secure-stack research as primary sources, define the smallest relational ownership and operation model that preserves one private Financial Boundary per User, ordered month-owned Monthly Expense Setup snapshots, confirmation-time Monthly Expense Details, first-use and post-archive Partial Months, Tracking Gaps, automatic and manual closure, downstream recalculation, and safe concurrent corrections. Produce table and constraint boundaries plus the atomic database operations that `/to-spec` must make executable, without scaffolding production code.

## Answer

Use seven owner-scoped PostgreSQL tables for immutable User identity, email mappings, archive periods, Reporting Months, Balance Snapshots, month-owned Monthly Recurring Expenses, and confirmation-snapshot Monthly Expense Details. Store only source facts; derive Starting Balance, Partial Month, Tracking Gaps, Monthly Spending, detail total, Unitemized Spending, and reconciliation state on read. Protect every financial row with direct `owner_id` RLS, transaction-local verified identity, composite ownership keys, row locks, and per-month optimistic revisions.

All mutations are atomic and recheck their rules under lock. Manual Close never creates a future month; automatic catch-up creates and closes every missed calendar month for an active User but creates none inside an Archived User's Tracking Gap. Restoration uses a fresh supplied opening and Income while copying only setup convenience from the most recent Reporting Month. Full tables, constraints, derived formulas, concurrency behavior, citations, and eleven operation boundaries: [Persistent relational month model](../research/persistent-month-model.md).
