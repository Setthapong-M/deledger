# Online Deledger MVP — Executable Technical Specification

Status: ready for implementation planning
Date: 2026-08-31
Business timezone: `Asia/Bangkok`
Currency: THB only

## 1. Authority and purpose

This specification turns the resolved Online Deledger MVP decision map into one executable system contract. A fresh implementation agent must be able to derive an implementation plan from this file without reopening product decisions.

When artifacts disagree, use this order:

1. [Domain glossary](../../CONTEXT.md) and accepted [ADRs](../../docs/adr/)
2. This specification
3. Resolved tickets in [the decision map](./map.md)
4. [Persistent relational model research](./research/persistent-month-model.md)
5. [UI prototype](../../prototypes/deledger-ui-prototype.html) for layout and interaction evidence
6. [Logic prototype](../../prototypes/deledger-logic-prototype.html) for scenarios; the later domain decisions override its older Ending Balance and global-template behavior

## 2. Product outcome

Deliver an invite-only responsive web application that lets each User calculate monthly Income and Expense totals from a single aggregate Financial Boundary without reconstructing individual transactions.

The MVP succeeds when a User can:

- start or resume tracking with only Starting Balance and Income since the start date;
- record Balance Snapshots whenever remembered during an Open Month;
- confirm a separate Ending Balance;
- enter monthly Recurring Expense Details from low-friction fixed and variable chips;
- close a coherent month manually on its final Bangkok calendar day;
- rely on unconditional Automatic Close after the calendar boundary;
- correct Closed Months without reopening them;
- scan complete, incomplete, inconsistent, and paused-tracking history through the validated filmstrip plus Cover Flow UI; and
- access only their own data through Cloudflare WARP and Access.

## 3. Explicit scope

### In scope

- One Financial Boundary and one immutable internal User UUID per invited person
- Cloudflare Access Email OTP, exact-email invitation, and mandatory Cloudflare One Client
- Domainless private hostname `deledger.internal` over a named Cloudflare Tunnel
- One local Next.js application and one local open-source PostgreSQL database
- THB amounts with two decimal places
- Partial Months for mid-month first use and post-Tracking-Gap resumption
- Balance Snapshots, aggregate Income, explicit Ending Balance, monthly setup, fixed/variable confirmations, closure, correction, archive, restoration, identity transfer, and operator-assisted export
- Daily encrypted off-device backup, 30-day backup retention, and best-effort local operation

### Out of scope

- Credit cards and billing cycles
- Named bank accounts, Internal Transfers as entries, bank APIs, imported transactions, and individual Transaction Details
- Ad-hoc expense items and categories; one-offs remain Unitemized Spending
- Cash as a separate balance source
- Multi-currency and exchange-rate conversion
- Public hostname, domain deployment, clientless access, Vercel, and Supabase
- Self-registration, password authentication, User profile, User-facing export/delete, and administration UI
- Permanent User deletion in the normal product lifecycle
- Native mobile applications and offline-first synchronization
- Notifications, forecasts, spending-speed meters, budgets, analytics, and trend charts
- Source Git actions and automated unit/integration/E2E test implementation; these require separate explicit authorization

## 4. Runtime architecture

```text
Invited User browser
  → Cloudflare One Client (Traffic and DNS mode)
  → Cloudflare Access private application: http://deledger.internal:80
  → named Cloudflare Tunnel
  → cloudflared container
  → Next.js standalone container on private edge network
  → pg driver transaction
  → PostgreSQL + pg_cron on private data network
```

No host inbound port is published. PostgreSQL has no host port mapping and is reachable only from the application container on the private Docker data network. The browser URL is plaintext HTTP port 80 because Cloudflare Access currently issues an application token to plaintext private applications on port 80 without Gateway TLS decryption; WARP and Tunnel provide the encrypted network path. The MVP must not use this HTTP origin outside WARP.

### Pinned implementation baseline

| Component | Version |
|---|---:|
| Ubuntu host | 24.04 |
| Docker Engine | 29.2.1 |
| Docker Compose | 5.0.2 |
| Node.js container/runtime | 22.23.1 |
| Next.js | 16.3.3 |
| React / React DOM | 19.2.8 |
| TypeScript | 7.0.2 |
| PostgreSQL | 18.6 |
| pg_cron | 1.6.7 |
| cloudflared | 2026.7.2 |
| pg | 8.23.0 |
| jose | 6.2.10 |
| zod | 4.5.4 |
| node-pg-migrate | 9.0.0 |
| pnpm | 11.1.3 |

The implementation must pin exact versions in the lockfile and container image tags. Renovation is a later maintenance operation, not part of the initial build.

### Intended source layout

