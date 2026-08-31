# Deledger Online MVP — Implementation Plan

Date: 2026-08-31
Author: Codex
Source repository: `Setthapong-M/deledger`
Source branch: `online-mvp`
Status: implementation complete — Gate 8; host activation pending operator-managed backup/Cloudflare secrets
Predecessors: `Online Deledger MVP — Executable Technical Specification`, `Wayfinder: Online Deledger MVP`, ADR 0001–0006

> 🤖 **Execution method:** ใช้ sequential gated implementation + vertical-slice TDD ใน source repository นี้โดยตรง ทุก behavior ทำ Red → Green ทีละ test ผ่าน public seam และ commit เฉพาะสถานะ Green แต่ละ Gate ต้องผ่าน automated tests, Audit และ Build check ก่อน push checkpoint เพราะ schema → identity → domain operations → HTTP contracts → UI → deployment พึ่งพากันตามลำดับ ห้ามใช้ PARA workspace กับแผนนี้

## Goal

สร้าง Deledger Private Beta เป็น responsive Next.js web application ที่ช่วยให้ User คำนวณ Income และ Monthly Spending จาก Financial Boundary เดียว โดยไม่ต้องจด Transaction Detail ทุกครั้ง ใช้ PostgreSQL แบบ local, เข้าผ่าน Cloudflare Private WARP/Access เท่านั้น และแยกข้อมูลของ User ทุกคนด้วย transaction-local identity กับ forced RLS

ผลลัพธ์เมื่อจบแผนต้องรองรับ onboarding/resume, Balance Snapshot, explicit Ending Balance, Monthly Expense Setup แบบ month-owned, Fixed/Variable confirmation chips, Manual/Automatic Close, Closed Month correction, Tracking Gap, Filmstrip + Cover Flow history, operator lifecycle commands, private deployment และ encrypted off-device backup/restore verification พร้อม automated unit/integration/component/E2E/operations tests และ traceable Git history บน branch `online-mvp`

### ที่มา

Wayfinder และ executable specification เคาะ business/architecture decisions ครบแล้ว แผนนี้จึงมีหน้าที่เปลี่ยน decisions เหล่านั้นเป็นลำดับงานที่ execute ได้ โดยไม่ย้อนกลับไปสร้าง global expense master, Transaction ledger, public hostname, hard delete หรือ Supabase/Vercel path

### Authority order

หากเอกสารขัดกันให้ใช้ลำดับนี้:

1. `CONTEXT.md` และ ADR ที่ accepted ใน `docs/adr/`
2. `.scratch/deledger-online-mvp/spec.md`
3. แผนนี้
4. resolved tickets และ research ใน `.scratch/deledger-online-mvp/`
5. prototype สำหรับ visual evidence เท่านั้น

### Invariants

- User หนึ่งคนมี Financial Boundary เดียว; ห้ามสร้าง bank-account entity หรือคำนวณ Internal Transfer เป็น Income/Expense
- Monthly Spending = Starting Balance + Income − Ending Balance; Monthly Expense Details ใช้อธิบายผลรวมเท่านั้นและห้ามนำไปบวกซ้ำ
- Balance Snapshot เป็น provisional evidence และไม่กลายเป็น Ending Balance โดยอัตโนมัติ
- Monthly Expense Setup เป็น snapshot ที่ Reporting Month เป็นเจ้าของ ไม่มี global expense master
- Monthly Expense Detail snapshot ชื่อ ชนิด และยอดตอน confirm; การแก้ setup ภายหลังห้ามเปลี่ยน confirmed fact เดิม
- Manual Close ทำได้เฉพาะวันสุดท้ายของเดือนตาม `Asia/Bangkok` และต้อง coherent; Automatic Close ปิดตาม boundary โดยไม่บังคับความครบถ้วน
- Closed Month แก้ไขได้แต่ไม่ reopen; correction ต้อง refresh dependent next month เมื่อ opening source คือ `prior_ending`
- Archived User เป็น soft-delete lifecycle; ห้ามสร้าง ordinary hard-delete path
- เงินทุกค่าใช้ `numeric(15,2)` ใน PostgreSQL และ decimal string ใน JSON; ห้ามใช้ JavaScript floating-point คำนวณเงิน
- Browser ส่ง `owner_id`, verified email หรือ reconciliation authority ไม่ได้; allowed actions มาจาก server เท่านั้น
- ทุก private table มี owner key, composite ownership FK และ forced RLS
- PostgreSQL time เป็น calendar authority; device time ใช้ authorize close ไม่ได้
- Production ไม่มี host-published web/database port; access ต้องผ่าน WARP → Access → named Tunnel
- Log ห้ามมี email, JWT, OTP, balance, Income, expense name/amount, database URL หรือ Tunnel token
- ทุก behavior เริ่มจาก failing test ผ่าน public seam, ทำ implementation เท่าที่ทำให้ test ผ่าน และ commit/push เฉพาะเมื่อ targeted + Gate suites เป็น Green
- Tests ใช้ known literal จาก executable specification และ acceptance scenarios; ห้ามคำนวณ expected value ซ้ำด้วย algorithm เดียวกับ production
- ห้าม mock module ภายใน Deledger; ใช้ real PostgreSQL และ mock/fake เฉพาะ time, remote JWKS, browser/network และ temporary filesystem ที่เป็น system boundaries

## Out of scope

- Credit card และ billing cycle (Phase 2)
- Named bank accounts, bank API/import, Internal Transfer entries และ Transaction Details
- Ad-hoc expense detail/category; one-off Expense อยู่ใน Unitemized Spending
- Multi-currency, cash boundary แยก, budget, forecast, spending-speed meter, analytics และ notifications
- Public domain/hostname, clientless access, Vercel, Supabase, native mobile และ offline-first
- Self-registration, password/profile/admin web UI และ permanent User deletion
- Cloudflare policy automation; operator ทำ dashboard action ตามข้อความที่ CLI แสดง
- การแก้หรือย้าย nested Git repository `prototypes/`; root repo จะ ignore directory นี้และใช้ specification เป็น implementation authority
- Git tag, GitHub Release, automatic PR merge, force-push และ deployment จาก GitHub Actions
- Automatic production deployment from GitHub Actions; CI was added per User request and runs disposable verification only (no production secrets or deployment credentials)
- User-observed manual UI test session; automated component/E2E/accessibility tests อยู่ใน scope แล้ว

## Decisions

### คำถามที่เคลียร์กับ User แล้ว

| คำถาม | คำตอบ/การตัดสินใจ |
|---|---|
| ใช้ PARA workspace หรือไม่ | ไม่ใช้ใน repo นี้ แผนและ artifacts อยู่ใต้ `.scratch/deledger-online-mvp/` |
| เริ่มเขียน source code ตอนทำแผนหรือไม่ | ยังไม่เริ่ม; รอบนี้สร้างและ audit implementation plan เท่านั้น |
| Authentication | Cloudflare Access Email OTP สำหรับ exact invited emails ผ่าน Cloudflare One Client |
| Deployment edge | Private WARP route และ hostname `deledger.internal`; ยังไม่ซื้อ/ผูก public domain |
| Database | Local open-source PostgreSQL + pg_cron; ไม่ใช้ Supabase |
| Account removal | Archive/restore แบบ soft-delete lifecycle; ไม่มี ordinary hard delete |
| Expense model | Setup เป็นของแต่ละ Reporting Month และ copy จากเดือนก่อนหนึ่งครั้ง |
| History UI | ใช้โครง Variant C: synchronized top Filmstrip + Cover Flow โดย centered Cover มีรายละเอียด minimal ครบ และใช้สีใน Private Beta |
| Private Beta color/theme | ใช้ Neutral Ledger ทั้ง Light/Dark: ขาว ดำ เทาเป็นฐาน และ exact opaque `#B5C69C` เป็น chromatic accent เดียวโดยห้ามทำให้อ่อน/เข้ม/โปร่ง/ผสมสี; พื้น accent ใช้ text/icon `#262626`; ครั้งแรกตาม system และให้เลือก “ตามระบบ / สว่าง / มืด”; สถานะใช้ข้อความ ไอคอน เส้นขอบ และ pattern ไม่ใช้หลายสีแยกประเภท |
| Automated tests | รวม unit, PostgreSQL integration, auth, service, API contract, component, Playwright E2E, accessibility และ operations/recovery tests |
| Source Git actions | ใช้ branch `online-mvp`, passing Gate commits, push checkpoint ทุก Gate, GitHub Actions CI สำหรับ disposable checks และเปิด Pull Request หลัง Gate 8; ไม่ merge/tag/force-push/deploy อัตโนมัติ |

### Architecture decisions

