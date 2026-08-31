# Secure online stack path for the Deledger MVP

Researched: 2026-08-30
Scope: current official documentation from Next.js, Supabase, and Vercel only.

## Recommendation

Use one Next.js App Router application with TypeScript on Vercel, backed by one production Supabase project for Auth, PostgreSQL, and its Data API. Do not add a separate API service or a direct PostgreSQL connection for the MVP. Read through Server Components, mutate through Server Actions, and let both use a request-scoped Supabase server client carrying the User's session. Keep Row Level Security (RLS) as the final ownership boundary in PostgreSQL.

The browser receives only the Supabase project URL and a **publishable key**. It never receives a secret key, database password, or another User's raw database object. New Supabase projects are expected to use publishable/secret keys; the legacy `anon` and `service_role` keys are scheduled for deprecation by the end of 2026 ([Supabase key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)).

```text
Browser
  ├─ browser Supabase client: sign-in/sign-out and session-aware UI only
  └─ Next.js navigation/forms
       ├─ Server Components: user-scoped reads
       ├─ Server Actions: validate + authenticate + mutate
       └─ proxy.ts: refresh Auth cookies, not business authorization
                    │
                    ▼
          Supabase Data API / Auth
                    │
                    ▼
         PostgreSQL grants + RLS policies
                    │
                    └─ Supabase Cron → private month-close function
```

## 1. Browser/server client separation and sessions

Create exactly two Supabase client factories, following Supabase's current Next.js SSR pattern ([creating an SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)):

- `lib/supabase/client.ts`: `createBrowserClient()` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `lib/supabase/server.ts`: `createServerClient()` with the same public credentials and the request's cookie adapter. Create it per request; use it only from Server Components, Server Actions, and Route Handlers.
- `proxy.ts`: refresh expiring tokens with `supabase.auth.getClaims()`, copy refreshed cookies to both the request and response, and limit execution with a matcher. Server Components cannot write the refreshed cookies themselves, which is why Supabase's SSR setup requires this Proxy.

