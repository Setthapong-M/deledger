import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { request } from "node:https";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const caFile = process.env.DELEDGER_ORIGIN_CA_FILE;
assert.ok(caFile, "DELEDGER_ORIGIN_CA_FILE must point to the trusted Cloudflare Origin RSA CA PEM");
const ca = readFileSync(caFile);
const bind = process.env.DELEDGER_HTTPS_BIND ?? "192.168.1.249";

async function probe(hostname, port, path, headers = {}, method = "GET", body) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname, port, servername: "deledgr.online", ca, path, method,
      headers: { host: "deledgr.online", ...headers }, timeout: 10000 }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, text }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("probe timed out")));
    req.end(body);
  });
}

for (const headers of [{}, { "x-forwarded-for": "173.245.48.1", "cf-connecting-ip": "173.245.48.1", "cf-access-jwt-assertion": "forged.jwt.token" }]) {
  assert.equal((await probe(bind, 443, "/api/profile", headers)).status, 403);
}
console.log("PASS: verified TLS and non-Cloudflare peer denial, including spoofed forwarding headers");

const loopbackTest = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { request } from 'node:https';
const ca = readFileSync('/origin-ca.pem');
${probe.toString()}
const live = await probe('127.0.0.1', 8443, '/api/health/live');
assert.equal(live.status, 200);
assert.equal(JSON.parse(live.text).data.status, 'ok');
for (const [token, code] of [['', 'ACCESS_TOKEN_MISSING'], ['forged.jwt.token', 'ACCESS_TOKEN_INVALID']]) {
  const response = await probe('127.0.0.1', 8443, '/api/profile', { 'cf-access-jwt-assertion': token });
  assert.equal(response.status, 401);
  assert.equal(JSON.parse(response.text).error.code, code);
}
for (const origin of ['https://deledgr.online', 'http://deledger.internal']) {
  const response = await probe('127.0.0.1', 8443, '/api/profile', { origin, 'content-type': 'application/json' }, 'PATCH', JSON.stringify({ dateOfBirth: '1990-02-28' }));
  assert.equal(response.status, 401);
}
const denied = await probe('127.0.0.1', 8443, '/api/profile', { origin: 'https://evil.example', 'content-type': 'application/json' }, 'PATCH', '{}');
assert.equal(denied.status, 400);
assert.equal(JSON.parse(denied.text).error.field, 'origin');
console.log('PASS: TLS → Nginx → Next → Nest health, JWT denial and exact mutation origins');
`;
execFileSync("docker", ["run", "--rm", "-i", "--network", "container:deledger-proxy-1", "--read-only", "--cap-drop=ALL", "--user", "1000:1000",
  "--mount", `type=bind,source=${resolve(caFile)},target=/origin-ca.pem,readonly`,
  "node:22.23.1-bookworm-slim", "node", "--input-type=module"], { input: loopbackTest, stdio: ["pipe", "inherit", "inherit"] });