| ด้าน | ตัดสินใจ | เหตุผล |
|---|---|---|
| Repository shape | Root เป็น pnpm workspace มี `web`, `db`, `infra`, `scripts`; `prototypes/` คงเป็น independent dirty Git worktree และถูก root ignore | ป้องกัน accidental gitlink/submodule และไม่ทำลาย uncommitted prototype |
| Runtime | Next.js 16 App Router full-stack app เดียว | ลด deployment/API surface และตรงกับ executable spec |
| Server seams | `app` parse HTTP, `services` คุม atomic use cases, `repositories` มี SQL, `domain` derive Month View | ทำให้ Route Handler ไม่มี SQL และ browser import server code ไม่ได้ |
| Database migration | `node-pg-migrate` พร้อม numbered immutable CommonJS migrations ใต้ `db/migrations/` | ใช้ pinned tool และทำ schema/role/RLS rollout ตามลำดับตรวจสอบได้ |
| Identity | `jose` verify `Cf-Access-Jwt-Assertion`; verified email resolve ผ่าน narrow security-definer function | ไม่เชื่อ browser identity และไม่ให้ web role enumerate identity table |
| Ownership | Request-scoped leased `pg` client + transaction-local `deledger.user_id` + forced RLS | identity ไม่รั่วข้าม pooled connection และ DB เป็น final isolation boundary |
| Concurrency | `expectedRevision`, User/month locks และ deterministic lock order; stale write คืน 409 + current Month View | ป้องกัน silent overwrite จากหลาย device |
| Money | DB คำนวณ numeric; application validate/transport เป็น canonical decimal string | หลีกเลี่ยง floating-point drift |
| UI state | Server returns complete Month View และ `allowedActions`; client refreshes full view after mutation | ลด duplicated business rules และทำ conflict recovery ตรงไปตรงมา |
| Reordering | Custom Pointer Events drag handle พร้อม keyboard Up/Down fallback; ไม่เพิ่ม drag library | รองรับ touch/keyboard โดยไม่เพิ่ม dependency นอก baseline |
| Operations | Docker Compose networks `edge`/`data`, operator-managed file-backed secrets under `DELEDGER_SECRET_DIR`, systemd timers สำหรับ backup/restore verification | ไม่มี host port, ใช้ได้กับ local Docker ที่ไม่ได้เปิด Swarm และใช้งาน schedule ของเครื่อง local ได้ชัดเจน |
| Plan execution | Sequential Gates 1–8; UI แยก component ได้หลัง API/Month View contract ถูก freeze ที่ Gate 5 | ตัด rework จากการทำหน้าบ้านก่อน authority contracts |
| Test method | Vertical-slice TDD: one public-seam test → minimal implementation → repeat; refactor แยกไว้ใน review หลัง Green | ทำให้ tests ตรวจ observable behavior และไม่สร้าง horizontal imagined suite |
| Test database | Real disposable PostgreSQL 18.6 + pg_cron ผ่าน `infra/compose.test.yaml`; test files run serially when sharing DB | RLS, numeric, locks, constraints และ cron semantics จำลองด้วย mock ไม่ได้อย่างน่าเชื่อถือ |
| External test doubles | Local signed JWKS server, injected clock adapter, Playwright browser context และ temp filesystem เท่านั้น | เป็น system boundaries ที่ deterministic โดยไม่ mock Deledger internals |
| Git history | หนึ่ง passing checkpoint commit ต่อ Gateเป็นอย่างน้อย; tests และ implementation ของ behavior อยู่ใน commit เดียวกัน | ทุก pushed commit buildable และ review เห็น behavior พร้อมหลักฐาน |
| Visual system | Variant C structure + Neutral Ledger tokens; ขาว/ดำ/เทาเป็นฐาน, `#B5C69C` คงค่าทึบเดิมทุก state และใช้ `#262626` บนพื้น accent; สถานะแยกด้วย label, symbol, border และ pattern | รักษาความนิ่งแบบสมุดบัญชี เพิ่มบุคลิกด้วย accent เดียวโดยไม่ทำให้ brand color เพี้ยน และอ่านสถานะได้โดยไม่พึ่ง hue |
| Theme preference | Root layout reads optional `deledger_theme` cookie; no cookie follows `prefers-color-scheme`; theme control applies immediately and persists only `light|dark` locally | ป้องกัน flash/hydration mismatch โดยไม่เพิ่ม DB field, API หรือ inline CSP script |

### Production Light color system

| Token | Hex | Application rule |
|---|---|---|
| `--color-canvas` | `#F5F5F4` | App background |
| `--color-surface` | `#FFFFFF` | Cards and dialogs |
| `--color-surface-muted` | `#E7E7E5` | Secondary surfaces, skeletons and neutral status surfaces |
| `--color-ink` | `#171717` | Primary text and high-contrast destructive confirmation |
| `--color-muted-ink` | `#626262` | Secondary text |
| `--color-border` | `#B8B8B3` | Neutral borders/dividers |
| `--color-primary` | `#B5C69C` | Primary actions, current navigation, confirmed/selected chips; always exact and opaque |
| `--color-primary-ink` | `#262626` | Every text/icon foreground on a primary background |
| `--color-state-strong` | `#262626` | High-emphasis state marks and warning borders |
| `--color-state-muted` | `#6B6B6B` | Low-emphasis state marks |
| `--color-focus` | `#171717` | Keyboard focus ring |

`#B5C69C` is the only chromatic token and is immutable. Never derive a tint, shade, soft/transparent variant, gradient stop, blend, filter, opacity or `color-mix()` from primary. Hover/pressed/focus/selected retain the exact opaque fill and change only neutral border/outline/shadow/geometry; disabled replaces primary with neutral tokens instead of fading it. Every foreground on primary is `#262626` in both themes (8.30:1). Monthly-summary emphasis uses `surface-muted` unless it intentionally uses the exact primary/primary-ink pair. Open uses a hollow circle and dashed border; Reconciled uses a check plus primary accent; Needs Information uses `!` plus neutral stripes; Inconsistent uses a warning marker plus double/high-contrast border; Tracking Gap uses a pause marker plus dotted/muted border. Destructive confirmation is neutral high contrast, not red. Do not add blue, green, amber, red, or another accent without revising the specification and plan.

### Production Dark color system

| Token | Hex | Application rule |
|---|---|---|
| `--color-canvas` | `#0E0E0E` | App background |
| `--color-surface` | `#181818` | Cards and dialogs |
| `--color-surface-muted` | `#262626` | Secondary surfaces, skeletons and neutral status surfaces |
| `--color-ink` | `#F5F5F5` | Primary text and high-contrast destructive confirmation |
| `--color-muted-ink` | `#B8B8B8` | Secondary text |
| `--color-border` | `#474747` | Neutral borders/dividers |
| `--color-primary` | `#B5C69C` | Primary actions/selection; always exact and opaque |
| `--color-primary-ink` | `#262626` | Every text/icon foreground on a primary background |
| `--color-state-strong` | `#F5F5F5` | High-emphasis state marks and warning borders |
| `--color-state-muted` | `#A3A3A3` | Low-emphasis state marks |
| `--color-focus` | `#B5C69C` | Keyboard focus ring |

All Dark foreground/background pairs pass WCAG AA for normal text. The fixed primary pair `#262626` on `#B5C69C` is 8.30:1, and accent on Dark canvas is 10.59:1. Dark mode swaps neutral tokens only; primary and primary-ink remain identical. Component dimensions, hierarchy, state symbols/patterns and behavior remain unchanged. Use `color-scheme: light`/`dark` on `<html>` so native controls follow the resolved theme.

### Theme preference contract

- Preference type is `system | light | dark`; default `system` is represented by no cookie and no `data-theme` attribute.
- `app-shell.tsx` renders `theme-control.tsx` in every lifecycle state, including access/error screens that contain no financial values.
- Root `layout.tsx` reads cookie `deledger_theme`; only exact `light|dark` produces `<html data-theme>` and matching `color-scheme`. Unknown values are ignored as System.
- Theme menu uses radio semantics and Thai labels “ตามระบบ”, “สว่าง”, “มืด”; icon alone is never the accessible name.
- Choosing Light/Dark updates `<html>` before React state settles and writes `Path=/; Max-Age=31536000; SameSite=Strict`; choosing System removes attribute and expires the cookie with `Max-Age=0`.
- Cookie is intentionally not `Secure` on the HTTP/WARP MVP and contains no identity/financial data. A future HTTPS edge must add `Secure`.
- Theme is not sent to PostgreSQL, API payloads, logs or export.

## Pinned toolchain

| Package/component | Exact version |
|---|---:|
| Node.js | 22.23.1 |
| pnpm | 11.1.3 |
| Next.js / eslint-config-next | 16.3.3 |
| React / React DOM | 19.2.8 |
| TypeScript | 7.0.2 |
| PostgreSQL | 18.6 |
| pg_cron | 1.6.7 |
| cloudflared | 2026.7.2 |
| pg | 8.23.0 |
| jose | 6.2.10 |
| zod | 4.5.4 |
| node-pg-migrate | 9.0.0 |
| ESLint | 10.9.1 |
| `@types/node` | 26.4.0 |
| `@types/react` | 19.2.18 |
| `@types/react-dom` | 19.2.5 |
| `@types/pg` | 8.23.1 |
| Vitest / `@vitest/coverage-v8` | 4.1.11 |
| jsdom | 30.0.1 |
| Testing Library React | 16.3.3 |
| Testing Library DOM | 10.4.1 |
| Testing Library User Event | 14.6.6 |
| Testing Library Jest DOM | 7.0.1 |
| Playwright Test | 1.62.1 |
| Axe Playwright | 4.13.0 |

ใช้ `save-exact=true`; `pnpm-lock.yaml` เป็น source of truth สำหรับ transitive dependency ทั้งหมด ห้ามใช้ caret/tilde ranges

## Files to change / create

รายการนี้เป็น intended implementation surface จำนวน 133 baseline paths; Gate 8 เพิ่มเฉพาะ operational scripts/docs/workflow ที่ได้รับอนุมัติภายหลัง. generated `.next/`, `node_modules/`, Playwright artifacts, coverage, dumps, secrets และ local runtime files ต้องไม่ถูก track

### Root and web foundation (20)

| Action | Path |
|---|---|
| NEW | `.gitignore` |
| NEW | `.dockerignore` |
| NEW | `.env.example` |
| NEW | `.env.test.example` |
| NEW | `.npmrc` |
| NEW | `package.json` |
| NEW | `pnpm-workspace.yaml` |
| GENERATED | `pnpm-lock.yaml` |
| EDIT | `README.md` |
| NEW | `web/package.json` |
| NEW | `web/tsconfig.json` |
| GENERATED | `web/next-env.d.ts` |
| NEW | `web/next.config.ts` |
| NEW | `web/eslint.config.mjs` |
| NEW | `web/vitest.config.ts` |
| NEW | `web/playwright.config.ts` |
| NEW | `web/Dockerfile` |
| NEW | `web/src/app/layout.tsx` |
| NEW | `web/src/app/page.tsx` |
| NEW | `web/src/app/globals.css` |

### Database, server core and domain (27)

| Action | Path |
|---|---|
| NEW | `db/Dockerfile` |
| NEW | `db/init/001_roles.sh` |
| NEW | `db/migrations/202608310001_extensions.cjs` |
| NEW | `db/migrations/202608310002_schema.cjs` |
| NEW | `db/migrations/202608310003_rls.cjs` |
| NEW | `db/migrations/202608310004_functions.cjs` |
| NEW | `db/migrations/202608310005_cron.cjs` |
| NEW | `web/src/server/config.ts` |
| NEW | `web/src/server/logging.ts` |
| NEW | `web/src/server/db/pool.ts` |
| NEW | `web/src/server/db/transaction.ts` |
| NEW | `web/src/server/db/rls.ts` |
| NEW | `web/src/server/auth/access-jwt.ts` |
| NEW | `web/src/server/auth/identity.ts` |
| NEW | `web/src/server/domain/contracts.ts` |
| NEW | `web/src/server/domain/money.ts` |
| NEW | `web/src/server/domain/calendar.ts` |
| NEW | `web/src/server/domain/errors.ts` |
| NEW | `web/src/server/domain/month-view.ts` |
| NEW | `web/src/server/domain/allowed-actions.ts` |
| NEW | `web/src/server/repositories/users.ts` |
| NEW | `web/src/server/repositories/months.ts` |
| NEW | `web/src/server/services/bootstrap.ts` |
| NEW | `web/src/server/services/lifecycle.ts` |
| NEW | `web/src/server/services/month-write.ts` |
| NEW | `web/src/server/services/history.ts` |
| NEW | `web/src/server/services/catch-up.ts` |

