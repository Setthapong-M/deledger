#!/usr/bin/env bash
set -euo pipefail

label="deledger-stack-smoke-$(date +%s)-$$"
api_image="${DELEDGER_SMOKE_API_IMAGE:-deledger-migration-api}"
web_image="${DELEDGER_SMOKE_WEB_IMAGE:-deledger-migration-web}"
migrate_image="${DELEDGER_SMOKE_MIGRATE_IMAGE:-deledger-migration-migrate}"
db_image="${DELEDGER_SMOKE_DB_IMAGE:-deledger_test-postgres-test}"
secret_dir="$(mktemp -d)"
cleanup() {
  result=$?
  if [[ "$result" -ne 0 ]]; then
    for service in postgres api web; do docker logs --tail 15 "${label}-${service}" 2>/dev/null || true; done
  fi
  docker rm -f "${label}-web" "${label}-api" "${label}-postgres" >/dev/null 2>&1 || true
  docker volume rm "${label}-data" >/dev/null 2>&1 || true
  docker network rm "${label}-network" >/dev/null 2>&1 || true
  rm -rf -- "$secret_dir"
}
trap cleanup EXIT
for image in "$api_image" "$web_image" "$migrate_image" "$db_image"; do docker image inspect "$image" >/dev/null; done
printf 'smoke-admin-password' > "$secret_dir/postgres_password"
chmod 600 "$secret_dir/postgres_password"
docker network create --internal "${label}-network" >/dev/null
docker run -d --name "${label}-postgres" --network "${label}-network" --network-alias postgres \
  -v "${label}-data:/var/lib/postgresql" -e POSTGRES_DB=deledger -e POSTGRES_PASSWORD=smoke-admin-password \
  -e DELEDGER_WEB_PASSWORD=smoke-web-password -e DELEDGER_IDENTITY_PASSWORD=smoke-identity-password "$db_image" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec -e PGPASSWORD=smoke-admin-password "${label}-postgres" psql -h 127.0.0.1 -U postgres -d deledger -Atqc 'SELECT 1' >/dev/null 2>&1; then break; fi
  [[ "$attempt" -lt 60 ]] || exit 1
  sleep 1
done
docker run --rm --network "${label}-network" -v "$secret_dir/postgres_password:/run/secrets/postgres_password:ro" \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password "$migrate_image"
docker run -d --name "${label}-api" --network "${label}-network" --network-alias api \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL \
  -e NODE_ENV=production -e DELEDGER_ENV=qas -e HOSTNAME=0.0.0.0 -e PORT=3001 \
  -e APP_ORIGIN=http://deledger.internal -e BUSINESS_TIME_ZONE=Asia/Bangkok -e BACKUP_MODE=disabled \
  -e DATABASE_URL=postgresql://deledger_web:smoke-web-password@postgres:5432/deledger \
  -e IDENTITY_DATABASE_URL=postgresql://deledger_identity:smoke-identity-password@postgres:5432/deledger \
  -e CLOUDFLARE_TEAM_DOMAIN=http://127.0.0.1:3002 -e CLOUDFLARE_ACCESS_AUD=stack-smoke "$api_image" >/dev/null
docker run -d --name "${label}-web" --network "${label}-network" --network-alias web \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL --cap-add NET_BIND_SERVICE \
  -e DELEDGER_ENV=qas -e API_ORIGIN=http://api:3001 -e HOSTNAME=0.0.0.0 -e PORT=80 "$web_image" >/dev/null
for attempt in $(seq 1 60); do
  if docker exec "${label}-web" node -e "fetch('http://127.0.0.1:80/api/health/live').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then break; fi
  [[ "$attempt" -lt 60 ]] || exit 1
  sleep 1
done
docker exec "${label}-api" node api/dist/operator.js invite --email stack-smoke@example.com >/dev/null
docker exec -d -w /app/api "${label}-api" node --input-type=module -e '
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
const {publicKey,privateKey}=await generateKeyPair("RS256");
const key={...await exportJWK(publicKey),kid:"smoke",alg:"RS256",use:"sig"};
const token=await new SignJWT({email:"stack-smoke@example.com",type:"app"}).setProtectedHeader({alg:"RS256",kid:"smoke"}).setIssuer("http://127.0.0.1:3002").setAudience("stack-smoke").setSubject("smoke").setIssuedAt().setExpirationTime("5m").sign(privateKey);
createServer((req,res)=>{res.setHeader("content-type","application/json");res.end(JSON.stringify({keys:[key]}));}).listen(3002,"127.0.0.1",()=>writeFileSync("/tmp/smoke.jwt",token,{mode:0o600}));
'
for attempt in $(seq 1 30); do
  if docker exec "${label}-api" test -s /tmp/smoke.jwt; then break; fi
  [[ "$attempt" -lt 30 ]] || exit 1
  sleep 1
done
docker exec "${label}-api" node --input-type=module -e '
import { readFileSync } from "node:fs";
const base="http://web:80";
const mode=await fetch(`${base}/api/auth/mode`);
if(mode.status!==200||(await mode.json()).data.environment!=="qas") throw Error("QAS mode proxy failed");
if((await fetch(`${base}/api/health/live`)).status!==200) throw Error("liveness proxy failed");
if((await fetch(`${base}/api/bootstrap`)).status!==401) throw Error("unauthenticated boundary failed");
const response=await fetch(`${base}/api/health/ready`,{headers:{"Cf-Access-Jwt-Assertion":readFileSync("/tmp/smoke.jwt","utf8")}});
if(response.status!==200) throw Error(`authenticated readiness failed: ${response.status} ${await response.text()}`);
console.log("Container stack smoke passed: fresh migrations, compiled operator, QAS proxy, JWT, Prisma and scheduler readiness");
'
for service in postgres api web; do
  [[ "$(docker inspect "${label}-${service}" --format '{{json .HostConfig.PortBindings}}')" == '{}' ]] || exit 1
done
