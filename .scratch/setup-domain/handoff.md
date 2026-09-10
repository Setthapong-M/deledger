# Public QAS cutover

Status: Public domain operational according to the operator on 2026-09-10; PR and merge requested. Detailed external acceptance checks below are not individually confirmed.

Authorized: same host, apex deledgr.online, retain Access JWT/email invitation policy, remove Tunnel only after public acceptance. Operator subsequently authorized source commit, PR creation and merge to main. No data reset performed.

2026-09-10: installed matching Cloudflare Origin RSA certificate/key at /etc/deledger/tls with owner-only permissions (originals retained in ~/.ssh). Do not print keys. API and new proxy deployed using infra/compose.public.yaml. All application services healthy; original Tunnel continues. Proxy binds Ethernet host port 443, accepts Cloudflare IPv4 peers and container-loopback checks only. Private route mutation origin remains supported during transition.

Validation: API integration wrapper passed 177 tests in 20 files; expanded Compose operations file passed 3 tests; typecheck passed; API Docker build passed; Nginx config and scripts/test-public-ingress.mjs passed verified TLS, actual-peer restrictions, forged-header denial, missing/invalid JWT rejection and exact mutation origins. Initial Nginx temp-directory permission issue was fixed by routing all temp directories to writable tmpfs. A smoke fixture with invalid empty profile input was replaced with a valid synthetic body so it reaches authentication. No valid identity was used or created in live data.

Operator completed DNS configuration and reports the public domain now works. Remaining: explicitly confirm Full (Strict), Always Use HTTPS, invited mutation/readiness and uninvited denial externally. Reserve Ethernet address in DHCP. Tunnel remains unchanged as fallback; stop only after acceptance. No Cloudflare API token is available for automatic dynamic DNS, so this remains a follow-up requiring scoped credentials. See docs/operations/deploy-public-qas.md for procedure and rollback.

Rollback API image: deledger-api:before-public-20260910. No database rollback needed.
