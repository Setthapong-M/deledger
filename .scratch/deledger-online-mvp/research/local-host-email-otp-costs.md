# Cost of a local-hosted, domainless Email-OTP Deledger MVP

Researched: 2026-08-31
Scope: host the Deledger web application on the current local machine, buy no web domain, keep Email OTP as the only sign-in method, and admit only invited Users. Prices are current official list prices in USD unless stated otherwise. Thai electricity examples use the rate taking effect in September 2026.

## Bottom line

For a **non-commercial private beta of no more than six people**, the service subscriptions can be reduced to **US$0/month**:

- local Next.js application: $0
- Tailscale Serve Personal: $0, with HTTPS at an assigned `*.ts.net` URL
- Supabase Managed Free: $0
- Brevo Free custom SMTP: $0, up to 300 emails/day
- web domain: $0

The current host is an MSI EdgeXpert MS-C931 built on the NVIDIA DGX Spark GB10 platform. NVIDIA specifies 38 W idle power for its DGX Spark reference system, so that is a planning proxy rather than a measured power figure for this MSI unit. Running at 38 W continuously uses about 27.36 kWh/month. At Thailand's September 2026 average electricity rate of ฿3.86/kWh before VAT, that is approximately **฿106/month before VAT, or ฿113/month including 7% VAT**, if the machine would otherwise be switched off. Hosting this small application should keep the machine close to idle when it is not simultaneously doing AI workloads. If the machine already runs continuously, the incremental power attributable to Deledger should be much smaller and should be measured at the wall.

This $0-service posture is suitable for a tightly supervised beta, but it intentionally accepts weaker email deliverability, possible Supabase Free pausing, no managed database backup, and home-machine/home-internet downtime.

## Cost scenarios

| Posture | Web access | Database/Auth | OTP email | Service subscriptions | Approximate current-host electricity |
|---|---|---|---|---:|---:|
| Lowest-cost private beta, <=6 non-commercial Users | Tailscale Serve Personal | Supabase Free | Brevo Free, domainless sender | **$0/month** | about **฿113/month incl. VAT** if on 24/7 solely for hosting |
| Public-link private beta | Tailscale Funnel | Supabase Free | Brevo Free, domainless sender | **$0/month** on an eligible free Tailscale plan | same |
| Safer database posture | Tailscale Serve/Funnel | Supabase Pro | Brevo Free | **$25/month** plus power | same |
| Fully self-hosted Supabase | Tailscale Serve/Funnel | self-hosted Docker stack | Brevo Free | **$0/month** plus power, backup media/services, and operator time | likely above idle; measure after deployment |

The internet connection adds $0 incremental cost if the existing fixed home connection is reused. It still becomes a runtime dependency: a router outage, ISP outage, power cut, machine reboot, or suspended local process takes Deledger offline. Tailscale uses an encrypted tunnel and does not require buying a public IP or opening a router port for these access patterns.

## Access without buying a web domain

### Recommended for at most six known testers: Tailscale Serve