### HTTP API (19)

| Action | Path |
|---|---|
| NEW | `web/src/server/http/envelope.ts` |
| NEW | `web/src/server/http/route-handler.ts` |
| NEW | `web/src/server/http/schemas.ts` |
| NEW | `web/src/app/api/bootstrap/route.ts` |
| NEW | `web/src/app/api/onboarding/route.ts` |
| NEW | `web/src/app/api/resume/route.ts` |
| NEW | `web/src/app/api/months/route.ts` |
| NEW | `web/src/app/api/months/current/route.ts` |
| NEW | `web/src/app/api/months/[month]/route.ts` |
| NEW | `web/src/app/api/months/[month]/income/route.ts` |
| NEW | `web/src/app/api/months/[month]/ending-balance/route.ts` |
| NEW | `web/src/app/api/months/[month]/snapshots/route.ts` |
| NEW | `web/src/app/api/months/[month]/recurring-expenses/route.ts` |
| NEW | `web/src/app/api/months/[month]/recurring-expenses/[id]/route.ts` |
| NEW | `web/src/app/api/months/[month]/recurring-expenses/order/route.ts` |
| NEW | `web/src/app/api/months/[month]/details/[setupItemId]/route.ts` |
| NEW | `web/src/app/api/months/[month]/close/route.ts` |
| NEW | `web/src/app/api/health/live/route.ts` |
| NEW | `web/src/app/api/health/ready/route.ts` |

### User interface (23)

| Action | Path |
|---|---|
| NEW | `web/src/app/start/page.tsx` |
| NEW | `web/src/app/resume/page.tsx` |
| NEW | `web/src/app/month/page.tsx` |
| NEW | `web/src/app/history/page.tsx` |
| NEW | `web/src/app/loading.tsx` |
| NEW | `web/src/app/error.tsx` |
| NEW | `web/src/components/app-shell.tsx` |
| NEW | `web/src/components/navigation.tsx` |
| NEW | `web/src/components/theme-control.tsx` |
| NEW | `web/src/components/status-badge.tsx` |
| NEW | `web/src/components/money-field.tsx` |
| NEW | `web/src/components/dialog.tsx` |
| NEW | `web/src/components/feedback-banner.tsx` |
| NEW | `web/src/components/lifecycle-form.tsx` |
| NEW | `web/src/components/month-summary.tsx` |
| NEW | `web/src/components/month-timeline.tsx` |
| NEW | `web/src/components/balance-dialog.tsx` |
| NEW | `web/src/components/expense-chips.tsx` |
| NEW | `web/src/components/expense-setup-manager.tsx` |
| NEW | `web/src/components/expense-setup-dialog.tsx` |
| NEW | `web/src/components/history-explorer.tsx` |
| NEW | `web/src/lib/api-client.ts` |
| NEW | `web/src/lib/format.ts` |

### Operator, deployment and operations (19)

| Action | Path |
|---|---|
| NEW | `scripts/operator/db.mjs` |
| NEW | `scripts/operator/user.mjs` |
| NEW | `scripts/verify-release.sh` |
| NEW | `infra/compose.yaml` |
| NEW | `infra/cloudflare/README.md` |
| NEW | `infra/backup/backup.sh` |
| NEW | `infra/backup/restore-verify.sh` |
| NEW | `infra/systemd/deledger-backup.service` |
| NEW | `infra/systemd/deledger-backup.timer` |
| NEW | `infra/systemd/deledger-restore-verify.service` |
| NEW | `infra/systemd/deledger-restore-verify.timer` |
| NEW | `docs/operations/deploy-private-beta.md` |
| NEW | `docs/operations/operator-runbook.md` |
| NEW | `docs/operations/backup-restore.md` |
| NEW | `infra/systemd/deledger-startup-catch-up.service` |
| NEW | `infra/systemd/deledger-startup-catch-up.timer` |
| NEW | `infra/cloudflare/access-policy-checklist.md` |
| NEW | `infra/backup/README.md` |
| NEW | `docs/operations/release-checklist.md` |

### Automated test support and suites (25)

| Action | Path |
|---|---|
| NEW | `infra/compose.test.yaml` |
| NEW | `scripts/test-db.mjs` |
| NEW | `web/src/test/setup.ts` |
| NEW | `web/src/test/factories.ts` |
| NEW | `web/src/test/postgres.ts` |
| NEW | `web/src/test/jwks-server.ts` |
| NEW | `web/src/test/api-harness.ts` |
| NEW | `web/tests/domain/month-view.test.ts` |
| NEW | `web/tests/database/persistence.integration.test.ts` |
| NEW | `web/tests/database/rls.integration.test.ts` |
| NEW | `web/tests/auth/access.integration.test.ts` |
| NEW | `web/tests/services/lifecycle.integration.test.ts` |
| NEW | `web/tests/services/month-operations.integration.test.ts` |
| NEW | `web/tests/services/catch-up-history.integration.test.ts` |
| NEW | `web/tests/api/contracts.integration.test.ts` |
| NEW | `web/tests/components/theme-control.test.tsx` |
| NEW | `web/tests/components/lifecycle-forms.test.tsx` |
| NEW | `web/tests/components/month-expenses.test.tsx` |
| NEW | `web/tests/components/history-explorer.test.tsx` |
| NEW | `web/e2e/user-journey.spec.ts` |
| NEW | `web/e2e/history-correction.spec.ts` |
| NEW | `web/e2e/security-concurrency-accessibility.spec.ts` |
| NEW | `web/tests/operations/operator.integration.test.ts` |
| NEW | `web/tests/operations/deployment.integration.test.ts` |
| NEW | `web/tests/operations/recovery.integration.test.ts` |

> Audit note: ตารางย่อยเดิมรวม 20 + 27 + 19 + 23 + 19 + 25 = **133 baseline paths**. Gate 8 เพิ่ม operational surface ที่ระบุใน completion record และห้ามเพิ่มไฟล์อื่นโดยไม่แก้ plan/audit ก่อน

## Core contracts to implement exactly

### Month View DTO

```ts
type Money = string;
type MonthKey = `${number}-${string}`;
type ReconciliationState =
  | "draft"
  | "needs_information"
  | "inconsistent"
  | "reconciled";

type MonthView = {
  month: MonthKey;
  lifecycle: "open" | "closed";
  closedBy: "manual" | "automatic" | null;
  trackedFrom: string;
  isPartial: boolean;
  revision: string;
  summary: {
    startingBalance: Money | null;
    income: Money | null;
    endingBalance: Money | null;
    latestSnapshot: { id: string; observedOn: string; amount: Money } | null;
    referenceKind: "ending_balance" | "snapshot" | null;
    referenceAmount: Money | null;
    monthlySpending: Money | null;
    provisionalSpending: Money | null;
    detailTotal: Money;
    unitemizedSpending: Money | null;
  };
  reconciliation: {
    state: ReconciliationState;
    issueCodes: string[];
  };
  setup: Array<{
    id: string;
    position: number;
    name: string;
    kind: "fixed" | "variable";
    fixedAmount: Money | null;
    isPaused: boolean;
    detail: {
      confirmedName: string;
      confirmedKind: "fixed" | "variable";
      confirmedAmount: Money;
      confirmedAt: string;
    } | null;
  }>;
  allowedActions: {
    editIncome: boolean;
    recordSnapshot: boolean;
    editEndingBalance: boolean;
    manageSetup: boolean;
    confirmDetails: boolean;
    manualClose: boolean;
  };
  affectedMonthKeys: MonthKey[];
};
```

`revision` ใช้ decimal string เพื่อไม่เสีย precision ของ PostgreSQL `bigint`; ทุก mutation response คืน `MonthView` ทั้งก้อน

### Error envelope

```ts
type ApiSuccess<T> = { data: T };
type ApiFailure = {
  error: {
    code:
      | "INVALID_INPUT"
      | "ACCESS_TOKEN_MISSING"
      | "ACCESS_TOKEN_INVALID"
      | "USER_NOT_INVITED"
      | "USER_ARCHIVED"
      | "MONTH_NOT_FOUND"
      | "SETUP_ITEM_NOT_FOUND"
      | "REVISION_CONFLICT"
      | "IDENTITY_CONFLICT"
      | "MONTH_NOT_OPEN"
      | "MANUAL_CLOSE_NOT_ALLOWED"
      | "SUMMARY_INCOMPLETE"
      | "SUMMARY_INCONSISTENT"
      | "DETAIL_ALREADY_CONFIRMED"
      | "SETUP_ITEM_CONFIRMED"
      | "REVISION_REQUIRED"
      | "INTERNAL_ERROR"
      | "SERVICE_UNAVAILABLE";
    message: string;
    field: string | null;
    current: MonthView | null;
  };
};
```

### Transaction boundary

```ts
type UserTransaction<T> = (context: {
  client: import("pg").PoolClient;
  ownerId: string;
  requestId: string;
}) => Promise<T>;

async function withUserTransaction<T>(
  request: Request,
  operation: UserTransaction<T>,
): Promise<T>;
```

`withUserTransaction` ต้อง verify JWT ก่อน lease client, `BEGIN`, resolve current identity ผ่าน narrow function, reject open archive, call `set_config('deledger.user_id', ownerId, true)`, execute callback, `COMMIT/ROLLBACK` และ release client ใน `finally` เท่านั้น

### Reconciliation precedence

```text
Open Month                                      → Draft
Closed + missing Starting/Income/Ending         → Needs Information
Closed + Monthly Spending < 0                   → Inconsistent
Closed + detail total > Monthly Spending        → Inconsistent
Closed + complete and coherent                  → Reconciled
```

## Automated test strategy

### Confirmed public seams

การเลือก automated tests ของ User ยืนยัน test categories ที่แนะนำก่อนหน้าแล้ว จึงล็อก seams เหล่านี้สำหรับ implementation ห้ามเพิ่ม tests ที่จับ private method, internal call count หรือ internal SQL shape:

