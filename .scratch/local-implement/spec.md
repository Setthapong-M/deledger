# Local development, QAS identity and User profile

Status: implementation complete

Source branch: local-implement

Execution: implement tickets in dependency order with the repository `/implement` flow (TDD followed by Standards/Spec review). This document specifies behavior; it does not authorize deployment or claim implementation is complete.

## Problem Statement

นักพัฒนาต้องผ่าน Cloudflare เพื่อเข้าแอป แม้ต้องการทดลองบนเครื่องตนเอง การทดลอง User หลายคนจึงไม่สะดวก และยังไม่มีหน้า login หรือหน้าข้อมูลส่วนตัวสำหรับจัดการ email เบอร์โทร และวันเกิด ต้องเพิ่ม local development โดยรักษาการเข้าใช้งาน QAS ผ่าน Cloudflare แบบเดิม และเตรียมขอบเขต prod โดยยังไม่เปิดระบบ public

## Solution

ใช้ source เดียว แยก process, configuration, database, credentials, session และ Docker resources ของแต่ละ env

| Env | ทางเข้าและการระบุตัวตน | User ใหม่ | ข้อมูลส่วนตัว |
| --- | --- | --- | --- |
| local | localhost; ช่องเดียว Phone number or email; Continue แล้วสร้าง session โดยไม่ใช้ password/OTP | สร้าง User ทดลองเมื่อ identifier ยังไม่มี | เพิ่ม/เปลี่ยน/ลบ email หรือเบอร์ได้โดยต้องเหลืออย่างน้อยหนึ่งช่องทาง; แก้วันเกิดได้ |
| qas | WARP / Tunnel / Cloudflare Access เดิม; เว็บตรวจ JWT และระบุ User จาก email โดยไม่แสดง login/OTP ของแอปซ้ำ | ผู้ดูแลเชิญด้วย email ที่ตรงกับ Cloudflare เท่านั้น | email/เบอร์อ่านอย่างเดียว; แก้วันเกิดได้ |
| prod | public domain และ app-owned email/phone OTP ในงานต่อยอด | การสมัครยังอยู่นอกขอบเขต | การเปลี่ยนช่องทางต้องยืนยัน OTP ในงานต่อยอด |

QAS bypass เฉพาะ UI login ของแอป ไม่ bypass JWT, invitation, Archived User หรือ RLS. ไม่มีระบบส่ง email/SMS หรือหน้า OTP ที่แสร้งว่าพร้อมใช้งานในรอบนี้

## User Stories

1. As a developer, I want local to start without Cloudflare configuration, so that development does not depend on WARP or external authentication.
2. As a developer, I want local and QAS to run simultaneously, so that experimentation does not interrupt the existing app.
3. As a developer, I want separate databases and credentials, so that local writes never reach QAS data.
4. As a local User, I want one Phone number or email field, so that I do not choose an identifier type manually.
5. As a local User, I want invalid input rejected, so that a typo does not silently create an invalid identity.
6. As a local User, I want email login without a password or OTP, so that I can quickly test the app.
7. As a local User, I want Thai phone login without OTP, so that I can test the same flow using a phone identifier.
8. As a local User, I want domestic and international Thai phone forms to resolve identically, so that formatting does not create a duplicate User.
9. As a local User, I want a new identifier to create an empty User, so that I can follow the existing onboarding flow.
10. As a returning local User, I want the same identifier to reopen my User, so that my financial records remain available.
11. As a local User, I want a session lasting seven days unless I log out, so that I do not re-enter an identifier on every visit.
12. As a local User, I want logout to invalidate my session, so that I can switch Users intentionally.
13. As a User, I want private financial data isolated by User, so that another User cannot read or change it.
14. As an invited QAS User, I want Cloudflare login to take me directly into Deledger, so that I do not authenticate twice.
15. As a QAS operator, I want invalid JWTs, uninvited identities and Archived Users rejected, so that the current access rules remain effective.
16. As a User, I want a personal-information page showing email, phone and date of birth, so that I can inspect my profile.
17. As a User without a phone, I want the profile to show ยังไม่ได้ระบุ, so that absence is explicit.
18. As a local User, I want to add a phone to my email-based User, so that either identifier opens the same financial record.
19. As a local User, I want to add an email to my phone-based User, so that both login directions work.
20. As a local User, I want a contact already assigned to another User rejected, so that adding contacts does not merge financial records.
21. As a local User, I want at least one login contact retained, so that profile edits cannot leave my User unreachable.
22. As a User, I want date of birth to be optional and editable, so that onboarding does not require unnecessary profile data.
23. As a QAS User, I want only date of birth editable in this release, so that contact changes do not break Cloudflare identity mapping.
24. As a developer, I want optional repeatable seed data, so that I can inspect populated states without changing new-User behavior.
25. As an operator, I want prod explicitly unavailable until its authentication exists, so that configuring prod cannot enable passwordless local access.

