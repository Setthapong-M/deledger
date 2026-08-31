# Private WARP and Cloudflare Access

The MVP uses a named Tunnel and a private Access application. There is no public hostname, Quick Tunnel, wildcard allow rule, or direct LAN listener.

1. Create a private hostname route for `deledger.internal` to `http://web:80` on the named Tunnel.
2. Create a Cloudflare Access self-hosted application for the exact private hostname.
3. Enable Email OTP and require **Authenticate with Cloudflare One Client**.
4. Add one exact invited email per allow rule. Do not use a whole-domain rule.
5. Add Gateway policy `allow` for the enrolled WARP device and a catch-all `block` after it.
6. Enroll each beta device in WARP Traffic and DNS mode, then verify the private route.
7. Set `CLOUDFLARE_TEAM_DOMAIN` to the Access team origin and `CLOUDFLARE_ACCESS_AUD` to the application audience.
8. Verify an invited User reaches the application, an uninvited User is denied at Access, and an archived User is denied again by the database identity boundary.

Private WARP routes deliberately require the Cloudflare One Client. A public DNS record or clientless route is a scope change and must be reviewed before use.