```text
web/
  src/app/
    start/page.tsx
    resume/page.tsx
    month/page.tsx
    history/page.tsx
    api/bootstrap/route.ts
    api/onboarding/route.ts
    api/resume/route.ts
    api/months/...
    api/health/live/route.ts
    api/health/ready/route.ts
  src/components/
  src/server/auth/
  src/server/db/
  src/server/domain/
  src/server/repositories/
  src/server/services/
  Dockerfile
db/
  Dockerfile
  migrations/
infra/
  compose.yaml
  cloudflare/
  backup/
scripts/
  operator/
```

The application must keep browser components, HTTP parsing, domain calculation, database access, and operator actions in separate modules. Browser code never imports `src/server`.

## 5. Configuration contract

The deployment requires these values, supplied as Docker secrets or environment variables and never committed:

| Name | Consumer | Meaning |
|---|---|---|
| `APP_ORIGIN` | web | Exact origin `http://deledger.internal` |
| `BUSINESS_TIME_ZONE` | web/db | Fixed value `Asia/Bangkok` |
| `DATABASE_URL` | web/operator | PostgreSQL URL using the private Compose service |
| `CLOUDFLARE_TEAM_DOMAIN` | web | `https://<team>.cloudflareaccess.com` |
| `CLOUDFLARE_ACCESS_AUD` | web | Access application audience |
| `CLOUDFLARE_TUNNEL_TOKEN` | cloudflared only | Named Tunnel connector token |
| `BACKUP_AGE_RECIPIENT` | backup job | Public recipient used to encrypt dumps |
| `BACKUP_TARGET` | backup job | Fixed deployment path `/mnt/deledger-backups` |

The web container must not receive the Tunnel token or backup private key. The database role used by web must not own tables, be superuser, or have `BYPASSRLS`.

## 6. Identity and access contract

### Cloudflare configuration

- Create a private hostname route for `deledger.internal` through the named Tunnel.
- Configure the container DNS/network alias so `cloudflared` resolves `deledger.internal` to the web container.
- Create one self-hosted private Access application for hostname `deledger.internal` and port `80`.
- Enable Email One-time PIN and “Authenticate with Cloudflare One Client”.
- Allow exact invited emails only; do not allow a wildcard email domain.
- Add a Gateway rule allowing the Access private application and a lower-priority catch-all block for the routed private space.
- Require Cloudflare One Client enrollment with the same exact-email population in Traffic and DNS mode.

### Per-request application identity

Every protected request must:

1. Read `Cf-Access-Jwt-Assertion`; reject a missing value.
2. Verify RS256 signature with the JWKS at `<team-domain>/cdn-cgi/access/certs` using `jose`.
3. Verify `iss`, application `aud`, `exp`, `nbf`, and token type.
4. Normalize the verified email with `lower(trim(email))`.
5. Resolve exactly one current `user_identity_email` mapping.
6. Reject an unknown email or a User with an open `user_archive_period`.
7. Begin one database transaction on one leased Pool client.
8. Set `set_config('deledger.user_id', owner_uuid, true)`.
9. Execute every User query and commit/rollback on that same leased client.

The application must not accept `owner_id`, email, or Cloudflare subject from browser JSON. JWKS keys may be cached in memory; an unknown `kid` forces one refresh before rejection.

### User lifecycle

- Invite: operator creates the immutable User and current email mapping before adding the email to Cloudflare.
- Archive: operator inserts an open archive period, then removes the Cloudflare allow rule/session. Database authorization fails closed immediately even if Cloudflare revocation lags.
- Restore: while the User is still archived, the operator first runs catch-up. The operator then closes the archive period and re-adds Cloudflare access. If the current Open Month still exists, the User continues it. If the archive crossed a Bangkok month boundary, the same transaction sets `resume_required_at`; `/resume` later collects a fresh balance and Income, creates the new continuity segment, and clears the flag atomically.
- Email transfer: operator ends the prior current mapping and creates/reactivates the verified new mapping for the same User UUID.
- Export: operator writes all owner rows plus derived monthly summaries to encrypted JSON and CSV output.
- Hard delete: no ordinary command exists.

## 7. Persistent data model

All monetary columns use PostgreSQL `numeric(15,2)` and `CHECK (amount >= 0)`. JSON sends monetary values as decimal strings such as `"1250.00"`, never JavaScript floating-point numbers.

### `app_user`

| Column | Constraint |
|---|---|
| `id uuid` | primary key; generated by the application |
| `created_at timestamptz` | not null |
| `resume_required_at timestamptz` | nullable; blocks automatic month creation until fresh Summary Inputs are supplied |

There is no empty one-to-one Financial Boundary table; `app_user.id` is the immutable owner key for the User's single Financial Boundary.

`resume_required_at` is a transient persisted lifecycle fact, not a deletion state. Operator restoration sets it only when archival crossed a Bangkok month boundary. `POST /api/resume` creates the supplied-opening month and clears it in the same transaction. First-time invited Users leave it null and use onboarding instead.

