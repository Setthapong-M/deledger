# Flexible tracking and local calendar simulation

Status: implemented and verified locally — see [validation](validation.md)
Date: 2026-09-09
Source branch: dev-uxui
Source baseline: 0b8bd69 plus the existing uncommitted UX changes
Execution: sequential vertical slices; complete each ticket's behavior, tests and review before the next. Do not stage unrelated UX changes or commit/push without a separate request.

## Problem Statement

ผู้พัฒนาไม่สามารถทดลอง Manual Close และการข้ามเดือนผ่าน UI โดยไม่รอวันจริงได้ แม้ automated tests มี clock seam อยู่แล้ว ผู้ใช้ใหม่เลือกวันเริ่มย้อนหลังไม่ได้ และผู้ใช้ที่ไม่ได้เข้ามาหลายเดือนถูกบังคับให้เติมยอดเก่าเพื่อคำนวณเดือนปัจจุบัน ทั้งสามปัญหาไม่ใช่เหตุผลที่จะลดเงื่อนไขความถูกต้องของการปิดเดือน

## Solution

แยกเป็นสามความสามารถ: ตัวจำลองวันที่ทางบัญชีเฉพาะ local, การเริ่ม/เพิ่มประวัติย้อนหลัง และการเริ่ม Tracking Segment ใหม่ด้วยยอดตั้งต้นที่ระบุเอง ยังคง Manual Close เฉพาะวันสุดท้ายเมื่อข้อมูลครบและสอดคล้อง ส่วน Automatic Close ยังทำงานเมื่อข้ามเดือนแม้ข้อมูลไม่ครบ

MVP ใช้ข้อมูลในฐานข้อมูล local เดิม ไม่มี sandbox, สำเนาฐานข้อมูล, rollback ตามเวลา หรือปุ่ม override ปิดเดือน การเปลี่ยนวันมีคำเตือนชัดเจนและมีผลกับทุกบัญชีใน local instance เดียวกัน ไม่ใช่เฉพาะบัญชีที่กด

## User Stories

1. As a local developer, I want to see the effective accounting date, so that I know which calendar gates I am testing.
2. As a local developer, I want to select the final day of a month, so that I can exercise the real Manual Close flow.
3. As a local developer, I want to advance into the next month, so that I can exercise Automatic Close and catch-up.
4. As a local developer, I want to return to the real date, so that later work does not accidentally use a simulated date.
5. As a local developer, I want a warning about irreversible financial writes and instance-wide scope, so that I do not mistake simulation for a sandbox.
6. As a local developer, I want my session to keep its real lifetime, so that testing a future month does not log me out.
7. As a local developer, I want stale clock controls to be rejected, so that two tabs cannot silently overwrite each other's clock choice.
8. As a QAS user, I want simulation to be unavailable even through direct API calls, so that testing controls cannot alter my accounting calendar.
9. As a new User, I want to choose my tracking start date, so that I can start in a past month.
10. As a new User, I want a clearly labelled Starting Balance and Income since that date, so that I do not include earlier money twice.
11. As a new User, I want intervening months to be represented without invented amounts, so that missing information stays visible.
12. As an existing User, I want to prepend older months, so that I can add history without deleting my current records.
13. As an existing User, I want an existing supplied Starting Balance to remain unchanged, so that adding history does not silently rewrite later totals.
14. As a User, I want to correct historical Income and Ending Balance in History, so that backfilled months can be completed without reopening them.
15. As a User, I want to see which subsequent balance changes after a correction, so that I understand continuity within a segment.
16. As a returning User, I want to start tracking the current month independently, so that missing earlier months do not block me.
17. As a returning User, I want to choose the first of the current month or a later day, so that my new Starting Balance has a clear reference date.
18. As a returning User, I want existing expense setup copied by the system to remain available, so that restarting does not require rebuilding it.
19. As a User, I want the system to refuse a restart over an edited month, so that financial facts and setup edits are not overwritten.
20. As a User, I want old-month corrections to stop at a supplied segment boundary, so that a deliberate fresh start remains stable.
21. As an archived or session-expired User, I want no financial mutation to succeed, so that existing isolation remains intact.
22. As a Thai/English mobile User, I want localized dates, explicit period labels and accessible calendar controls, so that all three flows remain understandable and operable.

