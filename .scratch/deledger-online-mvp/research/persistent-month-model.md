# Persistent relational month model for the Deledger MVP

Researched: 2026-08-31
Scope: the smallest PostgreSQL ownership and operation model that makes the resolved Deledger month lifecycle executable without adding transaction accounting, bank accounts, or a global recurring-expense master.

## Recommendation

Use seven user-data tables: `app_user`, `user_identity_email`, `user_archive_period`, `reporting_month`, `balance_snapshot`, `monthly_recurring_expense`, and `monthly_expense_detail`. The first three preserve identity and lifecycle; the remaining four hold the financial record. A Financial Boundary does not need its own empty 1:1 table: the immutable `app_user.id` is its relational owner key, because the domain guarantees exactly one Financial Boundary per User. Put `owner_id` directly on every financial row and include it in every parent/child key so both foreign keys and RLS prevent cross-User attachment.

The model deliberately does **not** persist Starting Balance, Monthly Spending, detail total, Unitemized Spending, Partial status, Tracking Gaps, or reconciliation state. They are query results over stored observations and confirmations. Historical corrections therefore recalculate on read rather than running a fragile chain of cache updates. This follows the domain formula and correction decisions in [`CONTEXT.md`](../../../CONTEXT.md), [ADR 0001](../../../docs/adr/0001-closed-months-remain-correctable.md), and the validated [logic](../../../prototypes/deledger-logic-prototype.html) and [UI](../../../prototypes/deledger-ui-prototype.html) prototypes.

## Stored facts versus derived values

| Stored fact | Why it is stored |
|---|---|
| User UUID and lifetime email mappings | The internal owner is immutable even when the operator transfers identity to another verified email. |
| Archive and restore instants | They revoke access, preserve repeated archive history, and provide the evidence from which Tracking Gaps are shown. |
| Reporting month key, tracked-from date, opening source/input, Income, Ending Balance, and closure fact | These are the minimum Summary Inputs and lifecycle facts. A `NULL` Income or Ending Balance means it has not been explicitly confirmed; zero is a valid confirmed amount. |
| Balance Snapshot observation | Provisional evidence for an Open Month; it never becomes Ending Balance implicitly. |
| Month-owned ordered recurring item | The Monthly Expense Setup is the ordered set of these rows. There is no global master. |
| Monthly Expense Detail snapshot | It preserves the confirmed name, type, and amount independently from later setup edits, as required by [ADR 0002](../../../docs/adr/0002-monthly-expense-details-preserve-confirmed-facts.md). |

| Derived value | Exact derivation |
|---|---|
| Starting Balance | `opening_balance_input` when `opening_source = 'supplied'`; otherwise the immediately preceding calendar month's confirmed Ending Balance. If that Ending Balance is missing, Starting Balance is unknown. |
| Partial Month | `tracked_from > month_start`. A first-use or post-gap month starting on day 1 is a new supplied continuity segment but, under the glossary's exact definition, is not labelled Partial. |
| Latest Snapshot | Latest row by `observed_on DESC, recorded_at DESC, id DESC` for an Open Month. |
| Monthly Spending | `Starting Balance + Income - Ending Balance`, only when all three are present. It never sums Monthly Expense Details. |
| Provisional spending | For an Open Month with no Ending Balance, the same formula using Latest Snapshot as the reference balance; label it provisional, never Monthly Spending. |
| Detail total | Sum of the month's active confirmation rows. |
| Unitemized Spending | `Monthly Spending - detail total`; for an Open Month the UI may show the analogous provisional remainder. |
| Reconciliation state | Open = `Draft`. Closed with any missing Starting Balance, Income, or Ending Balance = `Needs Information`. Otherwise negative Monthly Spending or detail total greater than Monthly Spending = `Inconsistent`; otherwise `Reconciled`. |
| Tracking Gap | An archive period that crosses an Asia/Bangkok month boundary. Reporting Months are absent after the last month closes and before the restoration month; do not manufacture empty month rows. |