### `user_identity_email`

| Column | Constraint |
|---|---|
| `normalized_email text` | primary key; equals `lower(btrim(value))` |
| `owner_id uuid` | FK to `app_user`, delete restricted |
| `linked_at timestamptz` | not null |
| `unlinked_at timestamptz` | nullable |

Use a partial unique index allowing at most one current email mapping per User. A lifetime email row cannot be reassigned to another User.

### `user_archive_period`

| Column | Constraint |
|---|---|
| `id bigint` | generated identity primary key |
| `owner_id uuid` | FK to `app_user`, delete restricted |
| `archived_at timestamptz` | not null |
| `restored_at timestamptz` | nullable and later than `archived_at` |

Use a partial unique index allowing at most one open archive period per User.

### `reporting_month`

| Column | Constraint |
|---|---|
| `owner_id uuid` | FK to `app_user` |
| `month_start date` | first calendar date; composite primary key with owner |
| `tracked_from date` | within this calendar month |
| `opening_source text` | `supplied` or `prior_ending` |
| `opening_balance_input numeric(15,2)` | required only for `supplied` |
| `income_amount numeric(15,2)` | nullable means not explicitly confirmed |
| `ending_balance_amount numeric(15,2)` | nullable means not explicitly confirmed |
| `closed_at timestamptz` | nullable |
| `closed_by text` | nullable; `manual` or `automatic` |
| `revision bigint` | not null, starts 0, increments for each month mutation |
| audit timestamps | not null |

Checks must require:

- `month_start` is the first day of its month;
- `month_start <= tracked_from < next_month_start`;
- supplied opening has an input;
- prior-ending opening has no input and `tracked_from = month_start`; and
- `closed_at` and `closed_by` are both null or both non-null.

Every automatically created month starts with `income_amount = NULL` and `ending_balance_amount = NULL`. Income is never copied from the previous month.

### `balance_snapshot`

| Column | Constraint |
|---|---|
| `id uuid` | primary key |
| `owner_id, month_start` | composite FK to Reporting Month |
| `observed_on date` | inside the tracked interval |
| `amount numeric(15,2)` | non-negative |
| `recorded_at timestamptz` | not null |

Multiple same-day observations are allowed. Latest order is `observed_on DESC, recorded_at DESC, id DESC`. New snapshots are forbidden after closure. A final-day Snapshot never becomes Ending Balance automatically.

### `monthly_recurring_expense`

| Column | Constraint |
|---|---|
| `owner_id, month_start, id` | composite primary key and month FK |
| `position integer` | positive |
| `name text` | trimmed, non-empty |
| `kind text` | `fixed` or `variable` |
| `fixed_amount numeric(15,2)` | required only for fixed |
| `is_paused boolean` | not null |

Use a deferred unique constraint on `(owner_id, month_start, position)`. The rows themselves are Monthly Expense Setup; no global master exists. Copy rows once when creating the next month, retaining item UUID, paused state, and order while making all copied fields independently editable.

Rows are never deleted by the product. A mistaken item is paused.

### `monthly_expense_detail`

| Column | Constraint |
|---|---|
| `owner_id, month_start, setup_item_id` | composite primary key and FK to setup item |
| `confirmed_name text` | non-empty snapshot |
| `confirmed_kind text` | `fixed` or `variable` snapshot |
| `confirmed_amount numeric(15,2)` | non-negative snapshot |
| `confirmed_at timestamptz` | not null |

Absence means not confirmed. The primary key permits one aggregate confirmation per setup item and month. Cancellation deletes the confirmation row, not its setup item. A confirmed fact never reads name, kind, or amount live from setup.

### Ownership enforcement

Put `owner_id` directly on every private row. Every child FK includes owner and parent key. Enable and force RLS on every owner-bearing table, with `USING` and `WITH CHECK` equivalent to:

Apply both `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY` and `ALTER TABLE <table> FORCE ROW LEVEL SECURITY` to all seven tables; the migration owner is never the running web role.

```sql
owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid
```

For `app_user` use `id` instead of `owner_id`. Identity resolution and maintenance use narrowly granted fixed-`search_path` functions/roles; the web role cannot enumerate identity rows or perform general deletes.

## 8. Derived monthly model

Do not persist or cache these values:

| Value | Derivation |
|---|---|
| Starting Balance | supplied opening input, otherwise the immediately preceding calendar month's confirmed Ending Balance |
| Partial Month | `tracked_from > month_start` |
| Latest Snapshot | latest Snapshot ordering defined above |
| Monthly Spending | `Starting Balance + Income - Ending Balance` when all are known |
| Provisional spending | same formula using Latest Snapshot only for an Open Month without Ending Balance |
| Detail total | sum of confirmed detail amounts |
| Unitemized Spending | `Monthly Spending - detail total` |
| Tracking Gap | missing calendar interval covered by an archive period crossing a month boundary |

