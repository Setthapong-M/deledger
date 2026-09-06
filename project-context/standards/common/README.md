# Shared engineering standards

Use domain names from [CONTEXT.md](../../../CONTEXT.md). Next owns presentation/proxy; Nest owns authorization and business decisions; Prisma owns persistence. Change boundaries through an explicit decision, not a convenience import across applications.

Use packages/scripts recorded in manifests and lockfile. Verify the installed version's official documentation before adopting an API or upgrading dependencies. Examples from other projects are not standards here: there is no Kotlin/Spring/jOOQ/Flyway, Pages Router/MUI/Hook Form, RabbitMQ, Authentik or company-role filter abstraction.

## Contracts

- Preserve exact money strings and revision strings over HTTP. Missing financial inputs mean unknown, not zero.
- UI capability flags guide presentation; authorization and accounting remain on the backend.
- Validate untrusted inputs, narrow `unknown` errors and retain stable error codes.
- Preserve `undefined` versus `null` in partial updates: omitted fields and explicit clearing are different operations. Follow the owning schema.
- Keep secrets, JWTs, cookies and personal financial data out of Git, fixtures, logs and context notes. Use synthetic test identities.

## Changes and evidence

Keep changes with their affected contracts and regression evidence. Follow strict TypeScript and existing module conventions instead of weakening checks to compile. Avoid unrelated formatting or dependency additions.

Use [testing](../../qa_testing/README.md) for gate selection and [review](../../review/REVIEW_GUIDELINES.md) for completion. Update an accepted requirement in its owning document and consumers together. Historical findings belong in memory or the effort tracker with commit and limitations stated.