| Seam | Observable behavior | Test artifact |
|---|---|---|
| Domain contract | Money parsing, Month View literals, reconciliation precedence, allowed actions | `web/tests/domain/month-view.test.ts` |
| PostgreSQL boundary | Schema constraints, derived rows, forced RLS, owner isolation, revision/lock behavior | `web/tests/database/*.integration.test.ts` |
| Cloudflare access verifier | Real RS256 signed token against local JWKS; issuer/audience/time/type/email behavior | `web/tests/auth/access.integration.test.ts` |
| Atomic services | Onboarding/resume, mutations, catch-up, close/correction and history through exported service functions + real DB | `web/tests/services/*.integration.test.ts` |
| JSON HTTP API | Exported Next Route Handlers receive real `Request`, signed JWT and real test DB; assert envelope/status/current view | `web/tests/api/contracts.integration.test.ts` |
| Rendered User interface | DOM roles/text/focus/drag/theme behavior plus complete Light/Dark browser journeys | `web/tests/components/*.test.tsx`, `web/e2e/*.spec.ts` |
| Operator/deployment/recovery | CLI/script exit contract, Compose model, encrypted artifact/restore behavior in disposable resources | `web/tests/operations/*.integration.test.ts` |

### TDD loop required inside every implementation task

1. Pick the next smallest observable behavior from specification acceptance scenarios.
2. Add one test through the pre-agreed seam and run only that file; require a meaningful failure caused by missing behavior (Red).
3. Add the minimum production code/migration/config needed for that behavior (Green).
4. Re-run the targeted file, then the affected Gate suite.
5. Review names/duplication/module depth only after Green; refactor is a separate review step and must preserve behavior.
6. Stage the test and its production change together; never commit or push a Red state.

Expected values use fixed worked literals such as `20,000.00 + 30,000.00 − 35,000.00 = 15,000.00`. Tests must not compute the expected side by calling production helpers or repeating the same reduction/formula.

### Test runtime contract

- `infra/compose.test.yaml` publishes PostgreSQL only to loopback `127.0.0.1:55432`, uses a disposable volume/project name and never references production volumes/secrets.
- `scripts/test-db.mjs up|reset|down` owns test Compose lifecycle and refuses any database URL without host `127.0.0.1`, port `55432`, and database suffix `_test`.
- Vitest projects: `unit` (domain + jsdom components), `integration` (database/auth/services/API, serial DB execution), `operations` (disposable files/containers).
- Playwright starts a test-only Next server, disposable database and local JWKS; it injects real signed Access JWT headers. Production still requires HTTPS Cloudflare team domain, while test config accepts HTTP only for loopback JWKS.
- Playwright projects are Chromium, Firefox and WebKit desktop plus one mobile WebKit viewport for the complete user journey; accessibility test uses `@axe-core/playwright`, explicit keyboard/focus assertions and Light/Dark/System theme cases.
- Coverage includes `web/src/server/domain/**`, `web/src/server/services/**` and client state/interaction components, excluding generated/config/Route Handler forwarding files. Thresholds: statements 90%, lines 90%, functions 90%, branches 85%.
- No test hits real Cloudflare, production PostgreSQL, production backup target or User email. Cloudflare dashboard/WARP enrollment remains an operator checklist because policy automation is outside scope.

### Test commands

```text
pnpm test:unit          # Vitest domain + component projects
pnpm test:integration   # disposable PostgreSQL, auth, service and API projects
pnpm test:e2e           # Playwright browser projects
pnpm test:ops           # Compose + backup/restore disposable-resource tests
pnpm test:coverage      # enforced thresholds
pnpm test:all           # unit → integration → E2E → ops → coverage
```

## Git workflow

### Branch preflight before Gate 1

Run from repository root before creating any source file:

```bash
set -euo pipefail
git fetch origin main
test "$(git branch --show-current)" = "main"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git status --short --branch
test -z "$(git branch --list online-mvp)"
test -z "$(git ls-remote --heads origin refs/heads/online-mvp)"
gh auth status
git switch -c online-mvp
```

Preconditions: current branch is `main`, `main` tracks `origin/main`, local `online-mvp` and remote `online-mvp` do not exist, and GitHub CLI is authenticated for `Setthapong-M/deledger`. Existing untracked project docs may follow into the new branch; nested `prototypes/` must remain untouched. If any precondition fails, stop before implementation—do not delete/reuse a branch, force checkout or repair authentication automatically.

### Safe staging and checkpoint rule

- Never run `git add .`, `git add -A`, `git commit -a`, force push, history rewrite or destructive clean/reset.
- Stage only the exact paths owned by the current Gate with `git add -- <explicit-paths>`; Gate 1 may additionally stage existing `.agents/`, `.scratch/deledger-online-mvp/` (excluding generated HTML preview), `AGENTS.md`, `CONTEXT.md`, `docs/agents/`, `docs/adr/` and `skills-lock.json`.
- Before every commit run targeted tests, the complete current Gate suite, `git diff --cached --check`, `git diff --cached --name-only`, secret scan and explicit rejection of staged `prototypes/`, `.env`, dumps, coverage, Playwright artifacts and backup data.
- A vertical slice's test and minimum implementation belong in the same Green commit. Make at least one commit per Gate; split further only when each commit independently passes relevant tests/build.
- Push only after the Gate completion record is Green. First push uses `git push --set-upstream origin online-mvp`; later pushes use `git push origin online-mvp`.

### Gate checkpoint commits

| Gate | Required final checkpoint subject | Push condition |
|---|---|---|
| 1 | `chore: scaffold Deledger workspace and test harness` | install, lint, typecheck, build and test-runner smoke pass |
| 2 | `feat(db): add isolated monthly accounting model` | domain + persistence + RLS suites Green |
| 3 | `feat(auth): bind Cloudflare identity to database sessions` | access/identity suite Green |
| 4 | `feat(domain): implement monthly accounting operations` | lifecycle/month/catch-up/history suites Green |
| 5 | `feat(api): expose Deledger JSON contracts` | API contract suite Green and DTO frozen |
| 6 | `feat(ui): build monthly and history workflows` | unit/component/E2E/accessibility suites Green |
| 7 | `feat(infra): add private local deployment` | deployment operations suite Green |
| 8 | `feat(ops): verify recovery and release readiness` | `pnpm test:all` + full Build check Green |

### Pull Request after Gate 8

After final push, require `git status --porcelain` empty for tracked implementation files, verify `git log --oneline origin/main..HEAD`, then run:

```bash
gh pr create \
  --repo Setthapong-M/deledger \
  --base main \
  --head online-mvp \
  --title "Build Deledger private-beta MVP" \
  --body "## Summary
- Build the invite-only monthly accounting workflow
- Enforce Cloudflare identity and PostgreSQL row isolation
- Add private local deployment and encrypted recovery checks

## Verification
- pnpm test:all
- pnpm lint
- pnpm typecheck
- pnpm build
- bash scripts/verify-release.sh

## Deployment
Private WARP beta only; no public hostname or automatic deployment."
```

Open the PR but do not merge, tag, publish a GitHub Release or deploy automatically. Return the PR URL to the User for review.

## Micro-tasks

## Gate 1 — Repository scaffold and pinned dependency lock

- [x] **1.1 Establish root tracking boundary and workspace metadata** `gate` `high`
  - Complete Git branch preflight and create `online-mvp` before editing implementation paths.
  - Create `.gitignore` covering `.env*` except `.env.example`/`.env.test.example`, `node_modules/`, `.next/`, coverage, Playwright output, logs, dumps, encrypted backups, generated HTML plan previews, runtime secrets and `/prototypes/`.
  - Create `.dockerignore` with Git metadata, scratch/research artifacts, prototypes, dependencies, build output, secrets and backups.
  - Create `.npmrc` containing `save-exact=true`, `engine-strict=true`, `shared-workspace-lockfile=true`.
  - Create `pnpm-workspace.yaml` with only `web` as a package; root scripts remain orchestration/operator scripts.
  - Create `.env.example` listing every specification variable plus role passwords as non-secret placeholders; create `.env.test.example` with loopback-only disposable test values and no working credential.
  - Update `README.md` with product outcome, private-only warning, architecture diagram, development prerequisites and links to spec/runbooks.
  - **Audit:** `git check-ignore -v prototypes/deledger-ui-prototype.html` must report root `.gitignore`; `git status` must not stage or modify the nested prototype repo.

- [x] **1.2 Create exact package manifests and lockfile** `gate` `high`
  - Root `package.json`: `private: true`, `packageManager: pnpm@11.1.3`, Node `22.23.1`, scripts `dev`, `build`, `lint`, `typecheck`, `qc`, `db:migrate`, `db:rollback`, `test:db`, `test:unit`, `test:integration`, `test:e2e`, `test:ops`, `test:coverage`, `test:all`, `operator:user`, `verify:release`; exact dependencies `pg@8.23.0`, `node-pg-migrate@9.0.0` and exact dev type packages from Pinned toolchain.
  - `web/package.json`: exact runtime dependencies `next@16.3.3`, `react@19.2.8`, `react-dom@19.2.8`, `pg@8.23.0`, `jose@6.2.10`, `zod@4.5.4`; exact dev dependencies `typescript@7.0.2`, `eslint@10.9.1`, `eslint-config-next@16.3.3`, React/Node/pg types and every exact test package in Pinned toolchain.
  - Generate `pnpm-lock.yaml` only with pnpm 11.1.3; no semver ranges in either manifest.
  - **Audit:** `pnpm install --frozen-lockfile`, `pnpm list --depth 0` and a script that fails on a dependency spec beginning `^`, `~`, `>`, `<`, `*` must pass.

- [x] **1.3 Bootstrap the minimal Next.js shell** `frontend` `gate`
  - Configure strict TypeScript, `@/*` path alias, App Router, standalone output, React strict mode and server source boundaries.
  - Add root layout with Thai `lang="th"`, viewport metadata, the exact Light/Dark Neutral Ledger CSS tokens—white/black/gray base, immutable opaque `#B5C69C` as the only chromatic accent, and `#262626` as every foreground on primary—and security headers in `next.config.ts`: CSP, `nosniff`, `no-referrer`, and device APIs denied by `Permissions-Policy`.
  - Root layout reads `deledger_theme` with Next `await cookies()`; exact `light|dark` sets `<html data-theme>` and `color-scheme`, while absent/invalid preference renders no attribute and lets `prefers-color-scheme` resolve before paint. No inline theme bootstrap script.
  - Root `/` reads bootstrap lifecycle later; for this gate it renders a server-owned placeholder without mock financial values.
  - `web/Dockerfile` uses multi-stage `node:22.23.1-bookworm-slim`, Corepack pnpm 11.1.3, standalone output, non-root UID and port 80.
  - **Audit:** `pnpm --dir web typecheck`, `pnpm --dir web lint`, `pnpm --dir web build`, and `docker build -f web/Dockerfile .` pass before Gate 2.