Reconciliation precedence is exact:

1. Open Month → `Draft`.
2. Closed Month missing Starting Balance, Income, or Ending Balance → `Needs Information`.
3. Otherwise Monthly Spending below zero or detail total above Monthly Spending → `Inconsistent`.
4. Otherwise → `Reconciled`.

A Closed Month correction recalculates the target month on read. Correcting Ending Balance also changes only the immediately following `prior_ending` month's derived Starting Balance and summary. A supplied opening after a Tracking Gap ends dependency.

## 9. Mutation and concurrency contract

All User mutations use one transaction and this lock order:

1. set transaction-local owner;
2. lock `app_user FOR UPDATE`;
3. lock affected Reporting Months in ascending `month_start`;
4. lock setup and detail rows after their parent month;
5. compare the client `expectedRevision` with the locked month revision;
6. re-derive and recheck every rule;
7. write facts and increment revision once; and
8. commit.

A stale revision returns HTTP `409` with code `REVISION_CONFLICT` and the current Month View. The client replaces its local state and tells the User that newer data was loaded; it never silently retries a financial write.

Month creation before a row exists uses one transaction-level advisory lock derived from User UUID plus calendar month, then `INSERT ... ON CONFLICT` and row locking. Acquire advisory and row locks consistently to avoid deadlocks.

### Atomic operations

| Operation | Required behavior |
|---|---|
| First onboarding | Active User with no month; create supplied opening for Bangkok today with explicit Starting Balance and Income |
| Resume after gap | Require `resume_required_at`; create supplied opening for today, copy setup from most recent prior Reporting Month, and clear the flag atomically |
| Confirm/correct Income | Write explicit amount including zero; available in Open or Closed Month |
| Confirm/correct Ending Balance | Write explicit amount; never promote a Snapshot; return next dependent month as affected |
| Record Snapshot | Open Month only and date inside tracked interval |
| Add setup item | Append at next position in target month's independent setup |
| Edit setup item | Reject name/kind/fixed-amount edit while a confirmation exists |
| Pause/unpause setup item | Toggle only current month's flag; a prior confirmation remains intact |
| Reorder setup | Require exactly every setup item ID once; rewrite dense positions atomically |
| Confirm Fixed detail | Require an unpaused item, accept no browser amount, and snapshot the locked setup fixed amount |
| Confirm/correct Variable detail | Require an unpaused item and aggregate amount; replacement is atomic cancel plus insert |
| Cancel detail | Delete only the confirmation after User confirmation |
| Manual Close | Final Bangkok date only; require complete coherent summary; close without creating a future month |
| Correct Closed Month | Use the same input/setup/detail operations; never reopen and never accept Snapshot |
| Automatic catch-up | Close due months unconditionally and create only allowed active-user months |

## 10. Calendar lifecycle

Use PostgreSQL time as authority and derive `business_date = (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date`. Browser date and device timezone never authorize closure.

### Manual Close

- Allowed only when business date equals the Reporting Month's final date.
- Requires known Starting Balance, explicit Income, and explicit Ending Balance.
- Rejects negative Monthly Spending or detail total above Monthly Spending.
- Details may be incomplete and Unitemized Spending may be positive.
- Writes `closed_by = manual` and actual `closed_at = clock_timestamp()`.
- Does not create the next month while Bangkok remains on the final date.

### Automatic Close and catch-up

Configure `cron.timezone = 'Asia/Bangkok'` and run `catch_up_reporting_months` daily at `00:05`. Invoke the same idempotent operation at application startup and before serving `/api/bootstrap`.

For each locked User:

- Close every Open Month whose next boundary is on or before business date, regardless of completeness or coherence.
- For an active User without pending resumption inputs, create/copy/close each missing calendar month until the current calendar month exists Open.
- For an active User with `resume_required_at`, create no month until the User completes `/resume`.
- For an Archived User, close only the last due Open Month and create no later rows.
- Copy all setup rows exactly once inside the month-creation transaction.
- Leave Income and Ending Balance absent in each new automatic month.

pg_cron timing is a trigger, not the correctness source. Unique month keys, locks, predicates, and catch-up make retries safe after outages.

## 11. HTTP API contract

All endpoints are same-origin JSON under `/api` and require valid Cloudflare identity except liveness. Dates use ISO `YYYY-MM-DD`, months use `YYYY-MM`, UUIDs use canonical strings, and money uses non-negative decimal strings with at most two digits after the decimal point.

### Response envelope

Success:

```json
{
  "data": {}
}
```

Failure:

```json
{
  "error": {
    "code": "REVISION_CONFLICT",
    "message": "ข้อมูลเดือนนี้เปลี่ยนจากอีกหน้าจอแล้ว",
    "field": null,
    "current": {}
  }
}
```