Tailscale Serve proxies a local port only inside the private tailnet and automatically provisions HTTPS at a URL such as `https://device.tailnet.ts.net`. Tailnet access-control rules continue to apply. Tailscale Personal is $0, allows up to six Users and unlimited User devices, and is intended for non-commercial personal use ([Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve), [Tailscale pricing](https://tailscale.com/pricing), [Tailscale free-plan eligibility](https://tailscale.com/docs/account/manage-plans/free-plans-discounts)).

The tradeoff is onboarding: every tester must install or sign in to Tailscale and join the tailnet. The six-person allowance includes the operator. This network gate complements rather than replaces Deledger's invite-only Email OTP.

### Easier tester onboarding: Tailscale Funnel

Tailscale Funnel publishes the local app to the internet at an HTTPS `*.ts.net` URL. Testers do not install Tailscale, and the host's public IP is not exposed. Funnel is available on all Tailscale plans, but remains beta, permits only ports 443, 8443 and 10000, and has non-configurable bandwidth limits. Because the endpoint is public, application Auth, server hardening and rate limiting remain mandatory ([Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel)).

If Deledger becomes a commercial service, do not assume the Personal plan remains eligible. Tailscale Standard currently costs $8 per tailnet User per month. With Funnel, beta Users visiting the public URL are not themselves tailnet Users; ordinarily only operators/devices administered inside the tailnet consume tailnet seats, subject to Tailscale's current account terms ([Tailscale pricing](https://tailscale.com/pricing)).

## Email OTP without owning a domain

Supabase's built-in email sender is not a viable external beta sender. It sends only to email addresses that belong to Supabase project-team members, is currently limited to two messages per hour, and has no delivery SLA. Invite-only Deledger Users do not become Supabase dashboard team members. Supabase therefore calls for custom SMTP for external Users ([Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).

Resend Free does not solve the no-domain constraint: its shared `resend.dev` test sender may email only the address associated with the Resend account. Other recipients require an owned and verified domain ([Resend test-domain restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)).

A domainless $0 option is **Brevo Free**. Brevo can verify an individual sender address using a code and its Free plan includes transactional SMTP/API with a 300-email daily limit. This comfortably covers a small invite-only beta ([Brevo sender setup](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [Brevo plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)).

This is a functional bridge, not equivalent to an authenticated sending domain. A free email domain such as `gmail.com` cannot be DKIM/DMARC-authenticated by Deledger. Brevo may rewrite the transactional `From` address to one of its own compliant domains; Brevo warns that unauthenticated/free sender addresses can be rejected, sent to spam, or be less recognizable to recipients ([Brevo sender requirements](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders)). For the beta, invited Users should be told the expected sender name and to check spam. Persistent sessions should reduce OTP traffic and exposure to delivery failures.

## Managed Supabase: Free versus Pro

Supabase Free is amply sized for the expected volume: 50,000 MAU, 500 MB database, 5 GB egress and two active projects. Custom SMTP is supported. However, Free projects can pause after one week of inactivity and do not include automatic backups. Supabase Pro starts at $25/month, does not pause, and adds daily backups with seven-day retention, 8 GB database disk and 100,000 MAU ([Supabase pricing](https://supabase.com/pricing), [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Supabase backups](https://supabase.com/docs/guides/platform/backups)).

For real financial records on Free, schedule and test `supabase db dump`, store encrypted copies away from both the local host and the Supabase project, and verify restoration. Backup storage may be $0 if suitable existing off-machine storage is available; otherwise its price is an additional hardware or cloud-storage cost.

## Fully self-hosting Supabase locally

The Supabase self-hosted software has no platform subscription fee and this DGX Spark exceeds the official minimum of 4 GB RAM, two CPU cores and 40 GB SSD (8 GB RAM, four cores and 80 GB SSD recommended). A production instance must use Supabase's self-hosted Docker deployment; the Supabase CLI local-development stack is explicitly not hardened and must not be exposed to external traffic ([Supabase Docker self-hosting](https://supabase.com/docs/guides/self-hosting/docker), [Supabase self-hosting](https://supabase.com/docs/guides/self-hosting)).

Self-hosting removes the $25 managed-plan option but transfers responsibility for all of the following to the operator:

- OS and Supabase security updates
- secrets, firewall and TLS/reverse-proxy configuration
- PostgreSQL maintenance
- backups and tested disaster recovery
- monitoring, uptime and incident recovery
- production SMTP

The self-hosted offering has no managed backups/PITR or platform support. It also keeps the only production database in the same home-machine failure domain as the application unless off-machine backups are added. For this small MVP, the saved cash is not proportionate to the additional operational risk and work.

## Electricity calculation for this machine

Inspection identifies this host as an MSI EdgeXpert MS-C931 with 20 Arm cores, NVIDIA GB10, 128 GB memory and 4 TB NVMe; MSI describes it as built on the NVIDIA DGX Spark platform ([MSI EdgeXpert MS-C931](https://ipc.msi.com/product_detail/Industrial-Computer-Box-PC/AI-Supercomputer/EdgeXpert-MS-C931)). NVIDIA declares 38 W idle and 233.2 W maximum for its DGX Spark reference system, which provides a useful estimate but not a wall measurement of this MSI unit ([NVIDIA DGX Spark compliance specifications](https://docs.nvidia.com/dgx/dgx-spark/compliance.html), [NVIDIA DGX Spark hardware overview](https://docs.nvidia.com/dgx/dgx-spark/hardware.html)).

The Energy Regulatory Commission states that the September-December 2026 average tariff is ฿3.86/kWh before VAT under the new residential structure ([ERC announcement](https://www.erc.or.th/th/news-release/3472)). Actual household billing is tiered, so this is a planning estimate rather than the exact marginal rate on a particular bill.

| Average whole-system draw | Monthly energy (30 days) | Estimated cost before VAT | Estimated cost incl. 7% VAT |
|---:|---:|---:|---:|
| 38 W declared idle | 27.36 kWh | ฿105.61 | **฿113.00** |
| 50 W illustrative light load | 36.00 kWh | ฿138.96 | ฿148.69 |
| 100 W mixed workload | 72.00 kWh | ฿277.92 | ฿297.37 |
| 233.2 W declared maximum | 167.90 kWh | ฿648.09 | ฿693.46 |

Formula: `watts / 1000 × 24 × 30 × tariff`. The GPU-only number from `nvidia-smi` is not whole-system power and should not be used for billing. A plug-in energy meter measured over several days is the reliable way to isolate the real incremental cost.

## Recommendation

Start the very small, non-commercial private beta with:

1. local Next.js production process managed by a service supervisor;
2. Tailscale Serve if the total group is at most six and installing Tailscale is acceptable, otherwise Funnel with the public endpoint treated as internet-facing;
3. Supabase Managed Free during supervised validation;
4. Brevo Free SMTP using a verified individual sender;
5. automatic encrypted off-machine database dumps; and
6. a measured uptime/power trial before inviting Users.

Budget **$0/month in service subscriptions plus approximately ฿113/month electricity** if the DGX Spark must stay on continuously solely for Deledger. Move Supabase to Pro ($25/month) before promising dependable availability or when manual backup/restore operations become disproportionate. Buy a sending domain later when reliable, recognizable OTP delivery becomes more important than eliminating the roughly annual domain fee.