## Implementation Decisions

### Environment and deployment

- Use a server-owned application environment selector with local, qas and prod vocabulary, separate from Node development/production mode. Missing selector retains QAS behavior for existing deployments; unknown values fail configuration validation. Explicit prod fails startup as unsupported in this release. Never fall back from QAS/prod to local when credentials or authentication are invalid.
- Local web runs directly through the existing Next development command with loopback binding; PostgreSQL remains local Docker PostgreSQL with the existing extensions and migrations. Provide a dedicated local setup/start workflow; do not reuse the disposable test database.
- QAS retains the current private stack and Cloudflare settings. Merely renaming the environment does not redeploy, reset, migrate a live database or alter external Cloudflare policy.
- Local resources must have distinct ports, database credentials, volumes and network names, including explicit names that would defeat Compose project-name isolation. Local config must not require Cloudflare or production backup secrets. Seed/setup commands target a dedicated local database and reject non-local execution.
- This extends the private-beta ADR with a development environment; the ADR's private deployment decision continues to govern QAS. Public prod is a documented future extension, not a change to the current deployment.

### Identity and sessions

- Retain the stable User ID as owner of the Financial Boundary and all financial records. Email and phone are login identifiers, not User IDs. One current email and one current phone per User suffice.
- Keep the existing email identity mapping and operator lifecycle compatible. Add phone identity storage, optional date of birth and persistent local session storage using new forward migrations. Do not rewrite existing migrations or replace existing User IDs. Phone-only local Users must not require a fabricated email.
- A single authentication module selects the local-session adapter or Cloudflare adapter using server config. Both feed the existing User transaction/RLS and lifecycle flow. QAS requires a verified JWT on every protected request and never accepts a local session in its place.
- Local login resolves or creates the User atomically before issuing a session. Concurrent first logins for the same canonical identifier must resolve to one User; failures must not leave orphan Users. An existing Archived User is denied rather than recreated or restored.
- Use an opaque random session token in an HttpOnly, SameSite=Lax, host-only cookie, with a seven-day absolute lifetime from issue (not sliding). Store a token digest and expiry/revocation state server-side. Local HTTP on loopback is supported. Logout revokes the current session and clears the cookie. Expired/revoked/tampered cookies never resolve a User.
- Local login/logout and profile mutations enforce the existing JSON and origin validation conventions. Keep sessions/contacts out of operation logs. Browser-supplied owner IDs, environment overrides and unsigned identity headers cannot select a User.
- A local session binds the stable User ID; editing its email/phone does not move financial records or invalidate the current session. Newly issued sessions resolve only current contacts. Never reuse a removed contact to restore access to its former owner. Retain existing historical email reservation semantics; transferring identifiers between Users is outside scope.
- On local authentication expiry, protected screens return to login and clear stale User data from view. On QAS denial, show the existing access error rather than offering local login. Keep the existing QAS logout behavior; do not add a local logout route that claims to terminate Cloudflare sessions.

### Identifier handling

- The single field accepts email or Thai mobile number, not arbitrary usernames. Trim surrounding whitespace. Normalize email by lowercase using existing conventions; do not strip plus tags or dots. Validate syntax on the server, with matching client feedback.
- Accept Thai mobile numbers in domestic ten-digit 06/08/09 forms and equivalent +66 forms, canonicalized to +66 followed by the nine national digits. Presentation spaces and hyphens may be removed; other unsupported characters, country codes and invalid lengths are rejected. No country selector or SMS delivery in this release.
- An email and an unlinked phone create distinct local Users. To use both for one User, add the second contact while signed into the first. A normalized contact may not belong to two Users. Enforce uniqueness and atomic profile updates in the database, including races.
- Local linking skips proof of possession only in local. It must not mark contacts as OTP-verified or export them as verified credentials for another env. QAS reads identity from its existing invited email regardless of any phone stored in the profile.