Errors use:

| HTTP | Code |
|---:|---|
| 400 | `INVALID_INPUT` |
| 401 | `ACCESS_TOKEN_MISSING`, `ACCESS_TOKEN_INVALID` |
| 403 | `USER_NOT_INVITED`, `USER_ARCHIVED` |
| 404 | `MONTH_NOT_FOUND`, `SETUP_ITEM_NOT_FOUND` |
| 409 | `REVISION_CONFLICT`, `IDENTITY_CONFLICT` |
| 422 | `MONTH_NOT_OPEN`, `MANUAL_CLOSE_NOT_ALLOWED`, `SUMMARY_INCOMPLETE`, `SUMMARY_INCONSISTENT`, `DETAIL_ALREADY_CONFIRMED`, `SETUP_ITEM_CONFIRMED` |
| 428 | `REVISION_REQUIRED` |
| 500 | `INTERNAL_ERROR` |
| 503 | `SERVICE_UNAVAILABLE` |

Every month mutation carries `expectedRevision`. A successful mutation returns the complete refreshed Month View and new revision.

### Read endpoints

| Method and route | Result |
|---|---|
| `GET /api/bootstrap` | User lifecycle: `onboarding_required`, `resume_required`, `ready`, or `closed_until_boundary`; current Month View when present |
| `GET /api/months/current` | Current Month View or lifecycle redirect state |
| `GET /api/months?before=YYYY-MM&limit=24` | Descending Month/Tracking-Gap history, maximum 24 |
| `GET /api/months/{month}` | Complete Month View used by Cover Flow card and correction dialogs |
| `GET /api/health/live` | Process liveness only; no User data |
| `GET /api/health/ready` | Private readiness for database and migration state |

### Mutation endpoints

| Method and route | Payload |
|---|---|
| `POST /api/onboarding` | `{ openingBalance, income }` |
| `POST /api/resume` | `{ openingBalance, income }` |
| `PUT /api/months/{month}/income` | `{ amount, expectedRevision }` |
| `PUT /api/months/{month}/ending-balance` | `{ amount, expectedRevision }` |
| `POST /api/months/{month}/snapshots` | `{ observedOn, amount, expectedRevision }` |
| `POST /api/months/{month}/recurring-expenses` | `{ name, kind, fixedAmount?, expectedRevision }` |
| `PATCH /api/months/{month}/recurring-expenses/{id}` | `{ name?, kind?, fixedAmount?, isPaused?, expectedRevision }` |
| `PUT /api/months/{month}/recurring-expenses/order` | `{ orderedIds, expectedRevision }` |
| `PUT /api/months/{month}/details/{setupItemId}` | `{ amount?, expectedRevision }` |
| `DELETE /api/months/{month}/details/{setupItemId}?expectedRevision=N` | no body |
| `POST /api/months/{month}/close` | `{ expectedRevision }` |

Mutation Route Handlers must validate JSON with closed Zod schemas, reject unknown fields, verify `Origin === APP_ORIGIN` for browser writes, and execute only through service operations. Route Handlers contain no SQL.

### Month View

The response must include:

- month key, lifecycle, close method, tracked-from date, Partial flag, revision;
- Starting Balance, Income, Ending Balance, Latest Snapshot, provisional reference;
- Monthly Spending or provisional spending, detail total, Unitemized Spending, reconciliation state, and issue codes;
- every setup item in position order including paused and confirmation state;
- every confirmed detail snapshot;
- allowed actions derived by the server; and
- affected dependent month keys after a correction.

Allowed actions are server authority. The client may hide or disable controls but the server always rechecks.

## 12. UI and route specification

The production UI keeps Variant C's information hierarchy and interactions from the grayscale prototype. The Private Beta ships with the **Neutral Ledger** color system below: white, black, and gray establish the interface, while immutable `#B5C69C` is the only chromatic accent. The prototype remains layout evidence rather than a production color source. All controls require keyboard focus, accessible labels, dialog focus management, and touch targets of at least 44 CSS pixels.

### Theme behavior

- Support `system`, `light`, and `dark`; first use defaults to `system`.
- The App Shell exposes one accessible theme menu with radio options “ตามระบบ”, “สว่าง”, and “มืด”, reachable by keyboard and labelled independently of its sun/moon icon.
- With no override, `<html>` has no `data-theme` attribute and CSS follows `prefers-color-scheme`; system changes apply live.
- Selecting Light or Dark immediately sets `data-theme="light|dark"` and writes non-sensitive cookie `deledger_theme=light|dark; Path=/; Max-Age=31536000; SameSite=Strict`.
- Selecting System deletes that cookie with `Max-Age=0` and removes `data-theme`.
- The root Server Layout reads the cookie and renders the matching `data-theme` before paint, avoiding a theme flash and hydration mismatch. No inline bootstrap script is required.
- The private HTTP/WARP MVP cannot use a `Secure` cookie flag; the theme cookie carries no identity or financial data. Add `Secure` when a future HTTPS public domain replaces this edge.
- Theme preference remains device/browser-local; it is not stored in PostgreSQL and is never included in export.

