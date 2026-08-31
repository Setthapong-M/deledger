# Validate the secure online stack path

Type: research
Status: resolved
Blocked by:

## Question

Using only current official primary sources, determine the concrete secure integration path for the confirmed Next.js + TypeScript + Supabase PostgreSQL/Auth online MVP. Cover server/browser client separation, session handling, Row Level Security ownership policies, safe server-side mutations, deployment on Vercel, and a reliable mechanism for calendar-boundary month closure. Record version-sensitive constraints and recommend the smallest architecture that preserves private per-User financial data.

## Answer

Use one Next.js App Router application on Vercel with request-scoped Supabase SSR clients, verified cookie sessions, server-only financial reads and mutations, and per-operation RLS ownership policies. Keep month closure database-native and idempotent through Supabase Cron, with the business date as an independent correctness guard; do not rely on Vercel Cron alone. Pin and recheck the currently beta `@supabase/ssr` and Supabase Cron integrations before implementation. Full evidence and constraints: [Secure online stack path](../research/secure-online-stack-path.md).