- [x] **1.4 Establish disposable test harnesses without production behavior tests** `test-integration` `test-e2e` `high`
  - `vitest.config.ts` defines `unit`, `integration`, `operations` projects, exact include globs, jsdom only for components, serial shared-DB execution, setup file, coverage includes/thresholds from Test runtime contract and no implicit real-network calls.
  - `playwright.config.ts` defines Chromium/Firefox/WebKit desktop plus mobile WebKit, test-only web server, trace on first retry, screenshot/video only on failure and output under ignored paths.
  - `infra/compose.test.yaml` declares an exact build from `db/Dockerfile`, a disposable volume/project identity and loopback `127.0.0.1:55432`; Gate 1 validates rendered config only, and first build/start occurs after Gate 2 creates `db/Dockerfile`.
  - `scripts/test-db.mjs` implements strict `up|reset|down` and refuses non-loopback/non-`_test` targets before invoking Docker.
  - `web/src/test/setup.ts` installs Testing Library DOM matchers and deterministic cleanup only; it must not mock Deledger modules, network, database or time globally. The remaining support modules are created together with their first consumer in Gates 2, 3 and 5.
  - **Audit:** Vitest config loads with `--passWithNoTests`; Playwright lists four projects; Compose test config proves exact DB build path plus loopback-only/disposable resources. No behavioral test is added until its Red step.

- [x] **1.5 Commit and push Gate 1 checkpoint** `gate` `verify`
  - Stage only Gate 1 paths plus the approved existing project docs/agent configuration allowlist; generated HTML preview and `prototypes/` remain unstaged.
  - Run Gate 1 build/test-harness checks, staged diff/secret checks, then commit with `chore: scaffold Deledger workspace and test harness`.
  - Push with `git push --set-upstream origin online-mvp`; confirm local HEAD equals `origin/online-mvp`.
  - **Audit:** `git show --stat --oneline HEAD` contains no secret/runtime/prototype path and every pushed file belongs to the Gate 1 allowlist.

## Gate 2 — PostgreSQL schema, roles, RLS and derived Month View

- [x] **2.1 Build the pinned PostgreSQL + pg_cron image and role bootstrap** `migration` `high`
  - Red: create `web/src/test/factories.ts` and `web/src/test/postgres.ts` only for the first role/extension/image cases in `web/tests/database/persistence.integration.test.ts`; require failure before image/bootstrap exists.
  - Base `db/Dockerfile` on `postgres:18.6-bookworm`; compile pg_cron tag `v1.6.7` in a builder stage and copy only the extension artifacts into runtime.
  - `db/init/001_roles.sh` must create/update `deledger_web`, `deledger_maintenance`, and `deledger_operator` with SCRAM passwords read from environment, all `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`; migration owner remains the container bootstrap role.
  - Set `shared_preload_libraries=pg_cron`, `cron.database_name=deledger`, `cron.timezone=Asia/Bangkok`, and disallow trust authentication.
  - **Audit:** persistence integration test inspects `pg_roles` and fails if the web role owns any table or has `rolsuper`, `rolbypassrls`, `rolcreaterole`, or `rolcreatedb`.

- [x] **2.2 Add immutable schema migrations for the seven owner-scoped tables** `migration` `high`
  - Red: add one constraint behavior at a time to `web/tests/database/persistence.integration.test.ts`, run it to failure, then implement only the migration needed for Green.
  - `202608310001_extensions.cjs`: enable `pg_cron` and `pgcrypto`; record migration extension requirements.
  - `202608310002_schema.cjs`: create `app_user`, `user_identity_email`, `user_archive_period`, `reporting_month`, `balance_snapshot`, `monthly_recurring_expense`, `monthly_expense_detail` exactly as specification section 7.
  - Add all owner-inclusive composite keys/FKs; `ON DELETE RESTRICT`; partial unique indexes for one current email and one open archive period; deferred unique setup position; amount/name/kind/opening/closure/date checks.
  - Keep `income_amount` and `ending_balance_amount` nullable; zero is explicit and valid. Never add stored monthly totals, derived status, global setup or deletion timestamp.
  - Down migrations may remove only objects owned by the migration being rolled back and are never run against production automatically.
  - **Audit:** inspect `information_schema`, `pg_constraint`, and indexes against the seven-table contract; grep migrations to confirm no `real`, `double precision`, `money`, `float`, cascade delete or eighth financial table.

- [x] **2.3 Force RLS and expose only narrow identity/maintenance functions** `migration` `security` `high`
  - Red: `web/tests/database/rls.integration.test.ts` first proves that guessed owner IDs currently cross the boundary, then each RLS policy/grant change makes the observable isolation case Green.
  - `202608310003_rls.cjs`: enable and force RLS on all seven tables; owner predicate is `NULLIF(current_setting('deledger.user_id', true), '')::uuid`, using `id` for `app_user` and `owner_id` elsewhere.
  - Revoke public/schema defaults; grant web only the exact table operations required for User flows. General identity SELECT/DELETE and hard-delete permissions stay absent.
  - `202608310004_functions.cjs`: add fixed-`search_path`, security-definer functions for current identity resolution, business date, operator lifecycle and readiness migration state. Add two idempotent catch-up entries backed by one database implementation: global `catch_up_reporting_months()` executable by maintenance/migration roles only, and owner-scoped `catch_up_current_owner_reporting_months()` executable by web after transaction-local identity is set. Each definer function explicitly sets `search_path = pg_catalog, public` and validates inputs.
  - `202608310005_cron.cjs`: schedule catch-up at `5 0 * * *` with stable job name; migration first unschedules same-name job to remain idempotent.
  - **Audit:** automated RLS suite uses two temporary owner contexts plus a missing context to prove cross-owner SELECT/INSERT/UPDATE/DELETE all fail; it inspects `prosecdef` and `proconfig` for every definer function.

- [x] **2.4 Implement DB boundary and derived Month View query** `backend` `high`
  - Red: add acceptance scenarios 1–3 and reconciliation literals to `web/tests/domain/month-view.test.ts`, plus public persistence behavior to `web/tests/database/persistence.integration.test.ts`; implement one slice at a time.
  - `pool.ts` exports one server-only `pg.Pool` with bounded connections and no query logging.
  - `transaction.ts` provides leased-client transaction helpers; `rls.ts` owns transaction-local `set_config` and never uses session-level `SET`.
  - `money.ts` validates canonical non-negative decimal strings, while SQL performs addition/subtraction; no `Number`, `parseFloat`, unary `+`, or arithmetic operator may be used on monetary application values.
  - `months.ts` returns raw owner rows plus one derived read model: Starting Balance, latest Snapshot, Monthly/Provisional Spending, detail total, Unitemized Spending, reconciliation precedence, ordered setup/detail state and affected next month.
  - `month-view.ts` maps PostgreSQL numeric/bigint values directly to strings and implements the exact `MonthView` contract above; `allowed-actions.ts` derives action flags from server state/business date.
  - **Audit:** `pnpm test:unit` and the persistence/RLS integration files pass against disposable PostgreSQL; expected values are literal spec examples rather than production-helper calculations.

- [x] **2.5 Commit and push Gate 2 checkpoint** `gate` `verify`
  - Run domain + persistence + RLS suites, lint/typecheck, DB image/migration checks and staged safety checks.
  - Commit Green test/implementation state with `feat(db): add isolated monthly accounting model`, then `git push origin online-mvp`.
  - **Audit:** remote checkpoint contains migrations and their behavior tests together; HEAD equals remote and no migration is edited after this commit.

## Gate 3 — Cloudflare JWT verification and transaction-local identity

- [x] **3.1 Validate configuration once and fail closed** `backend` `security`
  - Red: add production-vs-loopback-test configuration cases to `web/tests/auth/access.integration.test.ts`; invalid production origin/team domain must fail before any token/DB access.
  - `config.ts` is the only environment reader and validates exact `APP_ORIGIN=http://deledger.internal`, `BUSINESS_TIME_ZONE=Asia/Bangkok`, PostgreSQL URL and Cloudflare team-domain/audience formats with a closed Zod schema.
  - Client modules never import `config.ts`; no secret uses a `NEXT_PUBLIC_` prefix.
  - **Audit:** production build must fail on absent/invalid required config and logs must mention only variable names, never values.

- [x] **3.2 Verify Access JWT cryptographically** `backend` `security` `high`
  - Red: create `web/src/test/jwks-server.ts` for the first auth test; it signs real RS256 tokens and the public verifier is exercised for one valid/failure behavior at a time. Only remote JWKS/time are controlled system boundaries.
  - `access-jwt.ts` reads only `Cf-Access-Jwt-Assertion`, accepts RS256, verifies JWKS signature, exact issuer `${CLOUDFLARE_TEAM_DOMAIN}`, application audience, `exp`, `nbf`, and Access token type.
  - Normalize email as `email.trim().toLowerCase()` after verification; reject missing/empty/non-string email.
  - Cache remote JWKS in memory; an unknown `kid` triggers one forced JWKS refresh and then rejection. Never decode without verify and never log token/claims/email.
  - **Audit:** auth integration suite covers missing header, malformed token, wrong issuer/audience, expired/not-before, unknown kid refresh and valid token; only valid verified identity reaches DB resolution.

- [x] **3.3 Bind verified identity to one database transaction** `backend` `security` `high`
  - Red: use real Pool reuse in `web/tests/auth/access.integration.test.ts` to expose identity leakage/archival behavior before implementing the transaction wrapper.
  - `identity.ts` resolves exactly one current email mapping through the narrow function and distinguishes not-invited from archived without returning any financial row.
  - `withUserTransaction` follows: verify → lease → `BEGIN` → resolve mapping/archive → `set_config(..., true)` → callback → commit/rollback → release.
  - Run Automatic catch-up before bootstrap read but after owner identity is bound; all statements for a request use the same client.
  - `logging.ts` emits request ID, owner UUID, operation, latency, result code and month only; use an explicit allowlist of log fields.
  - **Audit:** automated auth suite forces callback error and pool reuse, confirms `current_setting('deledger.user_id', true)` empty on the next lease, and proves archived identity fails while JWT remains valid.