### Light color system

| Token | Value | Use |
|---|---|---|
| `canvas` | `#F5F5F4` | App background |
| `surface` | `#FFFFFF` | Cards and dialogs |
| `surface-muted` | `#E7E7E5` | Secondary regions, skeletons and neutral status surfaces |
| `ink` | `#171717` | Primary text and high-contrast destructive confirmation |
| `muted-ink` | `#626262` | Secondary text |
| `border` | `#B8B8B3` | Neutral borders and dividers |
| `primary` | `#B5C69C` | Primary actions, selected chips and current navigation; always render at this exact opaque value |
| `primary-ink` | `#262626` | All text and icons placed on a `primary` background |
| `state-strong` | `#262626` | High-emphasis neutral state marks and warning borders |
| `state-muted` | `#6B6B6B` | Low-emphasis neutral state marks |
| `focus` | `#171717` | Keyboard focus ring |

`#B5C69C` is the only chromatic token and communicates action, selection, current navigation, and confirmed reconciliation—not alarm severity. It is an immutable brand value: never derive a tint, shade, soft variant, transparent variant, gradient stop, blend, filter, or `color-mix()` from it. Hover, pressed, focus, and selected states retain the exact opaque fill and instead change a neutral border, outline, shadow, or geometry. Disabled controls replace the primary background with neutral tokens; they do not fade it. Whenever `primary` is a background, all foreground text and icons use `primary-ink` (`#262626`), in both themes. This pair has an 8.30:1 contrast ratio. Monthly-summary emphasis uses neutral `surface-muted` unless the entire surface intentionally uses the exact `primary`/`primary-ink` pair. Statuses remain distinguishable without hue:

| Status | Required presentation |
|---|---|
| Open | Hollow-circle marker and dashed neutral border |
| Reconciled | Check marker plus a `primary` accent bar or check |
| Needs Information | `!` marker and striped `surface-muted` treatment |
| Inconsistent | Warning marker and double/high-contrast `state-strong` border |
| Tracking Gap | Pause marker and dotted/muted neutral border |

Every status keeps its visible text label. Destructive confirmation uses high-contrast black/gray styling and explicit wording rather than red. Do not introduce ad hoc blue, green, amber, red, or any second accent.

### Dark color system

| Token | Value | Use |
|---|---|---|
| `canvas` | `#0E0E0E` | App background |
| `surface` | `#181818` | Cards and dialogs |
| `surface-muted` | `#262626` | Secondary regions, skeletons and neutral status surfaces |
| `ink` | `#F5F5F5` | Primary text and high-contrast destructive confirmation |
| `muted-ink` | `#B8B8B8` | Secondary text |
| `border` | `#474747` | Neutral borders and dividers |
| `primary` | `#B5C69C` | Primary actions, selected chips and current navigation; always render at this exact opaque value |
| `primary-ink` | `#262626` | All text and icons placed on a `primary` background |
| `state-strong` | `#F5F5F5` | High-emphasis neutral state marks and warning borders |
| `state-muted` | `#A3A3A3` | Low-emphasis neutral state marks |
| `focus` | `#B5C69C` | Keyboard focus ring |

Dark mode preserves the same status mapping, labels, symbols, patterns, information hierarchy, and component dimensions as Light mode. It is a token swap—not a second layout, and the `primary`/`primary-ink` pair does not swap. Native controls declare the active `color-scheme`; shadows become subtle borders where contrast is clearer. All listed foreground/background pairs pass WCAG AA for normal text; `#262626` on `#B5C69C` is 8.30:1 and `#B5C69C` on `#0E0E0E` is 10.59:1.

### `/start`

- Visible only for an active invited User with no Reporting Month.
- Explains that the first month begins today and no earlier reconstruction is required.
- Requires Starting Balance and Income received since today; zero Income is valid.
- On success routes to `/month`.

### `/resume`

- Visible only after restoration when no current Reporting Month exists.
- Shows the Tracking Gap dates and states that no missing months will be created.
- Requires fresh Starting Balance and Income since restoration.
- On success creates the continuity segment, copies the last setup, and routes to `/month`.

### `/month`

