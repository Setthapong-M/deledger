# Monetary cost of the Email-OTP Deledger MVP

Researched: 2026-08-31
Scope: current official Supabase, Vercel, Resend, Cloudflare, and Porkbun sources. Prices are in **USD as displayed on 2026-08-31**, before tax, VAT, card/foreign-exchange charges, and future price changes.

## Architecture and costing assumptions

This estimate follows the selected architecture: one Next.js App Router application on Vercel, one production Supabase project for PostgreSQL, Auth, Data API, and Supabase Cron, and **Email OTP as the only sign-in method**. It assumes one operator, an invite-only beta of at most 100 Users, persistent sessions, no file uploads, one production database, no paid staging database, and no native mobile application.

For production email delivery, this estimate uses Resend as Supabase's custom SMTP provider. Supabase supports any SMTP provider and lists Resend among its compatible options ([Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)). Resend is a costing baseline rather than a durable architecture decision; changing SMTP providers does not change the Deledger domain model.

## Bottom line

| Launch posture | Supabase | Vercel | Resend SMTP | Example `.com` domain | Effective infrastructure budget |
|---|---:|---:|---:|---:|---:|
| Experimental, personal/non-commercial beta | Free, $0 | Hobby, $0 | Free, $0 | $11.08/year | **$11.08/year**, about **$0.92/month** amortized |
| Safer personal/non-commercial beta | Pro, $25/month | Hobby, $0 | Free, $0 | $11.08/year | about **$25.92/month** |
| Recommended product/commercial beta | Pro, $25/month | Pro, $20/month for one member | Free, $0 | $11.08/year | about **$45.92/month** |

The first row is technically sufficient to let invited Users test the product, but it is not the recommended home for real financial records: a quiet Supabase Free project can be paused, and Free does not provide downloadable managed backups. The third row is the prudent budget if Deledger is being operated as a product or business. The second row is reasonable only while the deployment remains genuinely personal and non-commercial under Vercel's terms.

## Required at launch

### 1. Supabase project: $0 technically, $25/month recommended