For protected pages and every mutation, use `getClaims()` to validate the JWT, or `getUser()` when a fresh Auth-server user record is genuinely needed. Do **not** authorize from `getSession()` on the server: Supabase says its session is read from storage and is not revalidated ([method guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client#hook-up-proxy)). Proxy is token-refresh plumbing and at most an optimistic redirect layer; Next.js explicitly says Proxy is not a complete session-management or authorization solution ([Next.js Proxy](https://nextjs.org/docs/app/getting-started/proxy), [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication)).

Prefer Server Components for financial reads and explicit DTOs containing only fields the UI needs. Keep server data modules marked with `import 'server-only'`; Next.js warns that Client Components must be treated as browser code even when pre-rendered ([Next.js data security](https://nextjs.org/docs/app/guides/data-security)). A browser Supabase client is still safe for operations permitted by RLS, but Deledger does not need direct browser access to financial tables in the MVP, so avoiding it keeps the interface and audit surface smaller.

Version-sensitive details:

- In Next.js 16, `middleware.ts` was renamed to `proxy.ts`; Proxy is not intended for slow data fetching ([Next.js 16 Proxy change](https://nextjs.org/docs/app/getting-started/proxy)).
- `cookies()` became asynchronous in Next.js 15, and synchronous access was removed in Next.js 16. Use `await cookies()` in the server client adapter ([Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies)).
- Supabase currently labels `@supabase/ssr` as beta and warns that its API may break. Pin its version and update the two client factories from the current official template when upgrading ([Supabase SSR overview](https://supabase.com/docs/guides/auth/server-side)).

## 2. RLS ownership boundary

Every exposed financial table must have RLS enabled, `anon` privileges revoked, only the required `authenticated` operations granted, and a separate ownership policy for each operation. Supabase documents that grants and policies are separate checks and that adding policies does not revoke broad grants ([Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security#grants-and-policies)).

Use a non-null `user_id uuid references auth.users(id)` on each User-owned aggregate/root row. For child rows, either derive ownership by joining the parent in the policy or duplicate `user_id` and enforce a composite foreign key such as `(user_id, reporting_month_id)` to the same owner/month pair. The latter makes policies uniform and prevents a child owned by User A from being attached to User B's Reporting Month.

Apply this policy shape to `reporting_months`, `balance_snapshots`, `monthly_recurring_expenses`, and `monthly_expense_details`:

```sql
alter table public.reporting_months enable row level security;
revoke all on table public.reporting_months from anon, authenticated;
grant select, insert, update, delete
  on table public.reporting_months to authenticated;

create policy "read own reporting months"
  on public.reporting_months for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own reporting months"
  on public.reporting_months for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "update own reporting months"
  on public.reporting_months for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own reporting months"
  on public.reporting_months for delete to authenticated
  using ((select auth.uid()) = user_id);
```

`WITH CHECK` on update prevents changing a row's owner, and an update also needs a matching select policy. Index every `user_id` and ownership foreign-key column. These are the current patterns documented by Supabase ([operation-specific policies](https://supabase.com/docs/guides/database/postgres/row-level-security#write-a-policy-for-each-operation)).

Never trust a form-supplied `user_id`; derive it from verified claims and let RLS check it again. Add RLS tests for both the allowed owner and denied non-owner/anonymous cases for every operation, and run `supabase test db`; this is Supabase's prescribed verification path ([RLS testing procedure](https://supabase.com/docs/guides/database/postgres/row-level-security#secure-a-table-with-rls)).

## 3. Safe mutations

Treat every Server Action as a public POST endpoint. Next.js states that an exported Server Action is reachable directly and therefore must repeat authentication and authorization inside the action, regardless of whether the UI hides its button ([mutating data](https://nextjs.org/docs/app/getting-started/mutating-data), [Server Action security](https://nextjs.org/docs/app/guides/data-security#built-in-server-actions-security-features)). For each Deledger mutation:

1. Parse and allow-list the input fields; validate types, money bounds/precision, IDs, dates, and expected state.
2. Create the request-scoped server client and verify identity with `getClaims()`.
3. Ignore any client owner ID; use the verified `sub` as `user_id`.
4. Execute through the user-scoped client so RLS remains active.
5. Check the database result/error, return a non-sensitive error shape, and revalidate the affected route only after success.

Put database invariants in constraints: one Reporting Month per User/month, child rows constrained to the same User and Reporting Month, non-negative balance/income values, valid status values, and stable ordering keys. For a mutation that must update several rows together—manual close, creating the next month plus copying Monthly Expense Setup, or downstream recalculation—expose one narrowly-scoped PostgreSQL function rather than several client round trips. Prefer the default `security invoker`, use `auth.uid()` inside it, and grant `EXECUTE` only to `authenticated` ([Supabase database functions](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker), [function privileges](https://supabase.com/docs/guides/database/functions#function-privileges)).

Do not initialize normal app clients with a secret key: secret keys bypass RLS and must never enter browser code ([Supabase key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys#step-3-swap-the-secret-key-in-backend-code)). The recommended architecture needs no Supabase secret in Vercel at all. If a future administrator-only job requires one, create a separate server-only client, mark the environment variable sensitive, and keep that client out of all User request paths.

## 4. Reliable calendar-boundary closure

Keep the Supabase database in its default UTC timezone, as Supabase recommends, but make Deledger's MVP business timezone explicit as `Asia/Bangkok` whenever converting an instant into a calendar date ([Supabase database timezone](https://supabase.com/docs/guides/database/postgres/configuration#managing-timezones)). Store Reporting Month boundaries as `date` values and closure instants as `timestamptz`; do not rely on the timezone of a Vercel runtime.

Use one private, idempotent database function, for example `private.close_due_reporting_months(p_now timestamptz default now())`, that:

- computes `business_date := (p_now at time zone 'Asia/Bangkok')::date`;
- updates only rows where `status = 'open'` and `period_end < business_date`;
- sets a fixed closed state/`closed_at` rather than incrementing anything;
- marks a month without an Ending Balance as `Needs Information`;
- leaves an already closed month unchanged.

Schedule the function directly with Supabase Cron once per day shortly after Bangkok midnight, e.g. `5 17 * * *` UTC. Supabase Cron can run a database function without a network hop, is backed by `pg_cron`, and records each run in `cron.job_run_details` ([Cron overview](https://supabase.com/docs/guides/cron), [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart)). Revoke `EXECUTE` on this function from `public`, `anon`, and `authenticated`; if it must be `security definer`, put it in a non-exposed schema, set `search_path = ''`, and schema-qualify every relation ([function security](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker), [RLS security-definer warning](https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions)).

Make calendar closure correct even if materialization is delayed: reads must treat `period_end < business_date` as no longer Open, and User mutations must reject Open-only operations after that boundary. The next successful month-initialization or correction mutation can also perform the same conditional close. This is an architectural inference from the documented scheduler and idempotency constraints: the database date is the authority; the scheduled update is its persisted projection. It prevents a delayed job from extending a month.

Do not use Vercel Cron as the sole month boundary mechanism. Vercel states that failed invocations are not retried, duplicate delivery can occur, and Hobby timing may drift anywhere within the scheduled hour; even paid schedules require idempotency ([Vercel Cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [Cron limits and precision](https://vercel.com/docs/cron-jobs/usage-and-pricing)). If Supabase Cron is rejected because its product stage is currently **Beta** ([Supabase Cron feature status](https://supabase.com/features/supabase-cron)), the fallback is a Vercel Cron Route Handler protected by `CRON_SECRET`, calling the same idempotent private operation, plus the same date-derived read guard. Vercel schedules are always UTC ([Vercel Cron syntax](https://vercel.com/docs/cron-jobs)).

## 5. Vercel deployment

Deploy the single Next.js project directly to Vercel; Next.js deployment is zero-configuration there ([Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)). Configure separately scoped Preview and Production values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Only public values have a `NEXT_PUBLIC_` prefix; Next.js embeds those into browser bundles at build time. Keep all future secrets unprefixed and in server-only modules ([Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables#bundling-environment-variables-for-the-browser)). Vercel environment-variable changes affect only new deployments, so redeploy after changing them ([Vercel environment variables](https://vercel.com/docs/environment-variables)).

Set Supabase Auth's Site URL to the exact production domain. Allow the exact production callback path; use wildcard redirect URLs only for localhost and Vercel Preview URLs. Supabase explicitly recommends exact production redirects and documents Vercel's preview pattern ([Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls#vercel-preview-urls)). Do not point Preview deployments at the production financial database: either give Preview a separate Supabase project or omit working Auth/data credentials there.

## Acceptance checks before private beta

- An anonymous client cannot read or mutate any financial row.
- User A cannot select, insert, update, delete, link, or invoke a function against User B's data.
- Every Server Action validates identity and input even when directly POSTed.
- No secret/service-role key appears in a `NEXT_PUBLIC_*` variable, browser bundle, logs, or normal User path.
- Token refresh survives expiry, while server authorization never trusts `getSession()` alone.
- A Bangkok month boundary makes the expired month effectively Closed even if the scheduled projection is late.
- Re-running or concurrently invoking the close function changes no already-closed month and creates no duplicate next month.
- Cron run history is inspected/alerted operationally, and a simulated missed run is repaired by the date-derived guard plus the next successful write.

## Remaining uncertainty

[Supabase's official feature page](https://supabase.com/features/supabase-cron) currently marks Supabase Cron as Beta, and [`@supabase/ssr` is also documented as Beta](https://supabase.com/docs/guides/auth/server-side). Neither changes the domain/data design, but both should be pinned and rechecked against current official docs immediately before implementation. Exact Supabase Cron retry guarantees are not documented in the cited guide, so the design deliberately does not assume retries.