- Header identifies Reporting Month, Open/Closed state, Draft/Reconciliation state, and Partial Month when applicable.
- Primary summary shows provisional spending while Ending Balance is absent and Monthly Spending after Ending Balance confirmation.
- Timeline actions expose Income, Snapshot, recurring detail chips, Ending Balance, and final-day close.
- Render every unpaused chip in setup order even after confirmation; confirmed chips remain visible and selected.
- Fixed unconfirmed chip confirms immediately using the configured amount.
- Variable unconfirmed chip opens a dialog requiring actual aggregate amount.
- Confirmed Fixed chip opens a cancellation confirmation dialog.
- Confirmed Variable chip opens a dialog defaulted to “แก้ยอด” with a separate cancellation action.
- “เพิ่มรายการรายจ่ายประจำ” sits beside the monthly-detail heading.
- Monthly setup manager lists every active and paused item with balanced spacing, drag handle ordering, pencil edit icon, and pause/play icon.
- Add/edit setup dialog uses Fixed/Variable radio controls and has no “start using from month” field.
- Paused items are absent from selectable chips but remain in the manager and copy to the next month.
- A confirmed detail remains in monthly totals if its setup item is subsequently paused.
- Before the final date the close action is unavailable. On the final date it explains missing/inconsistent gates.
- After Manual Close but before the boundary, show the closed current month and “เดือนถัดไปจะเริ่มหลังเที่ยงคืน” rather than creating a future month.

### `/history`

- Top filmstrip shows all Reporting Months and Tracking Gaps for rapid scanning.
- Status markers distinguish Reconciled, Needs Information, Inconsistent, Open, and Tracking Gap without relying on color alone.
- Filmstrip and Cover Flow selection remain synchronized.
- The centered Cover contains every minimal monthly fact; there is no “ดูรายละเอียดเดือน” navigation.
- The centered Cover exposes only correction actions relevant to its state.
- Selecting a Tracking Gap shows a minimal Cover with archive/restoration dates and no invented financial values.
- Closed-month corrections keep the User in History and refresh the selected Cover, filmstrip marker, issue count, and dependent next month in place.

### Loading, empty, and error behavior

- Route loading uses stable neutral `surface-muted` skeletons matching final card dimensions; skeletons do not borrow the primary accent or status patterns.
- A 409 conflict replaces local data with the server Month View and shows “มีข้อมูลใหม่จากอีกหน้าจอ โหลดข้อมูลล่าสุดแล้ว”.
- Field validation stays beside the field; domain-rule failures appear at the action area.
- Read failure keeps the last rendered data visually disabled with a retry action.
- Unknown/Archived identity shows no financial values.
- No Reporting Months routes to `/start`; restored gap state routes to `/resume`.
- The default browser/network failure is acceptable when WARP or the local host is unavailable; the product promises no offline mode.

## 13. Operator interface

No administration web UI is built. Provide authenticated local CLI commands:

```text
pnpm operator:user invite --email <email>
pnpm operator:user archive --email <email>
pnpm operator:user restore --email <email>
pnpm operator:user transfer-email --from <old> --to <new>
pnpm operator:user export --email <email> --out <directory>
```

Commands must normalize email, acquire User locks, be idempotent where safe, print no financial amounts, and require interactive confirmation for archive and identity transfer. Each command prints the corresponding manual Cloudflare dashboard action because Cloudflare policy mutation automation is out of scope.

## 14. Deployment and operations

### Containers and networks

- `web` joins `edge` and `data` networks, runs as a non-root UID, receives only `NET_BIND_SERVICE`, and listens on port 80 under network alias `deledger.internal`.
- `cloudflared` joins `edge` only and receives only the Tunnel token.
- `postgres` joins `data` only, publishes no host port, stores data in a named volume, and enables pg_cron at startup.
- Only `cloudflared` has the Tunnel credential; only `web` and maintenance jobs have database credentials.
- Compose services use health checks, restart `unless-stopped`, read-only root filesystems where practical, and dropped Linux capabilities except the one explicit web bind capability.

### Database roles

- migration owner: owns schema, unavailable to the running web process;
- web runtime: `NOSUPERUSER NOBYPASSRLS`, CRUD only through required tables/functions, no general identity enumeration or hard delete;
- maintenance: executes catch-up and backup-safe reads;
- operator: executes invite/archive/restore/transfer/export functions locally.

### Backups

- Mount a physically separate device or remote filesystem at `/mnt/deledger-backups`; deployment readiness fails if it is absent.
- At 03:15 Bangkok daily, create `pg_dump --format=custom`, encrypt with `age`, calculate SHA-256, and atomically rename into the target.
- Delete encrypted backup files older than 30 days only after a new backup passes verification.
- Once per week restore the newest dump into a temporary isolated PostgreSQL container and verify migrations plus row counts; destroy only the temporary database afterward.
- Never put the age private key on the backup target.

### Observability

