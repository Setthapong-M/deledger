# Define MVP authentication and account lifecycle

Type: grilling
Status: resolved
Blocked by:

## Question

What identity and account lifecycle must the private-beta MVP expose around its external identity provider? Decide the permitted sign-in method, whether an invited or self-registering User may enter, which profile settings are user-controlled, how recovery works, and whether account export, archival, restoration, or permanent deletion belongs in MVP. The answer must preserve private per-User ownership without adding an administration product that the first release does not need.

## Answer

Cloudflare Access through the Cloudflare One Client is the MVP's only identity boundary. The operator allowlists exact invited email addresses; Users authenticate with Cloudflare Email OTP. Deledger has no self-registration, password, profile, recovery, or administration UI. Invites, immediate revocation, operator-assisted export, restoration, and verified identity transfer to a new email remain manual operator actions.

Revocation makes the User an Archived User: access and active-month tracking stop, while the User and all private financial records remain preserved indefinitely. The ordinary product lifecycle never permanently deletes them. Restoration always revives the same User and history; the same email cannot create a second User, and a new email requires an explicit identity transfer.

If restoration occurs before the current calendar month ends, the User continues the same Open Month. If archival crosses the Asia/Bangkok calendar boundary, Automatic Close still closes the last Open Month and may produce Needs Information or Inconsistent, but no later Reporting Months are created while the User remains archived. Restoration after that Tracking Gap starts a new Partial Month from the restoration date with a newly supplied Starting Balance and Income since that date; Deledger neither invents gap months nor infers balance continuity across the gap.