## Implementation Decisions

### D1 — Invariants and scope

- The backend remains authoritative for dates, capabilities, accounting and identity. Presentation reads server date context; a device clock, query string, request header or browser cookie cannot override it.
- Calendar boundaries are Asia/Bangkok; date transport is Gregorian ISO date strings. Thai presentation may use Buddhist years. Money and revisions stay exact strings.
- No date or clock operation deletes financial records, reopens a Closed Month, marks unknown inputs as zero, or bypasses reconciliation.
- A Tracking Segment starts with a supplied Starting Balance. Later months depend only on the immediately preceding Ending Balance until another supplied start. No new segment table or cached financial totals are needed.
- A Tracking Restart is not archival or a Tracking Gap. Never create or edit archive periods or clear an operator-controlled resume marker as a shortcut.
- Existing production startup rejection stays intact. This feature does not add production deployment support.
- The design defaults below complete the user's delegated MVP decisions. They are specifications, not claims of current runtime behavior.

### D2 — Local calendar control

1. One in-memory calendar override per local API process, shared by all its authenticated Users and scheduler ticks. Local runs one API instance. No persistence, new DB table, per-User clock or sandbox manager.
2. Normal mode follows today's Bangkok date. Simulated mode holds the selected date fixed until changed/reset; it does not advance at midnight. API process restart returns to real mode, and the UI must show that fact on its next context fetch.
3. The override affects accounting date selection, catch-up, Manual Close, onboarding, historical-start limits and restart eligibility. Keep session expiry, JWT checks, operational readiness, audit timestamps, and birthday future-date validation on real time. Preserve the existing automated-test clock seam; do not broadly replace every call to the existing timestamp function with the simulation date.
4. Use a single local-only asynchronous gate shared by authenticated financial transactions, scheduler ticks and clock changes. Acquire it before owner/DB locks, release in a finally block, and never reacquire it recursively. The date is fixed for the entire financial operation including its retries; a pending clock change waits for ongoing work. QAS has no override or local serialization requirement.
5. Clock read/write authentication uses the existing verified local session, origin/JSON protections and shared error envelope, but must skip financial catch-up. Otherwise merely opening the date control could create/close months at the old date before the developer changes it. Expose that bypass only as an internal route option, never caller input.
6. Authenticate and validate a clock change before updating in-memory state; do not change process state inside a retryable DB transaction. The shared gate keeps it separate from financial transactions. Do not perform global financial catch-up inside the clock PATCH: after success the UI reloads current/history data, and the scheduler handles other Users. Each owner's catch-up remains atomic and repeatable.
7. The local UI is available after login, including before onboarding. Always display the effective date, mode and instance-wide scope. A change/reset requires a confirmation acknowledging that changing the clock back will not undo writes. Do not call the state a preview or temporary data.
8. The initial controllable date range is 24 calendar months before through 24 calendar months after the real Bangkok date, clamping an unavailable day to the target month's last day. This bounds accidental jumps, not stored financial history. Normal-mode reset is always available.
9. Generate a clock revision token from a process-unique boot identifier and monotonic sequence. Changes require the last observed token; stale tabs or tokens from a prior process get a conflict and must reload. Under the shared gate, also advance the revision when real-mode Bangkok date changes, before token validation or catch-up, so a form left open across midnight is stale. Successful same-date/mode changes may be no-ops, with the current token returned; they must not cause duplicate financial writes.
10. After changes/reset, discard obsolete date-context/current/history requests before applying responses. Re-fetch on window focus and poll the small calendar context every 30 seconds while authenticated, so other local tabs learn about changes. Preserve unsaved values but mark date-dependent forms for review and refresh capabilities before submitting.

### D3 — Moving the clock backwards