This makes the later UI prototype authoritative where the older logic prototype diverges: Ending Balance is a separate explicit confirmation and is **never inferred from a Balance Snapshot recorded on the month's final day** ([ADR 0003](../../../docs/adr/0003-manual-and-automatic-close-use-different-gates.md), [resolved flow ticket 04](../issues/04-first-use-and-history-prototype.md)).

## Table and constraint boundary

Amounts should use one exact type everywhere, recommended `numeric(15,2)`, with `CHECK (amount >= 0)` and no floating-point arithmetic. Currency is implicitly THB for the MVP; there is no currency column.

### 1. `app_user`

- `id uuid PRIMARY KEY`
- `created_at timestamptz NOT NULL`

The absence or presence of an open archive period derives active/Archived User state. The ordinary product has no hard-delete command and all financial foreign keys use `ON DELETE RESTRICT`.

### 2. `user_identity_email`

- `normalized_email text PRIMARY KEY`
- `owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT`
- `linked_at timestamptz NOT NULL`, `unlinked_at timestamptz NULL`
- `CHECK (normalized_email = lower(btrim(normalized_email)))`
- partial `UNIQUE (owner_id) WHERE unlinked_at IS NULL`

A lifetime-primary-key email cannot be silently reassigned to a second User. A verified identity transfer ends one mapping and creates/reactivates another for the same immutable User. Authentication maps the cryptographically verified Cloudflare email to the single current mapping and additionally rejects an open archive period. This implements the resolved manual lifecycle in [ticket 05](../issues/05-authentication-account-lifecycle.md) and the JWT-to-internal-UUID boundary researched in [the local stack note](./postgresql-cloudflare-zero-trust-path.md).

### 3. `user_archive_period`