- [x] **3.4 Commit and push Gate 3 checkpoint** `gate` `verify`
  - Run access/identity integration suite, existing database suites, lint/typecheck/build and staged secret/log-field checks.
  - Commit with `feat(auth): bind Cloudflare identity to database sessions`, then `git push origin online-mvp`.
  - **Audit:** the pushed checkpoint contains no test signing key outside ignored runtime temp and HEAD equals remote.

## Gate 4 — Atomic domain services and operator CLI

- [x] **4.1 Implement lifecycle and catch-up services** `backend` `high`
  - Red: add onboarding/resume to `lifecycle.integration.test.ts` and catch-up/archive/gap literals to `catch-up-history.integration.test.ts` one scenario at a time before each implementation slice.
  - `lifecycle.ts`: onboarding requires active User with no Reporting Month and creates a supplied opening for PostgreSQL Bangkok today with explicit balance/Income; resume requires `resume_required_at`, creates supplied opening, copies latest setup once and clears the flag atomically.
  - `catch-up.ts` invokes the owner-scoped database catch-up function and maps its result; calendar mutation logic remains single-sourced in PostgreSQL so pg_cron, startup and bootstrap cannot drift. The database implementation locks User; closes every due Open Month; active/no-resume creates and closes missing months until current Open Month exists; active/resume-required creates none; archived closes only last due Open Month and creates none.
  - New automatic months copy all setup rows once, preserve IDs/order/paused state, set `opening_source=prior_ending`, leave Income/Ending absent, and are protected by transaction advisory lock + unique key.
  - Manual Close never calls month creation on the last day.
  - **Audit:** automated service suites execute scenarios 8–15 in disposable DB, including two repeated/concurrent catch-up invocations yielding identical month rows.

- [x] **4.2 Implement all month mutations behind one service interface** `backend` `high`
  - Red: `month-operations.integration.test.ts` adds each observable mutation, validation and stale-write behavior before production code; use a fake clock adapter only for final-day/non-final-day time boundary.
  - `month-write.ts` exports operations for Income, Ending Balance, Snapshot, add/edit/pause/reorder setup, confirm/correct/cancel detail, Manual Close and Closed Month correction.
  - Every operation uses lock order: User → Reporting Months ascending → setup → detail; compares locked revision before rules; increments target month revision exactly once.
  - Snapshot accepts Open Month only and observed date inside tracked interval. Ending Balance is always explicit.
  - Reorder payload must contain every current setup ID exactly once and rewrites dense positions safely under deferred uniqueness.
  - Editing name/kind/fixed amount is blocked when detail exists; pause remains allowed. Fixed detail ignores browser amount and snapshots locked fixed amount. Variable detail requires amount; replacement is one atomic delete+insert. Cancellation deletes detail only.
  - Manual Close uses PostgreSQL business date, final-day gate and coherent Summary Inputs; writes `closed_by=manual`, returns no future month.
  - Revision conflict throws `REVISION_CONFLICT` with freshly derived current Month View; never silently retries.
  - **Audit:** service suite validates scenarios 4–12 and 17 through exported operations and real database; source review confirms one transaction, deterministic locks, revision check and full Month View return.

- [x] **4.3 Implement operator lifecycle/export commands with no admin UI** `backend` `security`
  - Red: add CLI observable behaviors to `web/tests/operations/operator.integration.test.ts` before each command path; use temporary directories and a disposable operator database, never production resources.
  - Root command shape remains exactly: `pnpm operator:user invite|archive|restore|transfer-email|export`.
  - `db.mjs` connects only with operator URL; `user.mjs` parses exact flags, normalizes email and invokes the fixed PostgreSQL operator functions directly. CLI ไม่ import TypeScript จาก `web` และไม่พึ่ง Next.js build output.
  - Invite creates immutable UUID/current mapping idempotently before instructing operator to add Cloudflare allowlist entry.
  - Archive requires TTY confirmation, opens archive period, then prints Cloudflare revoke action. Restore first catch-ups while archived, closes archive and sets `resume_required_at` only if boundary crossed, then prints re-allow action.
  - Transfer requires TTY confirmation, ends old mapping and reactivates/creates new mapping for same User UUID; lifetime email cannot move to another User.
  - Export requires explicit output directory, writes owner rows plus derived summaries to temporary files, encrypts JSON/CSV before final rename, and removes plaintext in `finally`.
  - **Audit:** automated operations suite proves commands reject non-TTY destructive confirmation bypass, unknown flags and conflicting email; stdout/stderr contain no financial values.

- [x] **4.4 Commit and push Gate 4 checkpoint** `gate` `verify`
  - Run lifecycle/month/catch-up/history/CLI suites plus all earlier Gate suites, lint/typecheck/build and staged safety checks.
  - Commit with `feat(domain): implement monthly accounting operations`, then `git push origin online-mvp`.
  - **Audit:** test and implementation for every committed atomic operation are present together and remote HEAD matches local.

## Gate 5 — JSON Route Handlers and frozen API contracts

- [x] **5.1 Build one strict Route Handler adapter** `backend` `high`
  - Red: create `web/src/test/api-harness.ts` for the first HTTP test, then add one behavior at a time to `web/tests/api/contracts.integration.test.ts` using a real `Request`, real signed token and disposable DB; do not mock services/repositories.
  - `schemas.ts` defines closed Zod schemas for dates, MonthKey, UUID, decimal Money and every payload/query from specification section 11; unknown fields fail.
  - `route-handler.ts` enforces JSON content type and exact `Origin === APP_ORIGIN` for mutations, obtains request ID, executes only services through identity transaction, and maps domain errors to the fixed HTTP/code table.
  - `envelope.ts` creates only `{data}` and `{error:{code,message,field,current}}`; 409 always contains current Month View.
  - Route error logging uses the safe allowlist; unexpected errors return `INTERNAL_ERROR` without stack or secret.
  - **Audit:** API contract suite covers malformed JSON, unknown fields, wrong origin/content type and missing revision; source check fails on SQL/repository imports in route files.

- [x] **5.2 Implement lifecycle, read and health routes** `backend`
  - Red: add lifecycle/read/health response behavior to the same API seam before each handler is created.
  - `GET /api/bootstrap` runs catch-up then returns exactly `onboarding_required`, `resume_required`, `ready`, or `closed_until_boundary` plus current Month View when allowed.
  - `/api/onboarding` and `/api/resume` accept `{openingBalance,income}` only.
  - Month list accepts `before=YYYY-MM`, `limit` default 24/max 24 and returns descending Reporting Month/Tracking Gap summaries; month/current/single return complete views.
  - Liveness exposes process-only status without identity. Readiness remains protected and verifies database connection, migration head, pg_cron schedule, mounted `/mnt/deledger-backups`, a fresh checksum-valid encrypted backup, and a fresh restore marker without disclosing values.
  - Startup catch-up is deliberately not an HTTP route; it is owned by the local systemd/database path in Gate 7.
  - **Audit:** API inventory exactly matches specification routes with no privileged internal HTTP hook; archived/unknown identity responses contain no financial values.

- [x] **5.3 Implement all month mutation routes and freeze Month View** `backend` `gate` `high`
  - Red: add the exact method/path/payload, success envelope, error code and revision conflict behavior for each route before implementing it.
  - Add exact method/path/payload pairs from specification section 11; `DELETE details` parses `expectedRevision` from query and no body.
  - Route params are validated before service calls. No route accepts owner/email or client-derived totals/state/actions.
  - Every successful mutation returns complete refreshed Month View with decimal-string revision; correction includes affected dependent month keys.
  - Freeze `MonthView`, error codes, lifecycle states and route inventory at the end of this task; Gate 6 may not extend domain semantics from UI.
  - **Audit:** API suite plus generated endpoint-contract matrix from route exports versus spec proves no endpoint is missing, extra, or semantically overloaded; build/typecheck pass.

- [x] **5.4 Commit and push Gate 5 checkpoint** `gate` `verify`
  - Run API contract suite, every backend suite, lint/typecheck/build and staged route-inventory/secret checks.
  - Commit with `feat(api): expose Deledger JSON contracts`, then `git push origin online-mvp`.
  - **Audit:** pushed Month View/error contract matches the plan and Gate 6 introduces no backend contract extension without a plan revision.

## Gate 6 — Onboarding, current month and Filmstrip + Cover Flow UI

- [x] **6.1 Implement application shell, lifecycle routing and resilient client adapter** `frontend` `high`
  - Red: `theme-control.test.tsx` covers System/Light/Dark radio semantics, root attribute, exact cookie write/delete and system media changes; then `lifecycle-forms.test.tsx` covers lifecycle/form/focus behavior before reusable components are implemented.
  - Implement `theme-control.tsx` as an accessible menu in `app-shell.tsx`: current resolved mode has a sun/moon icon plus accessible label; menu options are “ตามระบบ”, “สว่าง”, “มืด”; selection updates `<html>` immediately and persists only the optional non-sensitive cookie contract.
  - When System is selected, listen to `matchMedia('(prefers-color-scheme: dark)')` only to update the displayed icon/label; CSS remains the visual authority. Remove the listener on unmount and never send theme to API/DB/logs.
  - Root server page calls bootstrap with forwarded Access header and redirects lifecycle to `/start`, `/resume`, `/month`, or closed-current `/month` without leaking query data.
  - `/start` and `/resume` each contain two accessible Money fields; zero Income valid; copy explicitly says earlier/gap months need not be reconstructed.
  - `api-client.ts` sends same-origin JSON, never owner/email, accepts decimal strings, replaces local Month View on success/409, and surfaces fixed Thai messages.
  - `dialog.tsx` manages initial focus, focus trap, Escape, labelled title/description and focus return. All controls have 44px touch targets and visible keyboard focus.
  - Loading uses fixed-size neutral `surface-muted` skeletons; read error retains disabled last-rendered data with Retry; unknown/archived render no financial values.
  - **Audit:** inspect client bundle import graph to confirm no `src/server` module enters it; lifecycle URLs cannot render the wrong form/state after direct navigation.

