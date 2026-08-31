# Phone-number sign-in for the Deledger private-beta MVP

Researched: 2026-08-31
Scope: current official Supabase, Twilio, and NIST sources. Prices are in **USD as displayed on 2026-08-31**, before tax, foreign-exchange costs, retries, and any carrier or registration charges.

## Recommendation

Phone OTP is technically feasible, but keep **Email OTP as the only sign-in method for the first private beta** unless beta users have a demonstrated preference or access need for mobile numbers. Phone login does not add a Supabase Auth surcharge, but it adds per-attempt SMS cost, Thai sender-registration and deliverability work, SMS-pumping exposure, and a recovery problem when a User loses or changes their number. Email is also not free in production—Supabase requires custom SMTP—but its invite and recovery path is simpler for this invite-only MVP.

If phone sign-in is required, use **Twilio Verify**, not bare Programmable Messaging, for the beta despite its higher unit cost. Limit destinations to `+66`, pre-provision an allowlist, pass `shouldCreateUser: false`, enable CAPTCHA, tighten rate limits, retain Twilio Verify Fraud Guard, collect a verified recovery email, and test delivery on AIS, True, and dtac before launch. Keep the OTP message short and free of URLs.

## Feasibility and Supabase configuration

Supabase Auth supports passwordless phone login: enable Phone Auth, connect an external SMS provider, call `signInWithOtp({ phone })`, then verify the six-digit code with `verifyOtp()`. Hosted Supabase documents MessageBird, Twilio, Vonage, and community-supported TextLocal; its configuration also recognizes separate `twilio` and `twilio_verify` providers. Twilio requires an Account SID, Auth Token, and Messaging/Verify Service SID ([Supabase Phone Login](https://supabase.com/docs/guides/auth/phone-login), [Supabase CLI SMS configuration](https://supabase.com/docs/guides/local-development/cli/config)). Normalize Thai input to E.164 (`+66…`) before lookup or submission.

This needs a custom private-beta admission path. `signInWithOtp()` creates a User by default, while Supabase's built-in invitation API is email-only. Deledger must therefore provision/allowlist phone numbers server-side and set `shouldCreateUser: false` on public OTP requests; do not expose the secret-key admin client to the browser ([Supabase `signInWithOtp`](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [`inviteUserByEmail`](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [admin `createUser`](https://supabase.com/docs/reference/javascript/auth-admin-createuser)). The first real OTP—not `phone_confirm: true` by itself—should prove possession of the number.

## Cost compared with Email OTP

| Cost item | Phone OTP | Email OTP |
|---|---:|---:|
| Supabase Auth | Normal MAU pricing: Free includes 50,000 MAU; Pro/Team includes 100,000, then $0.00325/MAU | Same |
| Delivery provider | Required, charged per SMS attempt/segment | Custom SMTP required for production; price depends on selected provider |
| Supabase Phone MFA add-on | **Not applicable** to phone as primary sign-in | Not applicable |

Supabase counts a distinct User who signs in or refreshes a token once per billing cycle, regardless of authentication method or repeat logins ([Supabase MAU billing](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users)). The separate Advanced MFA Phone charge—$0.1027/hour, approximately $75/month for the first project, plus message fees—applies when phone is enabled as a **second factor**, not to primary Phone OTP login ([Supabase Advanced MFA Phone billing](https://supabase.com/docs/guides/platform/manage-your-usage/advanced-mfa-phone)).

Supabase's built-in email sender is not a production alternative: it sends only to project-team addresses, is limited to two messages per hour, has no delivery SLA, and is explicitly best-effort/non-production. A private beta with external Users therefore also needs a custom SMTP provider ([Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)). The meaningful cost difference is that phone incurs a destination-priced telecom charge on every send attempt and adds Thai carrier compliance.

### Twilio cost to Thailand

- **Programmable Messaging (`twilio`):** $0.0305 per outbound SMS segment to Thailand from an international number or Alphanumeric Sender ID. A message ending in `Failed` status also has a $0.001 processing fee. Twilio lists Alphanumeric Sender IDs as free and international-number rental starting at $1.15/month, but sender registration and other charges may still apply. Optional Programmable Messaging SMS Pumping Protection is $0.025 per outbound message in Thailand ([Twilio Thailand SMS pricing](https://www.twilio.com/en-us/sms/pricing/th)).
- **Twilio Verify (`twilio_verify`):** $0.05 per successful verification **plus** the standard channel fee. Applying the official Thailand SMS rate gives an estimated minimum of **$0.0805 for one successful verification using one one-segment SMS**. An abandoned or unsuccessful verification still incurs the SMS-attempt fee; retries add another channel fee. Verify has no pay-as-you-go monthly minimum ([Twilio Verify pricing](https://www.twilio.com/en-us/verify/pricing), [Twilio Verify product FAQ](https://www.twilio.com/en-us/user-authentication-identity/verify)).

Illustrative delivery budget, assuming one successful one-segment verification each and no retries, carrier additions, or tax:

| Successful logins | Programmable SMS | Twilio Verify |
|---:|---:|---:|
| 100 | $3.05 | $8.05 |
| 1,000 | $30.50 | $80.50 |
| 10,000 | $305.00 | $805.00 |

These are estimates, not all-in quotes. Twilio states that prices can change, carrier fees may apply, and billing is per segment. Non-GSM text such as Thai script can use UCS-2 and reduce one segment to 70 characters, so a short ASCII OTP template is the most predictable choice ([Twilio SMS character limits](https://www.twilio.com/docs/glossary/what-sms-character-limit)). Persistent Supabase sessions reduce sends because an OTP is needed on a new sign-in, not on every app visit; sessions last indefinitely by default unless the project configures a timeout ([Supabase sessions](https://supabase.com/docs/guides/auth/sessions)).

## Thailand-specific delivery and compliance caveats

Twilio's current Thailand guidance says:

- Sender ID registration is required, with complete blocking of unregistered Sender IDs effective since 2025-10-06; Alphanumeric Sender ID provisioning is listed at about two weeks.
- AIS offers subscribers a setting that blocks SMS from non-Thai numbers, so international-number delivery cannot be assumed.
- SMS containing a URL requires the full URL to be registered/allowlisted with the Sender ID; shortened URLs are prohibited. Deledger's OTP should contain no URL.
- Messages are billed per segment, and carrier filtering or a blocked/failed delivery can still create provider cost.

See [Twilio's Thailand SMS guidelines](https://www.twilio.com/en-us/guidelines/th/sms). Twilio Verify includes a managed sender pool and compliance/routing features, but that is not a guarantee of conversion on every Thai carrier. Confirm the intended sender behavior with Twilio and run real-device tests across AIS, True, and dtac before treating Phone OTP as the only entrance to financial data.

## Abuse, delivery, recovery, and security controls

Supabase's current default is 30 `/otp` requests per hour project-wide, with a 60-second cooldown for the same User; `/verify` is limited to 360 requests per hour per IP with a token-bucket burst capacity of 30. These controls are not a spending cap. Supabase explicitly recommends tuning Auth rate limits and enabling hCaptcha or Cloudflare Turnstile for phone login ([Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits), [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)). For this beta, also reject non-`+66` destinations server-side and monitor both Supabase Auth and Twilio logs/cost alerts.

Twilio Verify adds five attempts per verification session, a default ten-minute token lifetime, geographic controls, and Fraud Guard, which is on by default for SMS. Fraud Guard can block legitimate traffic, so monitor its decisions; provider-side protection is not a substitute for CAPTCHA and app-side limits ([Twilio Verify limits](https://www.twilio.com/docs/verify/api/rate-limits-and-timeouts), [Twilio Verify Fraud Guard](https://www.twilio.com/docs/verify/preventing-toll-fraud/sms-fraud-guard)). Bare Programmable Messaging is cheaper but requires separately enabling its paid SMS Pumping Protection in Thailand and leaves more verification behavior to Supabase.

Phone-only recovery is the larger product risk. Supabase can verify a new number when an already signed-in User calls `updateUser()`, but that does not help after the User has lost the old SIM and the session ([Supabase phone-number update](https://supabase.com/docs/guides/auth/phone-login#updating-a-phone-number)). Twilio recommends registering at least one additional authentication channel at signup for recovery ([Twilio verification best practices](https://www.twilio.com/docs/verify/developer-best-practices)). NIST classifies PSTN-delivered secrets as a restricted authenticator and specifically calls out SIM changes, number porting, limited coverage, and the need for an alternative authenticator ([NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/#authentication-using-the-public-switched-telephone-network)).

Therefore Phone OTP should not be Deledger's sole durable recovery credential. A verified email fallback keeps both the invite-only lifecycle and lost-number recovery tractable; without it, the MVP needs a manual identity-proofing/support process before Phone OTP can safely replace Email OTP.
