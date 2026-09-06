# Stack migration evidence

Observed 2026-09-06 at migration commit `55e4daa` and release/cutover follow-up `cbb22c5`.

Presentation moved to Next, auth/business to Nest and persistence/history to Prisma. The user authorized discarding old data/resetting local and QAS after target verification. That authorization covered this cutover, not future resets.

- [Decision map](../../.scratch/stack-migration/map.md)
- [Specification](../../.scratch/stack-migration/spec.md)
- [Review](../../.scratch/stack-migration/review.md)
- [Validation/cutover](../../.scratch/stack-migration/validation.md)
- [ADR 0008](../../docs/adr/0008-split-presentation-and-business-services.md)

The release exposed inherited QAS environment in E2E and API image permissions/source maps. The E2E wrapper isolates Cloudflare variables; the final API image separates build/runtime and excludes dependency maps. See [known issues](../troubleshooting/known-issues.md).

Real User WARP/Access sign-in was not performed at cutover; signed authentication passed integration/container tests. Old results and health checks do not establish current readiness. Verify runtime/PR head/CI whenever reporting live status.