- Reset is a clock operation, not a financial rollback. Existing closures, future-created months, snapshots and confirmations remain stored and accessible in History.
- Bootstrap/current lookup uses the effective calendar month, not the newest Open Month anywhere in the database. It must not return October as current when the date is reset to September.
- If the effective month already exists and is closed, return the existing closed-until-boundary state. Do not reopen it.
- If the effective date is before an existing current-month tracked-from date, or before the earliest tracked month, local bootstrap returns a simulation-outside-tracking state with no current view. Offer adjust-date/reset controls, not onboarding over existing data.
- If the effective month lies inside a retained archival gap, return simulation-outside-tracking with no current view, even if the User currently has a resume-required marker; preserve that marker and all archive facts. Likewise, an effective date before the applicable restoration date cannot resume tracking. Validate restoration dates in Bangkok at the resume service, not only in bootstrap; normal resume is available only on/after that date and outside a retained gap. No special developer write path bypasses those protections.
- If resetting within an existing month leaves observations dated after the effective day, keep the facts and show the global no-rollback warning. MVP is not an as-of-time report.

### D4 — Start a new User in a past month

1. Add a start-date field to onboarding, defaulting to the backend business date. Required UI inputs: start date, aggregate balance at that date, and Income received since that date through the end of the selected month (or to the effective day for the current month). Zero Income is explicit, not a default for missing months.
2. Accept an actual date no later than the effective date. Limit a single onboarding request to 24 Reporting Months including the current month. Reject larger ranges before writes, with an actionable range error; do not silently truncate.
3. Under the existing owner transaction/lock, require no existing Reporting Month and no resume-required marker. Create the first month's supplied opening at the selected tracked-from date.
4. Create all following missing calendar months through the effective current month with prior-ending openings. Their Income and Ending Balance are null; the selected start month's Income belongs only to that month, never spread across the range.
5. Months strictly before the effective current month are automatically Closed, even when incomplete. Current month is Open. Reuse catch-up rules, including paused setup snapshot copying; do not fabricate Balance Snapshots or paid details.
6. Return the effective current Month View using the existing onboarding response envelope. After historical onboarding, navigate to the selected start month in History so its missing Ending Balance can be supplied; today's onboarding continues to the current month.
7. Old callers omitting start date keep today's behavior. Do not expand the existing operator restoration endpoint to accept arbitrary historical dates; restart is separate.

### D5 — Add history before an existing first month

1. Put “เพิ่มเดือนย้อนหลัง” / “Add earlier months” in History. No existing months means link to onboarding instead. Fetch authoritative history boundaries, not the oldest row in a paginated page.
2. MVP only prepends before the earliest existing month; it does not fill internal archival gaps, move a start date inside an existing month, merge segments or overwrite a month. Reject active archive/resume-required states.
3. The selected start date must be in a month before the existing earliest month and not after the effective day. Create the contiguous range from that month through the month immediately before the existing earliest one, at most 24 new months per request. The entire created range must strictly precede the effective current month; if simulation has moved before existing history and the range would include current/future months, reject HISTORY_BOUNDARY_CONFLICT before writes and direct the developer to adjust/reset the date. Larger valid additions can be split into explicit batches; preview the exact range and count before saving.
4. The earliest existing month must have a supplied opening. If it instead depends on an absent previous month, reject with a boundary conflict rather than silently changing its effective balance. No endpoint repairs inconsistent legacy data automatically.
5. Create a supplied opening and explicit Income for the first new month; subsequent new months use prior-ending openings with null Income/Ending Balance. All new months are Closed because they precede existing history/effective current month. Do not copy present-day expense setup backwards into the past; prepend starts with an empty setup.
6. Leave every existing row, supplied balance, revision, setup, confirmation and archive fact unchanged. Newly added history does not alter the current month's supplied boundary, even when its Ending Balance differs.
7. Validate the submitted earliest-month key and revision under the owner lock. Concurrent prepends or edits make the stale request fail atomically. Retrying after an uncertain response cannot create duplicates or silently overwrite an existing range.
8. On success reload History and select the requested start month by fetching it directly if outside the current page. Preserve correct chronological ordering and existing pagination.

### D6 — History corrections required by backfill

- History must expose Income and Ending Balance edit actions when the backend permits them; current History mostly presents summaries and refresh, so this is required work rather than assumed existing UI.
- Corrections remain allowed on Closed Months without reopening. Income and Ending Balance use the existing revision-checked endpoints and return localized conflicts with the current server view.
- If a month has a supplied opening, label it “ยอดตั้งต้นที่ระบุเอง” / “Supplied starting balance”; do not imply it inherits the prior Ending Balance. Keep the original first-use Starting Balance read-only in this scope; correction of that source value is a separate existing limitation, not an implicit new endpoint.
- Derive dependent balances as today. Refresh the corrected month and immediately next month only if its opening source is prior-ending. Stop the affected-month list at a supplied boundary; adding history does not produce a false warning that the supplied balance will change.
- Past-month input in this feature is summary-only: do not backdate provisional snapshots, create historical recurring setup, or bypass Closed Month confirmation rules.

