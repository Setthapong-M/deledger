# Settle Next-to-Nest routing and authentication boundaries

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 01, 02

## Question

How will the existing browser origin and API paths reach NestJS while preserving local sessions, Cloudflare Access JWT/invitation checks, WARP/Tunnel ingress, read-only QAS identity/profile fields, and fail-closed prod behavior? Decide internal API exposure, SSR calls, cookie and CSRF/origin handling, identity-header trust and health endpoints. Nest must own authentication rather than trust a User ID sent by Next. Resolve with the user after fact-finding; record a new ADR superseding only the single-Next topology parts of ADR 0005/0007 and retaining their environment/security boundaries.

## Answer

Keep one browser origin and unchanged /api URLs. Next is a presentation server with a streaming same-origin proxy to an internal Nest listener, no database credentials or identity decisions. Nest independently verifies the original Cloudflare Access assertion or local opaque session cookie, validates Origin/content type, and returns existing envelopes/cookies/status codes. No caller-supplied User id is trusted. Local web/API/database are loopback-only and isolated from QAS; QAS API has no host port and stays on internal app/data networks behind existing Access/WARP/Tunnel. Prod fails closed. Preserve security headers in Next. Configuration and readiness belong to Nest. Use stable Prisma 7.10.0, matching Nest 12.0.1, existing Node 22.23.1/Next/TS pins, subject to build verification.

## Comments

Resolved under explicit user delegation to the agent on 2026-09-06.