- `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
- `owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT`
- `archived_at timestamptz NOT NULL`, `restored_at timestamptz NULL`
- `CHECK (restored_at IS NULL OR restored_at > archived_at)`
- partial `UNIQUE (owner_id) WHERE restored_at IS NULL`

The unique open row prevents two current archival episodes. The archive/restore commands lock `app_user`, so non-overlap of completed episodes is an operation invariant without requiring `btree_gist`. The interval is preserved indefinitely and is the source for the explicit Tracking Gap required by [ADR 0004](../../../docs/adr/0004-archival-creates-an-explicit-tracking-gap.md).

### 4. `reporting_month`

- `owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT`
- `month_start date NOT NULL`
- `tracked_from date NOT NULL`
- `opening_source text NOT NULL CHECK (opening_source IN ('supplied','prior_ending'))`
- `opening_balance_input numeric(15,2) NULL CHECK (opening_balance_input >= 0)`
- `income_amount numeric(15,2) NULL CHECK (income_amount >= 0)`
- `ending_balance_amount numeric(15,2) NULL CHECK (ending_balance_amount >= 0)`
- `closed_at timestamptz NULL`, `closed_by text NULL CHECK (closed_by IN ('manual','automatic'))`
- `revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0)`
- audit timestamps; `PRIMARY KEY (owner_id, month_start)`
- checks:
  - `month_start = date_trunc('month', month_start)::date`;
  - `month_start <= tracked_from AND tracked_from < (month_start + interval '1 month')::date`;
  - supplied opening requires a non-null input; prior-ending requires a null input and `tracked_from = month_start`;
  - `closed_at` and `closed_by` are either both null or both non-null.

`income_amount` starts `NULL` in every automatically created calendar month and is never copied from the prior month. First-use and post-gap onboarding explicitly supply Income since `tracked_from`, including zero. `revision` is an optimistic compare-and-swap token; every month mutation accepts the revision last read and returns `409 Conflict` on mismatch instead of overwriting a correction from another device.

### 5. `balance_snapshot`

- `id uuid PRIMARY KEY`
- `owner_id uuid NOT NULL`, `month_start date NOT NULL`
- `observed_on date NOT NULL`, `amount numeric(15,2) NOT NULL CHECK (amount >= 0)`
- `recorded_at timestamptz NOT NULL`
- `FOREIGN KEY (owner_id, month_start) REFERENCES reporting_month(...) ON DELETE RESTRICT`

There may be several observations on one date; the latest recorded observation wins only for the provisional display. The command checks that `tracked_from <= observed_on < next month start` and rejects every new Snapshot once the month is closed. An Ending Balance is written only by its dedicated confirmation/correction command.

### 6. `monthly_recurring_expense`

- `owner_id uuid NOT NULL`, `month_start date NOT NULL`, `id uuid NOT NULL`
- `position integer NOT NULL CHECK (position > 0)`
- `name text NOT NULL CHECK (btrim(name) <> '')`
- `kind text NOT NULL CHECK (kind IN ('fixed','variable'))`
- `fixed_amount numeric(15,2) NULL`
- `is_paused boolean NOT NULL DEFAULT false`
- `PRIMARY KEY (owner_id, month_start, id)`
- composite FK to `reporting_month`
- `CHECK ((kind = 'fixed' AND fixed_amount IS NOT NULL AND fixed_amount >= 0) OR (kind = 'variable' AND fixed_amount IS NULL))`
- `UNIQUE (owner_id, month_start, position) DEFERRABLE INITIALLY DEFERRED`

The table itself is the Monthly Expense Setup; a separate header table adds no information. Runtime operations never delete these rows: paused rows remain, and every new Reporting Month copies all rows and their order exactly once before that month becomes independent ([ticket 01](../issues/01-expense-detail-boundary.md)). The copy retains the item UUID as a month-scoped lineage token, but the composite key makes each month's row independent and no later read follows a live template. The deferred unique constraint lets a reorder transaction rewrite dense positions without transient collisions; PostgreSQL documents that unique constraints and foreign keys, rather than cross-row `CHECK`s, are the correct relational tools for these invariants ([constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)).

### 7. `monthly_expense_detail`

- `owner_id uuid NOT NULL`, `month_start date NOT NULL`, `setup_item_id uuid NOT NULL`
- `confirmed_name text NOT NULL CHECK (btrim(confirmed_name) <> '')`
- `confirmed_kind text NOT NULL CHECK (confirmed_kind IN ('fixed','variable'))`
- `confirmed_amount numeric(15,2) NOT NULL CHECK (confirmed_amount >= 0)`
- `confirmed_at timestamptz NOT NULL`
- `PRIMARY KEY (owner_id, month_start, setup_item_id)`
- composite FK to `monthly_recurring_expense(owner_id, month_start, id) ON DELETE RESTRICT`

Absence means unconfirmed; the primary key enforces at most one aggregate confirmation per setup item/month. Confirmation copies name and kind plus either the Fixed Expense's current `fixed_amount` or the supplied Variable amount. Cross-table equality cannot be a PostgreSQL `CHECK`, because PostgreSQL assumes a check references only the current row; the locked confirmation command enforces it ([PostgreSQL check-constraint limits](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS)). A Variable “edit amount” is atomically cancel-and-replace inside one transaction. Cancellation deletes the current confirmation, not the setup item.

## RLS and ownership

Enable and `FORCE ROW LEVEL SECURITY` on every owner-bearing table. The Next.js server validates Cloudflare's JWT, begins a transaction on one leased connection, and calls a narrowly granted, fixed-`search_path` identity resolver that returns an owner UUID only for the verified current email mapping with no open archive period. General runtime SQL cannot enumerate identity rows. The server then runs `set_config('deledger.user_id', $1, true)`. Policies use `owner_id = nullif(current_setting('deledger.user_id', true), '')::uuid` in both `USING` and `WITH CHECK` (and `app_user.id` in its own policy). The transaction-local flag prevents a pooled connection from leaking identity into the next request ([`set_config`](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SET), [row security and bypass roles](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [`CREATE POLICY`](https://www.postgresql.org/docs/current/sql-createpolicy.html)).

The runtime role must be `NOSUPERUSER NOBYPASSRLS`, not own the tables, and have no general DELETE privilege or arbitrary SQL endpoint. A separate maintenance role executes calendar catch-up. RLS is defense in depth; commands still derive `owner_id` from the verified server identity, never from browser input.

## Exact atomic operations

Every User command is one database transaction and follows one lock order: set transaction-local owner context; lock `app_user FOR UPDATE`; lock affected Reporting Months in ascending `month_start`; lock setup/detail rows after their parent month; re-read and validate state; compare `revision`; write; increment revision; commit. `SELECT ... FOR UPDATE` makes a waiter re-evaluate the latest row after the lock, and consistent lock order reduces deadlocks ([explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Read Committed behavior](https://www.postgresql.org/docs/current/transaction-iso.html)). Return the changed month plus IDs of summaries affected by derivation so the application refreshes them.

1. **Create first Reporting Month** — lock User; require active User with no month; insert the current Bangkok `month_start`, `tracked_from = Bangkok today`, `opening_source = supplied`, supplied balance and explicitly supplied Income (zero allowed); create no setup rows unless the User adds them. This is one transaction.
2. **Confirm/correct Income or Ending Balance** — lock and revision-check month; write the explicit amount. Ending Balance never reads or promotes a Snapshot. A correction to Ending Balance returns the immediate next continuity month as affected because its derived Starting Balance and summary change; no persisted aggregate requires an update.
3. **Record Balance Snapshot** — lock and revision-check month; require Open Month and observation inside its tracked interval; insert evidence and increment revision. Reject it for a Closed Month.
4. **Add/pause/unpause/reorder/edit setup** — lock/revision-check month. Add at the next position. Pause toggles only `is_paused`. Reorder rewrites positions in one deferred-constraint transaction. Editing name, kind, or Fixed amount is rejected while that item has a confirmation; the User first cancels it. No operation mutates another month's setup.
5. **Confirm a setup item** — lock month and item; require not paused and no existing detail. Fixed accepts no client amount and snapshots the locked `fixed_amount`; Variable requires the supplied actual aggregate. Insert the snapshot row and increment month revision. Multiple real payments are summed by the User into this one confirmation.
6. **Correct/cancel a detail** — lock month, item, and detail. Cancel deletes the confirmation. Variable edit deletes and reinserts the new snapshot atomically; Fixed correction cancels, edits setup if needed, then confirms again. This preserves the snapshot rule without exposing an intermediate state to another transaction.
7. **Manual Close** — lock/revision-check the Open Month, then re-derive Starting Balance, completeness, Monthly Spending, and detail total under the lock. Require the current `Asia/Bangkok` date to equal the month's final calendar date; require Starting Balance, Income, and Ending Balance; reject negative spending or details exceeding spending. Set `closed_by = manual` and `closed_at = now()`. Do **not** create a future Open Month while Bangkok is still on the final day. Closed months stay closed and correctable ([ticket 02](../issues/02-manual-close-semantics.md)).
8. **Correct a Closed Month** — use the same Income, Ending Balance, setup, and detail commands without reopening. Snapshot commands remain forbidden. Return every derived summary whose input changed (target month and, for Ending Balance, the immediately following `prior_ending` month) and refresh History in place.
9. **Archive User** — lock User; require no open archive period; insert it. Database authorization now fails closed immediately. Cloudflare allowlist/session revocation is an operator action outside the database transaction. Do not close a not-yet-due month early and do not create another month.
10. **Restore User** — lock User and its open archive period, run calendar catch-up through Bangkok today, then close the archive period. If the last Reporting Month is still the current Open Month, continue it. Otherwise require fresh Starting Balance and Income since restoration, and create the restoration month's supplied-opening row with `tracked_from = Bangkok today`. Copy Monthly Expense Setup once from the **most recent prior Reporting Month**, including paused rows and order: setup convenience continues, while balance continuity explicitly does not. A restoration on day 1 is a full month by the glossary; later restoration is Partial.
11. **Transfer email identity** — under the User lock, require operator verification, end the old current mapping, then create/reactivate the new lifetime mapping for the same owner. Any email already owned by another User fails its primary-key constraint.

## Automatic close and catch-up

Schedule one idempotent `catch_up_reporting_months(as_of_bangkok_date)` shortly after midnight with `cron.timezone = 'Asia/Bangkok'`, and invoke the same operation at application startup/before serving a current-month request. Never rely on pg_cron to replay downtime: its scheduler initializes from the current minute after startup, and large clock jumps can skip intermediate fixed-time jobs ([pg_cron README](https://github.com/citusdata/pg_cron/blob/e759d972c570e27887ae6b164f1f4eceddbc9559/README.md), [startup implementation](https://github.com/citusdata/pg_cron/blob/e759d972c570e27887ae6b164f1f4eceddbc9559/src/pg_cron.c#L760-L766), [large-jump behavior](https://github.com/citusdata/pg_cron/blob/e759d972c570e27887ae6b164f1f4eceddbc9559/src/pg_cron.c#L921-L929)).

For each User under the same per-User lock:

- Close every Open Month whose next Bangkok month boundary is on or before `as_of_bangkok_date`, regardless of missing/inconsistent inputs. Set `closed_by = automatic`; record the logical boundary instant as `closed_at`, even if catch-up executes later.
- If the User is active, after each closed/manual-closed month create the next missing calendar month, copy that immediately preceding setup exactly once, leave Income and Ending Balance absent, and continue closing/creating until the current calendar month exists Open. Thus multi-month downtime yields explicit Needs Information months rather than silently losing active tracking.
- If the User is archived, close only the last due Open Month and create **no** later rows. The archive interval supplies the Tracking Gap.

The composite month primary key, closure predicate, and one-transaction setup copy make retries idempotent. `INSERT ... ON CONFLICT` is suitable for the create race, followed by locking and rechecking the row ([PostgreSQL `INSERT`](https://www.postgresql.org/docs/current/sql-insert.html)). pg_cron also serializes overlapping executions of the same job, but correctness comes from database idempotency and row locks, not scheduler timing.

Bangkok calendar identity must be calculated explicitly, e.g. `(instant AT TIME ZONE 'Asia/Bangkok')::date`, with half-open month intervals; audit instants remain `timestamptz` ([PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html), [date/time types](https://www.postgresql.org/docs/current/datatype-datetime.html)).

## Consequences and remaining decisions

- The model fulfills the resolved low-input behavior with no global expense master, transaction rows, aggregate cache, reopen state, or hard deletion.
- An Ending Balance correction normally changes only its own Monthly Spending and the immediately following continuity month's Starting Balance/Monthly Spending. Later months depend on their own predecessor's independently confirmed Ending Balance; dependency also always stops at a `supplied` opening after a Tracking Gap. Query-time derivation therefore implements exactly the downstream set named by ADR 0001 without recursive stored rewrites.
- Per-User locking is intentionally conservative but appropriate for an invite-only private beta; optimistic `revision` additionally prevents stale-device overwrites. If a future command spans Users, it must define a global lock order or retry serialization failures as PostgreSQL requires.
- Copying post-gap setup from the most recent prior Reporting Month is consistent with “setup convenience” and does not infer any balance continuity. No local decision contradicts it.
- No unresolved product decision blocks `/to-spec`. A day-1 restoration is represented as a new supplied continuity segment but is not labelled Partial because `CONTEXT.md` defines Partial Month as beginning after the first calendar day.