### D7 — Restart the current month without completing prior months

1. Offer “เริ่มติดตามใหม่” / “Start fresh” when the effective current month is Open with an unknown inherited Starting Balance and is otherwise eligible. Also offer the existing History correction route as the alternative; do not force a restart.
2. Eligibility is computed and enforced by the backend after catch-up: active User, no resume marker, current month matches the effective calendar month, opening source prior-ending, null supplied opening, null Income, null Ending Balance, no Balance Snapshots, no Monthly Expense Details, and month revision exactly zero. The preceding Ending Balance is missing.
3. Revision zero distinguishes untouched automatically copied setup from a user-edited setup, including edits later undone. Copied/paused setup alone does not block restart. Any manual setup change, confirmation/cancel, recorded amount (including zero), snapshot, supplied opening or close does block it. Fail closed if these checks disagree.
4. The start date must be within the effective current month and no later than the effective day. User supplies the balance at that date and Income since that date. Do not move it into a previous/future month or create multiple segments in one month.
5. Under the same owner lock and expected revision, convert only the current Reporting Month to supplied opening, set tracked-from and Income, and increment revision once. Preserve copied setup exactly; prior months and archive periods remain untouched. Return the updated current Month View.
6. Corrections to earlier months cannot change the new supplied Starting Balance. Later new months inherit this month's Ending Balance normally.
7. Confirm before saving: “เริ่มนับจากวันที่เลือก ยอดก่อนหน้านี้ยังอยู่ แต่จะไม่เชื่อมกับยอดตั้งต้นใหม่” / “Start from this date. Earlier records stay, but will not set your new starting balance.” Do not use “ล้าง”, “รีเซ็ตข้อมูล” or “ปิดยอด” for this action.

### D8 — Interfaces and concurrency contract

All paths below are HTTP endpoints, not source locations. Reuse existing success/error envelopes, exact decimal strings, owner binding, no-store behavior, transaction retries and RLS. Register literal routes ahead of parameterized month routes.

| Endpoint | Request / response decision |
| --- | --- |
| GET /api/calendar | Authenticated, no catch-up. Returns businessDate, realDate, mode (real/simulated), canSimulate, clockRevision (local token; null otherwise). Non-local requests expose no control capability. |
| PATCH /api/local/clock | Local only, authenticated and origin checked; strict body date (ISO or null for reset), expectedClockRevision and acknowledged=true. Returns the new calendar context. Non-local returns 404 before auth/DB mutation; prod still fails startup. |
| POST /api/onboarding | Extend only onboarding schema with optional startDate; openingBalance/income remain required. Omission defaults to server date. Return effective current Month View after atomic range creation. |
| GET /api/tracking/options | Authenticated read after catch-up; returns effective date, earliestMonth/earliestRevision, prepend eligibility/reason, restart eligibility/reason and permitted start-date ranges. For an eligible restart include target month and expected revision. All values recomputed server-side on submission. |
| POST /api/months/backfill | Strict startDate, openingBalance, income, expectedEarliestMonth, expectedEarliestRevision. Returns selected Month View, createdMonthKeys and affectedMonthKeys limited to newly created months. |
| POST /api/months/:month/restart | Strict startDate, openingBalance, income, expectedRevision. Returns updated Month View. Month in URL must be the effective current month. |
| Existing Income/Ending Balance endpoints | Keep request/response shapes; make these actions available in History and stop affected-month reporting at supplied boundaries. |
| Existing bootstrap/current | Add businessDate metadata and the local simulation-outside-tracking state; do not use the latest future month as current after a clock reset. Existing states remain valid. |