- [x] **6.2 Implement `/month` against server-owned actions** `frontend` `high`
  - Red: `month-expenses.test.tsx` covers one chip/dialog/reorder/conflict behavior at a time through roles/text/user events; `user-journey.spec.ts` covers the integrated browser path with real API/database.
  - Header shows Reporting Month, Open/Closed, Draft/reconciliation and Partial state. Summary switches provisional Snapshot formula to final Monthly Spending only after explicit Ending Balance.
  - Timeline order: Income → Snapshot → detail chips → Ending Balance → Manual Close. Before final Bangkok day close is absent/disabled per `allowedActions`; after final-day Manual Close show “เดือนถัดไปจะเริ่มหลังเที่ยงคืน”.
  - Render every unpaused setup chip in stored position even after confirmation. Fixed unconfirmed confirms immediately. Variable unconfirmed opens amount dialog. Confirmed Fixed opens cancel confirmation. Confirmed Variable dialog defaults to “แก้ยอด” and provides separate cancel action.
  - Place “เพิ่มรายการรายจ่ายประจำ” beside monthly-detail heading. Manager shows active/paused rows compactly with drag handle, pencil icon and pause/play icon.
  - Pointer drag computes reordered IDs locally and sends one atomic order mutation on drop; keyboard handle supports Space to grab, Arrow Up/Down, Space to drop and Escape to cancel with live-region announcements.
  - Add/edit dialog uses Fixed/Variable radio, requires fixed amount only for Fixed and has no start-month field. Confirmed setup fields respect server rejection; pause never removes existing detail total.
  - A 409 replaces view and displays “มีข้อมูลใหม่จากอีกหน้าจอ โหลดข้อมูลล่าสุดแล้ว”. Field errors sit beside input; domain errors sit by the action.
  - **Audit:** component + user-journey E2E suites pass, source comparison aligns with accepted Variant C structure and production color system in spec section 12, and every displayed amount comes from Month View/formatting only.

- [x] **6.3 Implement synchronized Filmstrip + Cover Flow `/history`** `frontend` `high`
  - Red: `history-explorer.test.tsx` drives synchronized selection, pagination identity and gap rendering; `history-correction.spec.ts` drives correction/dependent refresh through real browser/API/DB.
  - Filmstrip stays above Cover Flow, scrolls horizontally, shows every loaded Reporting Month/Tracking Gap and exposes state with text/symbol/pattern—not color alone.
  - Filmstrip click, Cover click, arrows, keyboard Left/Right and horizontal swipe update one selected index; selected item is centered and both controls remain synchronized.
  - Centered Cover contains month, lifecycle, tracked interval/Partial, Starting Balance, Income, Ending/Snapshot reference, Monthly Spending, detail total, Unitemized Spending, status/issues and only relevant corrections. Remove “ดูรายละเอียดเดือน”.
  - Tracking Gap Cover shows archive/restoration dates and no invented monetary values.
  - Correction stays on History, refreshes selected Cover, filmstrip marker, issue count and returned dependent month in place. Pagination prepends/appends without losing selected MonthKey.
  - Side covers expose only scan-level summary; use CSS 3D transforms with reduced-motion fallback to a horizontal snap carousel.
  - **Audit:** component/E2E suites represent all five states (Open, Reconciled, Needs Information, Inconsistent, Tracking Gap), empty/loading/read-failure and reduced-motion; selection identity remains MonthKey/gap ID after pagination.

- [x] **6.4 Freeze color, accessibility and responsive behavior** `frontend` `gate`
  - Red: `security-concurrency-accessibility.spec.ts` first exposes keyboard/focus/axe/responsive/conflict/theme-flash failures before each accessibility behavior is implemented.
  - Define only the exact Production Light/Dark custom properties. Base rules use tokens; `[data-theme='light']`/`[data-theme='dark']` force a mode and unqualified `@media (prefers-color-scheme: dark)` applies Dark tokens only when no override exists.
  - Use exact opaque `#B5C69C` only for actions, selected chips, current navigation and confirmed reconciliation, with `#262626` for every text/icon foreground on it. Do not define `primary-soft` or derive primary through opacity, tint/shade, `color-mix()`, filter, blend or gradient. Hover/pressed/focus retain the same fill and vary only neutral border/outline/shadow/geometry; disabled uses neutral tokens. Summary emphasis is neutral unless it uses the full exact primary/primary-ink pair. No raw blue/green/amber/red or second accent is allowed. Native inputs/dialogs declare the resolved `color-scheme`.
  - Encode status without hue: Open has hollow-circle/dashed treatment, Reconciled a check plus primary accent, Needs Information has `!` + subtle neutral stripes, Inconsistent has a warning icon + double/high-contrast border, and Tracking Gap has a pause marker + dotted/muted border. Status remains understandable at 200% zoom, forced colors and without gradients.
  - Use semantic headings, form labels, button names, `aria-live` for conflict/reorder messages, and `aria-current` for navigation/selected month.
  - Mobile layout keeps Filmstrip above Cover, chip wrap usable and dialogs within viewport; desktop centers Cover without hiding correction controls.
  - **Audit:** component suites and Playwright Chromium/Firefox/WebKit/mobile projects pass acceptance scenario 20 across System/Light/Dark with axe, contrast and explicit keyboard assertions; computed styles prove primary backgrounds remain exactly `rgb(181, 198, 156)` and their text/icons exactly `rgb(38, 38, 38)` at default, hover, pressed, focus and selected states; reload shows no opposite-theme paint or hydration warning; lint/typecheck/build pass; source inspection finds no `primary-soft`, primary opacity/filter/blend/gradient/`color-mix()`, raw color outside approved token blocks or unnamed icon control.

- [x] **6.5 Commit and push Gate 6 checkpoint** `gate` `verify`
  - Run unit/component suites, all Playwright projects, coverage thresholds, backend regression suites, lint/typecheck/build and staged artifact checks.
  - Commit with `feat(ui): build monthly and history workflows`, then `git push origin online-mvp`.
  - **Audit:** no Playwright output/screenshot/video/coverage artifact is staged; remote HEAD matches local and UI commit contains its behavioral tests.

## Gate 7 — Docker, Cloudflare Private WARP and local deployment

- [x] **7.1 Compose the isolated runtime** `infra` `security` `high`
  - Red: `deployment.integration.test.ts` parses/render-checks production Compose for port/network/secret/runtime restrictions before Compose implementation.
  - `infra/compose.yaml` defines `postgres` on `data` only with no published ports; `web` on `edge` + `data` under alias `deledger.internal`; `cloudflared:2026.7.2` on `edge` only; and an explicitly invoked `backup` profile on `data` only.
  - `web` runs non-root, read-only root filesystem, tmpfs for runtime temp, all capabilities dropped except `NET_BIND_SERVICE`, port 80 exposed only to Compose network. `cloudflared` alone receives Tunnel token. PostgreSQL uses named volume and operator-managed file-backed secrets under `DELEDGER_SECRET_DIR` (default `/etc/deledger/secrets`), scoped by service and readable outside the repository.
  - Health checks, `restart: unless-stopped`, log rotation and dependency health are explicit. Web receives neither Tunnel token nor backup private key; cloudflared receives no DB URL.
  - **Audit:** automated deployment suite plus `docker compose config` proves zero `ports:` entries, exact network membership/secret separation, non-root/capability/read-only settings, and local non-Swarm Compose rendering with disposable file-backed secrets.

- [ ] **7.2 Document and validate Cloudflare private Access configuration** `infra` `security`
  - Checklist covers named Tunnel private hostname `deledger.internal:80`, private Access app, Email OTP, “Authenticate with Cloudflare One Client”, exact-email allow rules, Gateway allow then catch-all block, and WARP Traffic and DNS enrollment.
  - Require Access audience/team domain to match application config; public DNS, Quick Tunnel, wildcard email domain and bypass policy are explicit failures.
  - Validate Access JWT reaches the origin after WARP enrollment and that direct host/LAN access has no listener.
  - **Audit:** two-user invite checklist confirms invited valid User succeeds, non-invited fails at Access, and archived mapped User fails again at database boundary despite token validity.

- [x] **7.3 Run idempotent startup and calendar catch-up** `infra` `high`
  - Red: add disposable restart/catch-up behavior to deployment operations suite before systemd/Compose startup wiring.
  - PostgreSQL pg_cron schedules `catch_up_reporting_months` at 00:05 Bangkok.
  - Startup systemd unit waits for Compose health, then invokes `infra/systemd/startup-catch-up.sh`, which executes global `catch_up_reporting_months()` locally through `docker compose exec postgres psql` as the container bootstrap/migration role and reads the password from the mounted Docker secret. The unit is not network-addressable, and its timer retries safely after host boot/outage.
  - Same catch-up runs before bootstrap, so missed cron/startup execution cannot make a stale month authoritative.
  - **Audit:** automated disposable deployment test stops/restarts twice across supplied business dates and confirms exact missing closed months plus one current Open Month with no duplicates.

- [x] **7.4 Commit and push Gate 7 checkpoint** `gate` `verify`
  - Run deployment operations suite, prior regression suites, Compose/image/security checks and staged secret/runtime checks.
  - Commit with `feat(infra): add private local deployment`, then `git push origin online-mvp`.
  - **Audit:** production Compose has no test override/loopback port merged into it and remote HEAD matches local.

## Gate 8 — Backup, restore and release readiness

- [x] **8.1 Implement encrypted off-device backup with safe retention** `infra` `security` `high`
  - Red: `recovery.integration.test.ts` uses temporary mount fixtures and command boundary fakes to assert refusal/failure/atomic artifact behavior before backup script implementation.
  - `backup.sh` requires `BACKUP_TARGET=/mnt/deledger-backups` to be a mounted filesystem different from the database volume; refuse if absent.
  - At 03:15 Bangkok, stream `pg_dump --format=custom` through `age -r "$BACKUP_AGE_RECIPIENT"` to a same-directory temporary file, calculate SHA-256, verify non-empty encrypted output, then atomic rename.
  - Delete encrypted files older than 30 days only after the new dump and checksum succeed. Never write private key to backup target and remove temp files on trap.
  - systemd service/timer use least-privilege environment file outside repo and persistent timers for missed schedules.
  - **Audit:** automated recovery suite proves failed mount/dump/encryption leaves previous backups untouched and performs no retention; captured logs contain filename/status only.

- [x] **8.2 Implement weekly isolated restore verification** `infra` `high`
  - Red: add newest-valid/corrupt-copy/isolation/cleanup behaviors to recovery integration suite before restore script implementation.
  - `restore-verify.sh` selects newest checksum-valid encrypted dump, decrypts to a private temp file, restores into a uniquely named temporary PostgreSQL container/network/volume based on the production `pg_cron` image, not connected to production.
  - Verify expected migration head, seven table presence, constraint/RLS status, `pg_cron`, and a row-count query for every expected table; do not print row content or amounts.
  - Destroy only resources bearing the generated verification label/name after exact validation; never target production Compose project/volume.
  - Weekly systemd timer records success time consumed by readiness; readiness is Not Ready if backup mount missing, no successful daily backup, or weekly verification overdue.
  - **Audit:** recovery suite restores newest test artifact and rejects corrupt copy without touching production-named resources or deleting last good backup.

