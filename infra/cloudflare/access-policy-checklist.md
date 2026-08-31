# Cloudflare Access checklist

- [ ] Named Tunnel serves private `deledger.internal` to `http://web:80`.
- [ ] Access application is private and has Email OTP enabled.
- [ ] **Authenticate with Cloudflare One Client** is required.
- [ ] Allow policy lists each invited email exactly; no wildcard domain.
- [ ] Gateway allows enrolled WARP devices, followed by a catch-all block.
- [ ] WARP Traffic and DNS mode is enrolled on every beta device.
- [ ] Access audience and team domain match the application environment.
- [ ] Direct LAN and host access have no listener; no public DNS or Quick Tunnel exists.
- [ ] Invited User succeeds, uninvited User is denied at Access, and archived User is denied by the app/database boundary.