- Shared Month View adds openingSource (supplied/prior_ending) for explanatory copy; expose restart capability through tracking options rather than duplicating a second independent rule in the browser.
- New error codes: CLOCK_CONFLICT (409), DATE_RANGE_TOO_LARGE (400), HISTORY_BOUNDARY_CONFLICT (409), HISTORY_RANGE_OVERLAP (409), RESTART_NOT_ALLOWED (409); invalid date/body stays INVALID_INPUT (400). Conflict responses include the existing current Month View when available; CLOCK_CONFLICT has no Month View and causes a calendar-context reload. Existing session/archive/revision failures remain unchanged.
- User isolation is never an optional payload parameter. A date selector, fake locale or forged capability flag cannot grant a mutation.
- Local date-dependent forms carry the clock token they rendered against through the same-origin API client's x-deledger-clock-revision header. Finance requests with a stale explicit token fail CLOCK_CONFLICT before catch-up/writes; absence remains valid for legacy callers and uses the server's current date. Never use caller-supplied dates as a replacement for the server calendar. Non-local cannot use this token to enable simulation.
- New writes are all-or-nothing under owner locking. Do not add compensating deletes, partial batches or a new generic transaction abstraction. The 24-month cap bounds each range operation; batch-read existence/setup facts and avoid unnecessary per-month API round trips.
- No persistence migration is expected: existing supplied/prior-ending fields, tracked-from, revision and financial relations encode the behavior. Preserve applied migration checksums, grants and constraints. If implementation proves a new persistence fact indispensable, record the reason before widening scope.

### D9 — UX and compatibility

- Reuse existing DateInput, MoneyField, Dialog, Icon and locale provider. Extend the date picker with server-provided min/max and date-relative Today support; do not fork the calendar or use device today for accounting. Birthday keeps real-date semantics.
- Input labels: “วันเริ่มติดตาม”, “เงินคงเหลือ ณ วันเริ่ม”, “รายรับตั้งแต่วันเริ่มถึง …”. State the period endpoint explicitly for historical months. Partial Month summary/timeline/edit-dialog labels must not imply a full month's Income when tracking began mid-month.
- Date changes that change the accounting period require rechecking the entered amounts before submit. Preserve form state on locale changes, validation errors, conflicts and network failures.
- Local clock banner: “โหมดทดสอบ · วันที่ระบบ … · มีผลกับทุกบัญชีใน local นี้”. Confirmation: “การข้ามเดือนอาจปิดเดือนและสร้างเดือนใหม่ การย้อนวันที่หรือรีสตาร์ต API ไม่ย้อนข้อมูล”. Reset button: “กลับวันที่จริง”.
- After clock changes, reload current/history/capability context and close or invalidate financial dialogs whose target month no longer matches. Never submit a stale dialog into a different month automatically.
- New supplied segments get explanatory text on summary and History. No separate segment-management screen, bank-account model or new navigation section.
- Preserve responsive layouts, focus restoration, arrow-key date selection, localized errors and color-independent status meanings. Warn about irreversible actions in text, not solely an icon or color.

## Testing Decisions

Primary acceptance seam is the authenticated HTTP/API boundary against disposable PostgreSQL: this proves dates, transaction behavior, identity and persistence together. Use existing accounting/lifecycle/catch-up HTTP and integration fixtures, supplemented by actual Next→Nest browser journeys. Component tests prove interaction details, not financial correctness on their own. Date arithmetic and deterministic policies use the existing domain test seams.

