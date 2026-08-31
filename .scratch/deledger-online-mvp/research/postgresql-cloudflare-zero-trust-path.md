# Local PostgreSQL + Cloudflare Tunnel/Access for the Deledger MVP

Researched: 2026-08-31
Scope: replace managed Supabase with open-source PostgreSQL on the current MSI EdgeXpert host, retain invite-only Email OTP, and expose the local Next.js application through Cloudflare Zero Trust without opening the home network to inbound traffic.

## Bottom line

Both proposed changes are technically viable:

1. **Supabase can be replaced with plain open-source PostgreSQL**, but PostgreSQL replaces only the database. Supabase Auth, `auth.uid()`, the browser-facing Data API, Cron UI, managed backups, monitoring, pausing/upgrade operations, and support do not come with PostgreSQL and must be replaced explicitly. PostgreSQL itself has no license fee and is released under the permissive PostgreSQL License ([PostgreSQL license](https://www.postgresql.org/about/licence/)).
2. **Cloudflare Tunnel + Access can publish and protect the local web application.** Cloudflare Access Email OTP can replace Supabase Auth and the separate SMTP sender for this invite-only MVP. Access sends OTP only to email addresses allowed by policy, places a signed identity JWT on authenticated requests, and the origin can validate the signature, issuer, audience, and expiry before accepting the verified email identity ([Cloudflare OTP](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/), [validate Access JWTs](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)).

The smallest practical and safe stack is therefore:

- one local Next.js + TypeScript application;
- one local PostgreSQL server;
- `pg_cron` for database-native calendar jobs;
- one named `cloudflared` tunnel;
- Cloudflare Access with exact-email OTP allowlisting;
- application middleware that validates the Access JWT and establishes a transaction-scoped PostgreSQL User context;
- encrypted, automated backups copied to a different physical failure domain; and
- service supervision, database/backup health checks, and Cloudflare tunnel alerts.

For ordinary invitees to open a stable HTTPS URL in any browser **without installing a client**, buy one inexpensive domain and publish a hostname such as `app.example.com`. The recurring service cost remains **US$0/month for up to 50 active Cloudflare Zero Trust Users**; only the domain and electricity remain. A realistic planning budget is **US$10–15/year for the domain plus approximately ฿113/month electricity** if this machine must run 24/7 solely for Deledger.

A strict no-domain option exists through a private Cloudflare route, but every User must install and enroll the Cloudflare One Client, and safe HTTPS identity propagation requires additional certificate/TLS-decryption configuration. It is a worse MVP tradeoff than paying roughly one dollar per month for a domain.

## What plain PostgreSQL does and does not replace

Supabase is a collection of services around PostgreSQL, not a different database. Its documented architecture includes Auth, PostgREST, Realtime, Storage, Edge Runtime, Studio, an API gateway, and PostgreSQL ([Supabase architecture](https://supabase.com/docs/guides/getting-started/architecture)). Self-hosting documentation also makes clear that the operator assumes server maintenance, hardening, database maintenance, backups, disaster recovery, monitoring, and uptime, while managed backups and platform features are absent ([Supabase self-hosting responsibilities](https://supabase.com/docs/guides/self-hosting)).

| Managed Supabase capability | Local replacement for Deledger | MVP decision |
|---|---|---|
| PostgreSQL database | PostgreSQL on the MSI EdgeXpert | Direct replacement; no license fee |
| Supabase Auth + Email OTP | Cloudflare Access One-time PIN | Cloudflare sends the OTP; no Brevo/Resend/Supabase SMTP needed |
| `auth.users` | Local `app_user` table | Pre-create one active row per invited email; use an internal UUID as the durable owner ID |
| `auth.uid()` in RLS | Verified Access identity mapped to `app_user.id`, then transaction-local `deledger.user_id` | Application sets it for every financial transaction before querying |
| PostgREST Data API and Supabase browser client | Next.js server-side data layer using a PostgreSQL driver | Browser never receives database credentials and never connects to port 5432 |
| Supabase Cron UI/engine | `pg_cron` extension and SQL migrations | Same underlying scheduler Supabase Cron uses; schedule an idempotent `close_due_months()` function |
| Managed daily backups/PITR | Automated `pg_dump -Fc`, encrypted off-host copies, retention and restore tests | Accept a declared restore-point objective for MVP; add WAL/PITR later if needed |
| Platform monitoring and uptime | service supervisor, `pg_isready`, disk/backup checks, logs, Cloudflare tunnel email alerts | Alerts must leave the host, otherwise a power/host failure cannot report itself |
| Studio | `psql` and migration tooling | Do not expose an admin dashboard for MVP |
| Realtime, Storage, Edge Functions | None initially | The confirmed expense-ledger MVP does not require them |

Self-hosting the entire Supabase Docker stack would preserve more Supabase APIs but would run many services the MVP does not need. Plain PostgreSQL plus the existing full-stack application is a smaller operational and attack surface.

## Cloudflare Access Email OTP as the application identity

### Authentication flow

For a public hostname protected by Access:

1. The User visits the Deledger hostname.
2. Access asks for an email address and sends a single-use PIN only if the address matches an Allow policy. The PIN expires after 10 minutes. The screen deliberately claims a message was sent even for denied addresses to avoid account enumeration ([Cloudflare OTP behavior](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)).
3. Access evaluates the exact-email allowlist and attaches an application JWT to the request sent to the origin in `Cf-Access-Jwt-Assertion`.
4. Next.js validates the JWT using the account JWKS at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, checks the expected `iss` team URL and the application's `aud` tag, and lets its JWT library enforce the time claims. Cloudflare recommends validating this header rather than relying on the browser cookie ([Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)).
5. The verified `email` claim is normalized and looked up in local `app_user`. The request fails closed if no active local User exists, even if the Cloudflare policy was accidentally left stale.
6. The server uses the local User UUID, not a client-supplied UUID or email, as the owner context for all database work.

The Access application token contains `email`, `sub`, `aud`, `iss`, `iat`, `nbf`, and `exp` claims. Merely checking that the header exists is insufficient; the JWT signature and claims must be verified ([Access application token](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)).

Cloudflare Access therefore replaces **authentication and session handling**, but not Deledger's application authorization. The application and PostgreSQL must still enforce that one User cannot access another User's financial rows.

### Invite and revoke operations

For the MVP, one operator action should update both sides:

- add invite: add the exact email to the Cloudflare Access Allow policy and create an inactive/active local `app_user` row through a server-only admin command;
- revoke: remove the email from the policy, mark the local User inactive, and revoke existing Access sessions;
- never use `Include: Login Methods = One-time PIN` alone. Cloudflare warns that this accepts anyone with any valid email; OTP must be paired with exact emails or an explicitly approved domain/list ([common Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/), [Access policy pitfalls](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)).

The two independent checks are intentional. A stale Cloudflare allowlist cannot reveal financial data when the local account is inactive, while a mistakenly created database User cannot reach the origin without passing Access.

### No separate SMTP bill

Cloudflare itself sends the Access OTP from `noreply@notify.cloudflare.com`. Its current Zero Trust Free plan is US$0 forever for up to 50 Users, and its plan page lists no separate per-OTP email charge. Each person consumes one seat after an authentication event regardless of how many applications or devices they use; once seats are exhausted, additional Users are blocked ([Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/), [seat management](https://developers.cloudflare.com/cloudflare-one/team-and-resources/users/seat-management/)).

This removes Supabase Auth MAU cost, custom SMTP, and domain authentication for outgoing OTP email. It also makes Cloudflare an identity/control-plane dependency: if Access or its email delivery is unavailable, Users cannot start a new session even while the local database is healthy.

## Replacing `auth.uid()` safely

`auth.uid()` is a Supabase helper that returns the Supabase Auth User ID. It is not a built-in PostgreSQL function and disappears with Supabase Auth ([Supabase RLS helpers](https://supabase.com/docs/guides/database/postgres/row-level-security)).

Use a request-scoped database identity instead:

1. JWT middleware validates Cloudflare's token and obtains the verified email.
2. The server looks up `app_user.id` using that email.
3. The server begins a database transaction.
4. It executes a parameterized call equivalent to `select set_config('deledger.user_id', $1, true)`. The final `true` makes the value local to the current transaction, which prevents identity leakage when pooled connections are reused ([PostgreSQL `set_config`](https://www.postgresql.org/docs/current/functions-admin.html)).
5. All reads and writes occur within that transaction.
6. RLS policies compare `owner_id` with `nullif(current_setting('deledger.user_id', true), '')::uuid` for both `USING` and `WITH CHECK`.

Database roles matter:

- a separate migration owner owns tables;
- the runtime role is `NOSUPERUSER NOBYPASSRLS`, does not own tables, and has only the required table/function privileges;
- enable and preferably `FORCE ROW LEVEL SECURITY` on User-owned tables;
- write explicit policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`;
- use parameterized queries and never expose a general SQL endpoint.

PostgreSQL documents that superusers, `BYPASSRLS` roles, and normally table owners bypass RLS; `FORCE ROW LEVEL SECURITY` makes the owner subject to policies ([PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)). RLS here is defense in depth against query mistakes. It does not protect against a compromised application server that holds the runtime database credential.

## Replacing the Supabase Data API

Do not install PostgREST merely to reproduce the old client API unless a second non-web client actually needs it. The smaller design is:

```text
Browser
  -> Cloudflare Access/Tunnel
  -> local Next.js Route Handler or Server Action
  -> verified Access identity middleware
  -> server-only query/domain module
  -> PostgreSQL over a Unix socket or loopback
```

The browser calls only same-origin application routes. Next.js owns validation, transactions, domain commands, and the User context. PostgreSQL listens only on a Unix socket or loopback/private container network; port 5432 is never routed through Cloudflare Tunnel and never opened on the router.

This removes the API gateway, anon/service keys, and browser database SDK from the deployment. The cost is that application code must define all queries and mutations rather than receiving a generated REST API.

## Replacing Cron

Supabase Cron itself uses the open-source `pg_cron` PostgreSQL extension ([Supabase Cron internals](https://supabase.com/docs/guides/cron)). The standalone extension is PostgreSQL-licensed, records jobs and run details in database tables, supports timezone configuration, and will not run two instances of the same job concurrently; a later run waits if the prior one is still active ([pg_cron project](https://github.com/citusdata/pg_cron/blob/main/README.md)).

For Deledger:

- set the PostgreSQL and Cron timezone deliberately to `Asia/Bangkok`;
- keep month closure in one idempotent SQL function such as `close_due_months(business_date)`;
- schedule it at least daily shortly after midnight, while retaining the business-date guard so a delayed or repeated job is safe;
- retain manual Close Month as a separate application command according to the confirmed domain decisions;
- monitor `cron.job_run_details` and alert if the last successful run is stale.

The extension requires installation, `shared_preload_libraries`, and a PostgreSQL restart. An OS `systemd` timer invoking the same SQL function is a viable fallback if packaging `pg_cron` on this ARM machine is inconvenient, but then job history and database lifecycle are split across two systems.

## Backups and recovery

Replacing Supabase Managed also removes managed backups. A backup on the same 4 TB NVMe is not a disaster-recovery copy because host theft, filesystem damage, accidental deletion, or disk failure can destroy both.

Minimum supervised-MVP posture:

- create a custom-format logical dump with `pg_dump -Fc`; PostgreSQL describes this as compressed and flexible for selective restore through `pg_restore` ([PostgreSQL `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html));
- because the database is tiny, run it hourly or at least every six hours, with daily/monthly retention according to the acceptable recovery-point objective;
- encrypt before copying with an open-source backup tool and keep at least one copy on another physical device or location;
- keep schema migrations, role definitions, `pg_cron` jobs, and service configuration in version-controlled infrastructure files;
- check backup freshness automatically and fail an operational health check when stale;
- perform and record a restore test into a disposable database at least monthly.

Logical dumps do not offer point-in-time recovery between dumps. If the accepted recovery point later becomes minutes rather than hours, add base backups and continuous WAL archiving. PostgreSQL documents `pg_basebackup` plus retained WAL as the basis for PITR ([PostgreSQL continuous archiving and PITR](https://www.postgresql.org/docs/current/continuous-archiving.html)).

Backup storage is **US$0 only if a suitable off-machine target already exists**. Otherwise, a second disk/NAS/cloud target is a real additional one-time or recurring cost and should not be hidden inside the zero-dollar service total.

## Monitoring and operations

The smallest useful monitoring set is:

- run PostgreSQL, Next.js, and `cloudflared` as separate unprivileged supervised services with automatic restart;
- use `pg_isready` for database reachability; its exit codes distinguish accepting, rejecting, and no-response states ([PostgreSQL `pg_isready`](https://www.postgresql.org/docs/current/app-pg-isready.html));
- monitor free disk space, database size, failed logins, Postgres restarts, last successful Cron job, and last verified backup;
- expose a non-sensitive application health endpoint that verifies a trivial database query;
- configure Cloudflare Tunnel health-change email notifications. Cloudflare documents tunnel logs/metrics and says Tunnel Health Alerts are included in all Zero Trust plans ([Cloudflare Tunnel monitoring](https://developers.cloudflare.com/tunnel/monitoring/));
- rotate and retain local application, PostgreSQL, and backup logs. Zero Trust Free standard log retention is currently only up to 24 hours ([Cloudflare Zero Trust pricing](https://www.cloudflare.com/plans/zero-trust-services/)).

A monitor on the same host cannot notify anyone when that host or its power is down. Cloudflare's external tunnel alert supplies a minimum outside view, but it does not provide high availability. The machine, router, ISP, and household power remain single points of failure.

## Cloudflare Tunnel choices

### Stable public hostname: domain required

For a stable link such as `https://app.example.com`:

- add an active website/domain to the Cloudflare account;
- create a named remotely managed tunnel;
- map a subdomain to the tunnel and local service, normally `http://127.0.0.1:<port>`;
- create the Access application and exact-email policy before inviting Users.

Cloudflare's published-application procedure explicitly requires adding a website to Cloudflare, selecting a domain, and creating a public hostname. Anyone can reach the hostname until an Access policy is added ([create a named tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/), [published applications](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/)).

The hostname points via CNAME to `<UUID>.cfargotunnel.com`; the tunnel UUID cannot be reused from another Cloudflare account. If the tunnel is down, the DNS record remains and visitors receive an error ([Tunnel DNS records](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)).

The home router needs no inbound port forwarding or public static IP. `cloudflared` initiates outbound-only connections, normally over port 7844, and the application can bind to loopback ([Cloudflare Tunnel model](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), [connectivity checks](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/troubleshoot-tunnels/connectivity-prechecks/)).

### Why a Quick Tunnel is not the MVP deployment

`cloudflared tunnel --url ...` creates a random `*.trycloudflare.com` hostname without adding a domain, but Cloudflare expressly limits Quick Tunnels to development/testing:

- random rather than stable URL;
- no SLA or uptime guarantee;
- hard limit of 200 in-flight requests;
- no Server-Sent Events;
- not the named account/zone hostname pattern used for a production Access application.

These constraints come from Cloudflare's own Quick Tunnel documentation ([Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)). A random public testing URL is not an acceptable entry point for real personal financial records.

### Strict no-domain route: private network through Cloudflare One Client

It is possible to avoid a domain without using a Quick Tunnel:

1. create a named tunnel with a private IP or private-hostname route;
2. require every User device to install and enroll the Cloudflare One Client;
3. restrict device enrollment to exact invited email OTP identities;
4. create a self-hosted private Access application for the IP/hostname and port;
5. route only this private application through the client.

Private routes are not reachable from the public Internet; Users must route through Cloudflare Gateway, normally using the Cloudflare One Client ([private networks](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/), [web application types](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/)). A private hostname can be an internal FQDN such as `deledger.internal.local`, but it needs Gateway resolver policy or a custom DNS resolver ([secure a private IP or hostname](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/non-http/self-hosted-private-app/)).

There is extra identity/TLS complexity if Deledger must consume an Access JWT for per-User RLS:

- plaintext HTTP on port 80 can receive the normal browser Access application token, but the browser shows an insecure HTTP origin;
- HTTPS on port 443 needs a valid SNI/origin certificate and Gateway TLS decryption if the origin needs the Access application JWT; User devices must install and trust the Cloudflare root certificate;
- without TLS decryption, Cloudflare tracks the private-app session in the device client instead of issuing the normal browser token to the origin.

Cloudflare documents these flows directly in its private-app guide ([private app authentication flow](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/non-http/self-hosted-private-app/)). This can be secure when configured correctly, but onboarding every phone/computer plus certificate and DNS work is disproportionate for Deledger's small browser-based MVP.

## Required security controls

Regardless of hostname choice:

1. **Origin isolation:** bind Next.js to loopback; bind PostgreSQL to a Unix socket/loopback; expose only the web service through `cloudflared`; never expose port 5432.
2. **Fail closed at Cloudflare:** create an Access policy using exact invited emails and require the One-time PIN login method. Enable Cloudflare's account-level “Require Access protection” default-deny posture where practical, so a hostname accidentally created without an Access app is blocked ([Require Access protection](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/require-access-protection/)).
3. **Validate origin identity:** verify `Cf-Access-Jwt-Assertion` cryptographically with the Cloudflare JWKS, issuer, expected AUD, and time claims on every authenticated request. Never trust a raw email header.
4. **Authorize locally:** require a matching active local `app_user`, propagate its UUID transaction-locally, and enforce PostgreSQL RLS for every User-owned table.
5. **Protect mutations:** server-side schema validation, parameterized SQL, same-origin/CSRF checks, idempotency where retries matter, and audit timestamps.
6. **Host hardening:** automatic security updates on a controlled schedule, full-disk encryption, encrypted backups, separate Unix users, least-privilege file permissions, secret rotation, and no database/admin UI published through the tunnel.
7. **Operational recovery:** supervised services, tunnel alerts, backup freshness alerts, restore tests, and a written procedure for revoking an invited User.
8. **Acknowledge availability:** Tunnel removes inbound network exposure but not the single-machine, single-ISP, and single-power-supply failure modes.

## Cost comparison

Cloudflare's current Free plan is US$0 forever for up to 50 Users; pay-as-you-go is US$7 per User/month beyond the small-team posture. Tunnel, Access policies, and OTP are usable on the Free plan. The plan carries community support and up to 24-hour standard log retention rather than a paid SLA/support posture ([Cloudflare pricing](https://www.cloudflare.com/plans/zero-trust-services/)).

| Scenario | Recurring services | Domain | Power if host is dedicated 24/7 | User experience |
|---|---:|---:|---:|---|
| No domain, private WARP route, <=50 Users | **US$0/month** | $0 | about **฿113/month incl. VAT** planning proxy | Every User installs/enrolls Cloudflare One Client; HTTPS/JWT setup is more involved |
| Stable browser URL + Access OTP, <=50 Users | **US$0/month** | plan **US$10–15/year** | about **฿113/month incl. VAT** | Open a normal HTTPS URL; OTP in browser; recommended |
| Same architecture above Free seat limit | **US$7/active User/month** at current pay-as-you-go list price | same | same | Paid plan/support/log posture changes |

There is no Supabase, Vercel, Tailscale, Brevo, Resend, static public IP, or router-port-forwarding bill in these scenarios. Cloudflare Registrar sells domains at registry/ICANN cost without markup. Actual price depends on the exact available name and TLD and must be checked immediately before purchase; its current Registrar API documentation illustrates US$10.11/year for a standard `.dev` and US$11.00/year for a standard `.app`, which supports the US$10–15 planning range rather than guaranteeing a particular Deledger name ([Cloudflare Registrar](https://developers.cloudflare.com/registrar/), [real-time Registrar pricing API](https://developers.cloudflare.com/registrar/registrar-api/)).

The electricity figure reuses the earlier local-host research: 38 W reference idle × 24 × 30 is 27.36 kWh/month, approximately ฿113 including VAT at the cited September 2026 Thai rate. It is a planning proxy, not a measured marginal draw of this MSI unit. If the machine is already on continuously, Deledger's incremental electricity is much lower; use a wall meter for the actual number ([local-host cost research](./local-host-email-otp-costs.md)).

Not included in either zero-dollar service total:

- an off-machine backup target if none already exists;
- UPS or redundant internet;
- operator time for patching, incident response, backup testing, and major PostgreSQL upgrades;
- any future requirement for high availability or a paid SLA.

## Recommendation

Adopt the architecture only with the following explicit choice:

> **Local PostgreSQL + local Next.js + named Cloudflare Tunnel + Cloudflare Access exact-email OTP + one inexpensive domain.**

This makes the user-facing URL stable, removes Supabase and SMTP subscriptions, keeps the database on the local machine, allows invite-only browser access without client installation, and lets Cloudflare's signed JWT establish the User identity that the application maps into PostgreSQL RLS.

Budget:

- **US$0/month in service subscriptions** while the invite-only beta remains at or below 50 active Users;
- **US$10–15/year** for a domain, verified at purchase;
- approximately **฿113/month electricity** only if this machine would otherwise be off; and
- **US$0 backup storage only if** an appropriate encrypted off-machine destination already exists.

If “no domain under any circumstance” is a hard requirement, use the private WARP route rather than Quick Tunnel, accept mandatory Cloudflare One Client onboarding, and prototype the private HTTPS/JWT flow before application implementation. Do not use a Quick Tunnel for real financial data.