- [ ] **8.3 Complete release checks and operational hand-off** `verify` `gate` `high`
  - `verify-release.sh` checks exact toolchain, frozen install, lint, TypeScript, Next production build, web/db Docker builds, Compose config, migration head, forced RLS, pg_cron schedule, no host ports, backup mount, latest backup and weekly restore marker.
  - Runbooks document first deploy, upgrade/rollback boundary, invite/archive/restore/transfer/export, WARP onboarding, outage recovery, backup key custody and restore drill.
  - Verify production image contains no `.env`, `.scratch`, prototypes, source maps with secrets, plaintext export or backup key.
  - Release state is `Ready` only when every required check passes; best-effort/no-SLA limitation is visible in operator runbook.
  - **Audit:** execute Test check + Build check verbatim from a clean dependency state and save only non-sensitive command results in the release checklist.

- [x] **8.4 Commit, push and open the Pull Request** `gate` `verify` `high`
  - Require every automated suite/coverage/build/recovery check Green; stage only Gate 8 paths and updated plan/checklist state.
  - Commit with `feat(ops): verify recovery and release readiness`, push `online-mvp`, confirm remote parity and run the exact `gh pr create` command in Git workflow.
  - Do not merge, tag, release or deploy; return PR URL and any remaining manual Cloudflare/WARP checklist items to User.
  - **Audit:** PR base/head are `main`/`online-mvp`, body reports actual commands run, and GitHub diff contains no prototype, secret, runtime data, generated preview or test artifact.

## Test check

Run targeted test during every Red/Green slice, affected Gate suites before each commit, and this full sequence at Gate 8:

```bash
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:ops
pnpm test:coverage
```

Expected result: all suites Green across configured browser projects; coverage meets statements/lines/functions 90% and branches 85%; test database/containers are disposable and production resources were never addressed. On this host Chromium/Firefox run locally; CI installs the WebKit OS dependencies for the full four-project matrix.

## Build check

Run after every relevant Gate and run the complete sequence at Gate 8:

```bash
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm test:all
docker build -f db/Dockerfile .
docker build -f web/Dockerfile .
docker compose -f infra/compose.yaml config --quiet
pnpm db:migrate -- --check-order
bash scripts/verify-release.sh
```

Expected result: every command exits 0; migrations are at exact head; no host port exists; readiness fails closed until off-device backup mount and verified restore marker exist

## Gate completion record

Executor updates only after commands/audits truly pass:

| Gate | Exit artifact | Status |
|---|---|---|
| 1 | Reproducible locked scaffold/test harness + pushed branch | Passed |
| 2 | Seven-table schema, forced RLS, derived Month View + Green DB suites | Passed |
| 3 | Verified Cloudflare identity + Green auth suite | Passed |
| 4 | Atomic services/operator CLI + Green service/operations suites | Passed |
| 5 | Frozen JSON API/Month View + Green contract suite | Passed |
| 6 | Responsive Neutral Ledger User flows/history + Green component/E2E/accessibility suites | Passed locally (Chromium/Firefox); WebKit OS dependencies covered by CI |
| 7 | Private deployment + Green deployment suite | Passed (static/runtime checks); Cloudflare/WARP activation remains operator-run |
| 8 | Recovery/release checks + final push and open PR | Implementation passed; host release check awaits mounted backup target and operator secrets |

Gate 8 approved additions: `.github/workflows/ci.yml`, `docs/operations/backup-restore.md`, `docs/operations/operator-runbook.md`, `docs/operations/release-checklist.md`, `infra/backup/Dockerfile`, `infra/backup/README.md`, `infra/backup/backup.sh`, `infra/backup/restore-verify.sh`, `infra/compose.yaml` backup profile, `infra/systemd/*`, `scripts/setup-private-beta.sh`, `scripts/test-integration.mjs`, `scripts/test-operations.mjs`, `scripts/test-coverage.mjs`, `scripts/verify-release.sh`, and `web/tests/operations/recovery.integration.test.ts`. The wizard is a human-in-the-loop activation aid; it cannot create Cloudflare credentials, mount storage, or hold the offline recovery key.

## Risk register

| Risk | Mitigation |
|---|---|
| Nested `prototypes/` has uncommitted work and its own remote | Root ignore `/prototypes/`; do not stage, remove `.git`, submodule-add or rewrite it in this plan |
| PostgreSQL role accidentally owns tables or bypasses RLS | Separate migration/web roles; forced RLS; release script inspects role flags and ownership |
| Pooled connection leaks previous User context | `set_config(..., true)` inside leased-client transaction; rollback/release in `finally`; reuse audit |
| Cloudflare header trusted without cryptographic verification | RS256 JWKS verification with exact issuer/audience/time/type; DB mapping remains second boundary |
| Cloudflare revocation lag | Open archive period checked inside DB identity resolution on every protected request |
| Concurrent devices overwrite financial facts | expected revision + deterministic locks + 409 current Month View; no silent retry |
| pg_cron misses downtime boundaries | Idempotent catch-up at cron, startup and bootstrap; rows protected by locks/unique keys |
| Historical setup edit rewrites confirmed facts | Confirmation snapshots; block confirmed setup field edits; correction is cancel + reconfirm |
| History correction leaves dependent month stale | Month View derives on read and response names immediate affected `prior_ending` month |
| JavaScript floating-point corrupts money | Decimal string at boundary, numeric SQL arithmetic, source audit against numeric coercion |
| Private host becomes reachable on LAN/public network | No host ports; WARP private route only; Compose/network inspection in release check |
| Local machine/storage failure loses financial data | Daily encrypted physically off-device backup, 30-day retention and weekly isolated restore |
| Backup cleanup deletes the last recoverable copy | Retention executes only after new encrypted dump and checksum succeed |
| Accent shifts optically between components/states or its foreground loses contrast | One immutable opaque `#B5C69C` token, fixed `#262626` foreground at 8.30:1, no derived primary variants, and computed-style assertions across interaction states |
| Theme flashes or hydrates differently from server | Server renders cookie override, CSS resolves System before paint, client uses the same initial value and no inline bootstrap script |
| Theme preference becomes sensitive/profile state | Store only `light|dark` in a browser cookie, default System by absence, and exclude it from API/DB/log/export |
| Plan expands into Phase 2 | Invariants/out-of-scope re-read at each Gate; contract additions require plan revision before code |
| Tests mirror implementation and pass tautologically | Assert fixed literals from spec, test through public seams and forbid production helpers in expected-value construction |
| Excess internal mocking makes refactors unsafe | Use real PostgreSQL/Route Handlers/browser and double only time, JWKS, network or filesystem boundaries |
| E2E suite becomes flaky | Deterministic seeded data/local JWKS, no arbitrary sleeps, role/state-based waits, trace only on retry and serial shared-state tests |
| Test DB command targets production | `scripts/test-db.mjs` hard-refuses non-loopback, wrong port or database without `_test` suffix |
| Secrets or nested prototype enter Git history | Explicit staging allowlists, secret/artifact scan, never `git add .`, and pre-commit staged-path rejection |
| Remote branch diverges or history is overwritten | Push only normal fast-forward checkpoints; no force-push/rebase/reset; stop on remote mismatch |

## Out-of-scope follow-ups

- Perform a user-observed manual UI validation session after Gate 6 when requested
- Execute the GitHub Actions CI workflow after the Pull Request is opened; it uses disposable resources and no production secrets
- Convert or publish the independent prototype repository only after its owner resolves current uncommitted changes
- Register `deledgr.com` and replace the private edge when the 10-year domain decision is made
- Add credit-card billing-cycle model in Phase 2 as a separate Wayfinder effort
- Add monitoring/alert delivery only after deciding a destination that does not receive financial values

## Plan-quality audit

- [x] Authority and domain vocabulary align with `CONTEXT.md`, ADR 0001–0006 and executable specification
- [x] No unresolved business or architecture placeholder remains
- [x] Execution method is sequential and justified by dependency gates
- [x] User-authorized automated tests, GitHub Actions CI, and source Git branch/commit/push/PR actions are in scope; merge/tag/release/automatic deployment/manual UI remain explicit exclusions
- [x] Test seams are fixed at domain, PostgreSQL, auth, services, HTTP, UI and operations public boundaries
- [x] TDD loop is vertical Red → Green per behavior; internal mocks, tautological expectations and committed Red states are prohibited
- [x] Baseline implementation paths are listed and reconciled to 133 paths; approved Gate 8 operational additions are listed in the completion record
- [x] Every task names exact paths/contracts, an audit and a Gate condition
- [x] Database changes use new immutable numbered migrations; no existing migration is edited
- [x] Forced RLS, transaction-local identity, revision conflict and deterministic lock order are explicit
- [x] No repository/API call is planned inside an application loop; bulk copy/reorder/catch-up stay set-based/transactional
- [x] Month View, error envelope, money transport and lifecycle contracts are frozen before UI
- [x] Build check matches this TypeScript/Next/PostgreSQL/Docker stack rather than unrelated project conventions
- [x] Test check covers unit, real-DB integration, auth, services, API, component, cross-browser E2E, accessibility and operations/recovery
- [x] Git workflow uses branch `online-mvp`, safe staging, Green Gate commits, normal pushes and a final unmerged PR
- [x] Private Beta color system is fixed to accessible Neutral Ledger Light/Dark tokens: white/black/gray base, immutable opaque `#B5C69C` as the only chromatic accent, and fixed `#262626` foreground on primary; grayscale prototype remains structural evidence only
- [x] Primary has no soft/tint/shade/opacity/filter/blend/gradient/`color-mix()` derivative; interaction-state computed-style checks lock the exact primary/foreground pair in System, Light and Dark
- [x] System/Light/Dark behavior, SSR cookie handling, no-flash rendering and both AA token sets are explicit and automatically tested
- [x] Risks include nested Git state, data isolation, concurrency, test validity/flakiness, Git safety, outage catch-up and restore safety
- [x] Plan is stored in the Deledger local issue/spec workspace and does not require PARA infrastructure

Audit result: **ผ่าน — revised plan พร้อมสำหรับ HTML review และ User approval ก่อนเริ่ม branch/test/code actions**