| Scenario | Required observable result |
| --- | --- |
| Local Sep 29 → Sep 30, complete coherent inputs | Manual Close unavailable before final day, available on final day, explicit confirmation still required. |
| Sep 30 → Oct 1 with incomplete September | September automatically closed with Needs Information; October Open with unknown inherited starting value; no invented amounts. |
| Two concurrent clock changes / API reboot | Only current revision accepted; stale tab reloads; reboot resets clock but not financial facts. |
| Real-mode form left open across Bangkok midnight | Date/token revision advances under gate before validation; old explicit token fails without financial catch-up or writes. |
| Clock change overlaps write, retry or scheduler | Each operation sees one date; no duplicate months/half-created ranges; no deadlock. |
| Two local Users | Banner and effective date shared; financial read/write isolation unchanged; scheduler may advance each owner independently. |
| QAS direct clock request, forged header/body | No override or financial catch-up triggered by the rejected control request. Production remains startup-rejected. |
| Move date far forward | Session TTL, JWT validation, profile DOB rules and scheduler health do not use simulated time. |
| Advance to October then reset to September | Current route does not choose future October, closed September stays closed, records remain in History. |
| Simulate before tracked-from/first month | Explicit local outside-tracking state, no duplicate onboarding, reset remains available. |
| Simulate into an old archival gap or before restoration | Outside-tracking state, no gap-month creation; direct resume rejected and marker preserved until its restoration-date condition is satisfied. |
| New User starts Aug 15 while effective date is Oct 9 | August Partial/Closed with supplied values; September Closed with unknown inputs; October Open. Historical Income belongs only to August. |
| Existing Sep supplied=1000; prepend Aug ending=9000 | September stays supplied=1000, all old rows/revisions unchanged; affected-month reporting stops at September. |
| Earliest stored month Nov, effective date Sep, prepend Aug | Reject entire Aug–Oct range without writes; do not close the effective current September or future October. |
| Historical Income/Ending correction inside segment | Exact totals and immediate dependent starting value refresh without reopening; no changes across supplied boundary. |
| Missing prior ending; untouched Oct revision=0 with copied setup | Restart Oct 1 or Oct 9 succeeds atomically, keeps setup, creates supplied boundary. |
| Oct has explicit income=0, snapshot, confirmation/cancel or setup edit | Restart rejected; no partial change even if UI is stale or disabled controls are bypassed. |
| Later correction to September after restart | October supplied balance unchanged; normal October→November dependency still works. |
| Leap day, year boundary, invalid/future date, 24/25-month range | Actual dates and server limits enforced, no rollover coercion or silent truncation. |
| Double submit, overlapping prepends, network retry, failed write mid-range | Owner lock/revisions/unique constraints prevent duplicates; complete rollback on failure. |
| Archived/resume-required, missing/expired session, foreign owner | Existing security and gap rules preserved. |
| Thai/English, small mobile, keyboard | Fields retain input, localized years do not alter ISO values, dates use backend context, icons have accessible owning names. |

Implementation gates: compiler/typecheck and production build; targeted unit, PostgreSQL integration, HTTP and browser tests per ticket. TS/TSX lint is currently excluded, so a green lint command is not TypeScript review. Only run DB-resetting wrappers against the verified disposable test database; ordinary implementation authorization does not authorize resetting local data. No runtime tests are executed merely to publish this specification.

## Out of Scope

- Early Manual Close, skipping coherence checks, editing the machine clock or simulating QAS/production.
- Per-User timelines, multiple local API processes sharing a simulated clock, durable clock state, fixture-management UI, automated DB cloning/deletion or rollback.
- Historical transaction logging, historical setup editing, backdated Balance Snapshots or relaxed Closed Month expense-detail gates.
- Filling internal archive gaps, restoring archived Users from the UI, merging/relinking supplied boundaries, multiple restarts in one calendar month or overwriting an edited current month.
- Editing an existing supplied Starting Balance through a new correction endpoint, or changing the existing one-private-Financial-Boundary model.
- Commits, pushes, deployments, dependency upgrades, cleanup of pre-existing UX changes, data resets and production enablement.

## Further Notes

- User-approved product direction: retain close gates; local-only simulation using existing local data; new/existing historical starts; preserve supplied later balances; independent restart only over untouched current month.
- Selected technical defaults: process-local shared clock, restart-to-real behavior, serial local date gate, 24-month creation cap, prepend-only history, revision-zero restart eligibility, no new DB table. These make the delegated MVP design bounded and executable.
- Relevant prior decisions: [ADR 0001](../../docs/adr/0001-closed-months-remain-correctable.md), [ADR 0003](../../docs/adr/0003-manual-and-automatic-close-use-different-gates.md), [ADR 0004](../../docs/adr/0004-archival-creates-an-explicit-tracking-gap.md), [ADR 0006](../../docs/adr/0006-derive-monthly-summaries-from-stored-facts.md), [ADR 0008](../../docs/adr/0008-split-presentation-and-business-services.md), [ADR 0009](../../docs/adr/0009-separate-clock-simulation-from-tracking-restarts.md).
- Earlier MVP documents that say onboarding always begins today are superseded only for the optional start-date behavior. Their accounting, closure and archival invariants remain unless explicitly changed above.
- Publication is not implementation. Each ticket must finish its own behavior and verification before being marked complete.