### Profile and product behavior

- Provide a personal-information destination from the app navigation, available to an authenticated User even before financial onboarding completes. This is self-service for the current User, not an administrator User-management screen.
- Show email, phone and date of birth, with ยังไม่ได้ระบุ for absent values. The phone may display in canonical form. No additional name/avatar/gender fields or social login are required by the reference image.
- Local permits adding, replacing or removing contacts while retaining at least one. Reject collisions as a field-level conflict with no partial save or record merge. Same-value updates are harmless. QAS rejects contact mutations server-side as well as rendering read-only fields.
- Date of birth is an optional calendar date stored without time/timezone. Use unambiguous day/month/year input presentation, reject impossible and future dates, permit clearing it, and impose no new age gate. The existing Asia/Bangkok business timezone remains unchanged.
- New local Users contain no financial sample records and enter the existing onboarding-required state. Existing ready/resume-required routing, archived lifecycle, Monthly Reconciliation and Reporting Month rules continue unchanged.
- Seed data is opt-in, deterministic and rerunnable without duplicating or overwriting User-entered financial data. Demo Users are separate from Users created through login. Seed does not reset any database and does not run automatically on login/startup.

## Testing Decisions

- Prefer existing HTTP handlers, bootstrap/financial operations and browser journeys as the public test seams. Exercise actual PostgreSQL RLS rather than mocking successful owner checks. Add small pure tests only for identifier/date normalization and validation.
- Extend prior coverage for Cloudflare access, identity transactions, RLS persistence, API contracts, lifecycle forms and browser journeys. Use the existing local JWKS fixture to test QAS; tests must not call live Cloudflare, email/SMS providers or QAS data.
- Verify new/returning local Users, invalid identifiers, phone normalization, email-to-phone and phone-to-email linking, duplicate/racing contacts, concurrent first login, archived denial, cookie expiry/revocation and User switching without stale data.
- Verify two independent Users cannot read/mutate each other's profile or financial data; pooled connections do not leak owner context after success/failure. Use the normal restricted database role.
- Verify the local credential path is rejected on QAS even with a valid local cookie, and missing/expired/wrong-audience JWTs remain denied. Cloudflare-approved-but-uninvited and archived identities remain denied. QAS contact mutation requests are rejected even when crafted outside the UI.
- Exercise profile UI accessibility, validation, save errors, optional dates, read-only QAS contacts and direct navigation while unauthenticated. Test a seeded local profile and an empty new User separately.
- Validate independent local/QAS configuration without starting or modifying the live QAS stack. Verify local setup fails closed on non-local targets. Check build with the existing lint/typecheck and production build commands; run relevant unit, integration, browser and operations tests for implemented slices.

## Out of Scope

- Public DNS, prod hosting/deployment, real OTP delivery/providers, app-owned QAS login or OTP, and changes to Cloudflare policies.
- Prod registration/invitation policy, identifier recovery/transfer, merging Users, social login, passwords and international phone support beyond Thai mobile numbers.
- QAS email/phone self-service editing, administrator profile management and automatic population of existing Users' phone/date of birth.
- Changes to accounting calculations, financial data backfills, live QAS migration, staging unrelated source edits, source commits/PRs or pushes.

## Further Notes

- The user confirmed the discussion and authorized continuing to spec. The latest QAS clarification overrides the earlier suggestion of app-owned OTP on QAS. Likewise the later QAS contact read-only decision overrides the earlier suggestion of real OTP for contact edits in this release.
- The Airbnb screenshot is a reference for a single identifier field and Continue interaction. It is not evidence of Airbnb's infrastructure and does not request a clone, social login or an infrastructure migration.
- A future prod phase must choose OTP providers, verification/recovery/abuse controls, hosting and registration policy before enabling prod. Those choices are deliberately excluded from this release rather than silently assumed.
- Five dependency-ordered implementation tickets accompany this spec. Implementation must preserve pre-existing unrelated working-tree edits; completion of these documents is not completion of the feature.