Supabase Free includes 50,000 Monthly Active Users, 500 MB of database space, 5 GB of egress, 1 GB of file storage, and two active Free projects. This is far above the expected Auth and data volume of a small Deledger beta. Supabase charges Auth by distinct monthly active User, so repeat Email OTP sign-ins by the same User do not create a separate per-login Supabase fee ([Supabase pricing](https://supabase.com/pricing), [Supabase MAU billing](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)).

The Free caveats matter because Deledger stores financial records:

- Free projects with low activity can be paused after a seven-day period. They can be restored, but this can interrupt an infrequently used private beta ([Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
- Free projects do not include downloadable managed backups. Supabase recommends regularly running `supabase db dump` and keeping off-site backups for Free projects ([Supabase database backups](https://supabase.com/docs/guides/platform/backups)).
- Free has community support and one hour of Auth audit-log retention; Pro has email support and seven-day Auth/log retention ([Supabase pricing](https://supabase.com/pricing)).

Supabase Pro starts at $25/month. Its included $10 compute credit covers one default Micro project, and the plan includes 100,000 MAU, 8 GB database disk, 250 GB egress, no inactivity pausing, and daily backups retained for seven days ([Supabase pricing](https://supabase.com/pricing)). These quotas should comfortably cover a private beta, so the expected Supabase charge is the fixed $25 rather than usage overage.

**Recommendation:** use Free while developing with synthetic/test data; move the one production project to Pro before asking beta Users to entrust it with real financial records.

### 2. Vercel hosting: $0 or $20/month depending on use

Vercel Hobby is $0 and includes automatic HTTPS/SSL, deployments, 100 GB Fast Data Transfer, one million function invocations, and other quotas far above the likely private-beta load ([Vercel plans](https://vercel.com/docs/plans), [Vercel limits](https://vercel.com/docs/limits)).

Hobby is restricted to personal, non-commercial use. Vercel defines commercial use as a deployment intended for financial gain and requires Pro or Enterprise for it ([Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)). Vercel Pro is $20/month, includes $20 of usage credit, and additional team members cost $20 per User per month ([Vercel pricing](https://vercel.com/pricing), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)).

Therefore a free, personal experiment can use Hobby. If Deledger is already a commercial product, is accepting payment, advertises a paid service, or is built/operated as paid work, budget at least one Pro member at $20/month. A private-beta label alone does not override the commercial-use rule.

### 3. Production Email OTP delivery: custom SMTP required, initially $0/month

Supabase's built-in email sender is not a production sender. It delivers only to addresses belonging to project-team members, is currently limited to two messages per hour, has no delivery SLA, and is explicitly described as best-effort/non-production. External beta Users therefore require custom SMTP ([Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).

Resend Free currently includes 3,000 transactional emails per month and 100 per day, with SMTP relay and a custom sending domain. Resend Pro is $20/month for 50,000 emails, with no daily limit and $0.90 per additional 1,000 emails ([Resend pricing](https://resend.com/pricing?volume=50000), [Resend account quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)).

For illustration, 100 beta Users requesting four OTP emails each month consume about 400 emails. Invitations and deletion confirmations add some traffic, but this remains well inside 3,000/month and 100/day if onboarding is staged. Supabase initially applies its own 30-new-users-per-hour Auth email limit after custom SMTP is configured; this is suitable for an invite-only beta and can be adjusted if needed ([Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).

There is no SMS provider, phone-verification fee, or Supabase Phone MFA charge under this decision.

### 4. Sending domain: annual registrar fee unless one is already owned

Resend's `resend.dev` sender can send only to the Resend account owner's email. Sending OTP to beta Users requires a domain owned and verified by Deledger, with SPF and DKIM DNS records ([Resend test-domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)).

The exact price depends on the chosen name, TLD, registrar, tax, and renewal price. As a concrete budgeting example, Porkbun currently lists `.com` registration and renewal at $11.08/year ([Porkbun domain pricing](https://porkbun.com/products/domains)). Cloudflare Registrar is another option and states that it charges the registry and ICANN price without markup, but its exact real-time price depends on the domain/TLD ([Cloudflare Registrar](https://developers.cloudflare.com/registrar/)). Check availability and renewal price immediately before purchase.

One domain can serve both purposes—for example, the web app at `deledger.example` and Auth mail from `no-reply@auth.deledger.example`. A separate paid mailbox is not required: after domain verification, Resend permits sending from any address on that domain even if the mailbox does not exist, although it recommends a reply-capable address ([Resend sender addresses](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend)).

## Optional or avoidable costs

| Item | Current cost | MVP decision |
|---|---:|---|
| Supabase custom API/Auth domain | $10/month | Not needed. This is distinct from buying the public/sending domain. The app can use the normal Supabase project URL behind server-side operations. |
| Second paid Supabase project for staging | About $10/month on default Micro compute | Avoid initially: use local Supabase for development and keep Preview deployments disconnected from production data. Add when a persistent shared staging environment is genuinely needed. |
| Resend Pro | $20/month for 50,000 emails | Add only after exceeding the Free plan's 100/day or 3,000/month, or when a paid-plan capability is needed. |
| Supabase Point-in-Time Recovery | From about $100/month for seven-day retention | Not needed for the MVP. Pro's daily seven-day backups are the proportionate starting point. |
| Extra Vercel Pro members | $20/member/month | Add only for collaborators who require paid team-member access; keep one operator initially. |
| Paid monitoring, analytics, storage, and file CDN | Provider-dependent | Not part of the chosen MVP. Basic provider dashboards/logs are enough to start. |

Supabase prices its custom domain at $10/month, PITR at approximately $100/month for seven-day retention, and additional default-Micro projects at about $10/month after the organization's compute credit ([Supabase pricing](https://supabase.com/pricing), [Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [Supabase backups](https://supabase.com/docs/guides/platform/backups)).

Supabase Cron does not appear as a separate billable product in Supabase's official pricing; it runs as a `pg_cron` module inside the existing database. The cost implication is therefore database compute/load, which is negligible for one short idempotent month-close job per day in this MVP ([Supabase Cron](https://supabase.com/docs/guides/cron), [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)). This is an inference from the documented architecture and billable-item list, not a promise that pricing cannot change.

## Scale-triggered costs

The first likely upgrade trigger is not MAU; it is operational assurance or the email daily limit:

1. **Resend:** move to $20/month if OTP/invitation traffic exceeds 100 emails on busy days or 3,000 per month.
2. **Vercel:** move to Pro immediately when the deployment becomes commercial; usage beyond Pro's included $20 credit is pay-as-you-go.
3. **Supabase:** Pro already covers 100,000 MAU, 8 GB database disk, and 250 GB egress. Above that, current overage begins at $0.00325 per MAU, $0.125 per database GB, and $0.09 per egress GB ([Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)). Deledger's small numeric/monthly records should reach these thresholds only after substantial growth.
4. **Reliability:** PITR, a paid staging database, and paid observability are reliability decisions, not user-count requirements. Add them in response to recovery objectives and operating maturity.

## Recommended budget decision

For development and a self-only test, pay only for the domain (or use an already-owned domain) and remain on free tiers.

For a real invite-only private beta storing other people's financial records, budget **approximately $46/month including the domain cost amortized across the year**, before tax and currency conversion:

- Supabase Pro: $25/month
- Vercel Pro, one member: $20/month
- Resend Free: $0/month at expected beta volume
- Example `.com`: $11.08/year, about $0.92/month amortized

If the beta is unequivocally personal and non-commercial, Vercel Hobby can reduce this to approximately **$26/month including the amortized domain**. The financially cheapest configuration is approximately **$11/year**, but accepting real financial records without managed backups and with possible project pausing is a conscious reliability compromise, not a no-cost production architecture.
