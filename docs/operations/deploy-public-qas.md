# Public QAS domain cutover

The operator authorized `https://deledgr.online` on the existing host, retaining Cloudflare Access and removing Tunnel only after external acceptance. This explicitly replaces the private-only ingress constraint of ADR 0005/0007/0008 for this deployment; the service split, invitation checks, RLS, local isolation and unsupported production mode remain unchanged.

## Topology and configuration

Browser → Cloudflare proxy/Access → router TCP 443 → Nginx TLS → Next → Nest → PostgreSQL.

Use `infra/compose.yaml` together with `infra/compose.public.yaml` for every public-QAS deployment command. The base file alone remains the private-Tunnel configuration. The overlay enables exactly `https://deledgr.online`; during cutover Nest also accepts the original `http://deledger.internal` mutation origin. JWT verification remains mandatory for both. No `www`, wildcard or arbitrary origin is accepted.

Only the proxy publishes a host port. `DELEDGER_HTTPS_BIND` defaults to `192.168.1.249`; reserve this Ethernet address in router DHCP before relying on unattended operation. Nginx only joins `edge`, uses a read-only filesystem, no Linux capabilities, and a pinned image digest. Certificates are mounted read-only from `DELEDGER_TLS_DIR` (default `/etc/deledger/tls`), outside Git. Directory mode is 700 and both PEM files mode 600; their owner must match `DELEDGER_TLS_UID/GID` (default 1000/1000).

Nginx checks the actual TCP peer against `infra/nginx/cloudflare-allow.conf`, not client-supplied forwarding headers. The IPv4 ranges come from https://www.cloudflare.com/ips-v4 (retrieved 2026-09-10); review changes periodically. Container loopback is permitted for internal verification only. The host publishes IPv4 only. Unknown TLS hostnames are rejected. Access logs are disabled to avoid retaining query strings or identities. Nest still verifies JWT issuer, audience, signature and invited active identity even for requests from a Cloudflare address.

## Prepare and verify

1. Validate certificate hostname, expiration and key match before installation. The certificate must cover `deledgr.online`. Use the Cloudflare Origin RSA CA from https://developers.cloudflare.com/ssl/static/origin_ca_rsa_root.pem for verification; browsers do not directly trust an Origin CA certificate. See https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/.
2. Retain the running API image under a rollback tag before building. Do not reset, migrate or replace the database volume for this ingress-only change.
3. Validate configuration and build API:

   ```sh
   docker compose --env-file /etc/deledger/runtime.env -f infra/compose.yaml -f infra/compose.public.yaml config --quiet
   docker compose --env-file /etc/deledger/runtime.env -f infra/compose.yaml -f infra/compose.public.yaml build api
   docker compose --env-file /etc/deledger/runtime.env -f infra/compose.yaml -f infra/compose.public.yaml up -d --no-deps api proxy
   ```

4. Confirm health, verified TLS handshake, HTTP 403 for a non-Cloudflare peer (including forged forwarding headers), and HTTP 401 for missing/forged Access JWTs through the TLS proxy from its loopback. Verify a signed invited identity and mutation origin handling with the isolated QAS HTTP integration suite, never synthetic invitations in the live database.
   Run `DELEDGER_ORIGIN_CA_FILE=/path/to/origin-ca.pem node scripts/test-public-ingress.mjs` on the host. This uses a temporary Node container sharing only the proxy network namespace to probe loopback TLS; it supplies no valid user token and performs no financial writes. The CA PEM must be readable by UID 1000 and must come from the official Cloudflare URL above. A host-side probe verifies denial and does not bypass the peer restriction.
5. `scripts/verify-release.sh` is still the base/private-stack release gate; it does not certify this overlay or a completed public cutover. Public acceptance additionally requires all checks below.

## External acceptance (operator dashboard steps)

1. Add the apex public hostname to the existing Access application, keeping the exact invited-email policy and Email OTP. Verify denial for an uninvited account and success for an invited account without requiring the old Tunnel. Do not add Bypass/Everyone rules. Preserve private destination until acceptance.
2. Set zone SSL/TLS to Full (Strict) and enable Always Use HTTPS at Cloudflare. Do not publish host port 80. Check the edge certificate is active.
3. Replace both old apex A records with a single proxied A record for the host's current public IPv4. Confirm it against router WAN IPv4 at cutover; previously observed addresses are not fixed. Keep other DNS records intact; `www` is not an accepted QAS hostname and must not be treated as a second entry point.
4. Enable only router TCP 443 → reserved Ethernet address TCP 443. Test from outside the LAN: Access login, invited-user data, a mutation, authenticated readiness and uninvited denial. A live process or healthy container alone is not external acceptance.
5. Only after acceptance, stop `cloudflared` with Compose. The base Compose file still defines the service, so subsequent unrestricted `up -d` starts it again. Deploy named services `api web proxy` to leave it stopped. Keep the token in operator custody for rollback until retiring the fallback is explicitly completed.

Public IPv4 has already changed during setup. Automated DNS updates require a separately provided scoped Cloudflare token (Zone DNS Edit for this zone only); none has been supplied. Until automation is installed, check and update the single A record manually after WAN changes. Do not claim unattended availability without this and DHCP reservation.

## Rollback

Disable the router rule; start the existing Tunnel and use `http://deledger.internal`. The new API retains that origin. If the API image itself must be rolled back, restore the saved pre-cutover image tag as `deledger-api` and recreate only API with the base Compose file and `--no-deps --no-build`. Stop the proxy. No database operation is needed. The existing disabled-backup policy still applies.