- Structured logs contain request ID, internal User UUID, operation name, latency, result code, and month key.
- Logs never contain balances, Income, expense names, amounts, JWTs, email OTPs, database URLs, or Tunnel tokens.
- Keep pg_cron run records for 30 days.
- Readiness fails for unavailable database, unapplied migration, or missing backup target; liveness reports process health only.

## 15. Security requirements

- App origin is loopback/container-private and has no host port publishing.
- PostgreSQL is never reachable through Cloudflare or a host TCP port.
- Validate every Access JWT signature and claims; never trust header presence alone.
- Apply exact-email local mapping in addition to Cloudflare policy.
- RLS and composite ownership keys protect every private row.
- Parameterize all SQL; database functions use fixed `search_path`.
- Mutations require same-origin requests, `Content-Type: application/json`, and strict schemas.
- Set headers: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Permissions-Policy` denying unused device APIs.
- Do not add third-party analytics or error reporting containing financial state.
- Secrets come from Docker secrets/environment injection and never from tracked files.
- The backup and restore path is part of release readiness, not optional documentation.

## 16. Acceptance scenarios

1. **Mid-month first use:** Given signup on 15 August with balance 20,000 and Income 10,000, the month is Partial from 15 August and ignores earlier activity.
2. **Snapshot is provisional:** Given Starting Balance 20,000, Income 30,000, and a 15 August Snapshot of 42,000, provisional spending is 8,000 and the month remains Open Draft.
3. **Ending Balance is explicit:** A 31 August Snapshot does not become Ending Balance; confirming Ending Balance 35,000 produces Monthly Spending 15,000.
4. **Fixed confirmation:** Tapping ค่าเช่า configured at 6,000 confirms exactly 6,000 without an amount input.
5. **Variable confirmation:** Tapping ค่าไฟ opens an amount dialog; confirming 1,200 creates one aggregate detail.
6. **Selected chips remain:** Both confirmed chips remain visible and selected. Fixed opens cancellation confirmation; Variable defaults to edit and offers cancel.
7. **Setup preservation:** Editing a December Fixed amount to 2,500 never rewrites the confirmed January snapshot of 2,000.
8. **Manual close gate:** Manual Close before the final Bangkok date fails. On the final date it fails if Summary Inputs are absent or incoherent.
9. **No future month:** Successful Manual Close on 31 August does not create September until Bangkok reaches 1 September.
10. **Automatic incomplete close:** At the boundary, an incomplete month closes automatically as Needs Information.
11. **Closed correction:** Adding the missing Ending Balance reconciles the Closed Month without reopening it and refreshes its immediate dependent month.
12. **Active outage catch-up:** After two months offline, an active User receives each missing calendar month, automatically closed as appropriate, plus the current Open Month.
13. **Archived gap:** An Archived User gets only the last due close and no gap months.
14. **Same-month restore:** Archive and restore within the same calendar month continues the same Open Month.
15. **Post-gap restore:** Restore after a crossed boundary requires fresh Starting Balance and Income, copies the latest setup, and creates no balance dependency across the gap.
16. **Isolation:** A valid User cannot select, insert, update, or delete another User's rows even with guessed UUID/month keys.
17. **Stale write:** Two devices edit revision 4; the first succeeds with revision 5 and the second receives 409 plus current state.
18. **Revocation lag:** An open archive period blocks access even if a still-valid Cloudflare token is presented.
19. **Backup readiness:** Deployment is not Ready without the off-device mount; a verified encrypted dump and isolated restore complete successfully.
20. **Theme continuity and immutable primary:** With no theme cookie and a dark device preference, Dark tokens apply before first paint. Choosing Light survives reload through `deledger_theme=light`; choosing System removes the cookie and follows a later device-theme change. In System, Light and Dark, every enabled primary background remains exactly opaque `rgb(181, 198, 156)` through default, hover, pressed, focus and selected states, and every text/icon on it remains `rgb(38, 38, 38)`; no derived primary variant exists. No theme action reads or writes financial/User profile data.

## 17. Implementation-plan hand-off

The implementation plan must be sequential because schema, identity boundary, domain operations, HTTP contracts, and UI depend on one another. Use these gates:

1. repository scaffold and pinned dependency lock;
2. PostgreSQL image, migrations, roles, RLS, and derived queries;
3. Cloudflare JWT verification and transaction-local identity;
4. atomic domain services and operator CLI;
5. JSON Route Handlers and error contract;
6. onboarding/resume/current/history UI against real services;
7. Docker/Cloudflare/private-network deployment;
8. backup, restore verification, build, typecheck, lint, and production image checks.

The plan may split independent UI components only after the API and Month View contracts are fixed. It must not introduce a second Financial Boundary, global expense master, transaction ledger, hard delete, public domain, or unresolved placeholder.

## 18. Readiness

This specification contains no open business or architecture decision. Domain registration remains independent and may be added later by replacing the private access edge without changing the financial model, database ownership, or month operations.
