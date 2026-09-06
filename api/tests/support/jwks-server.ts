import { createServer, type Server } from "node:http";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";

type KeyPair = { kid: string; privateKey: CryptoKey; jwk: JWK };

export type JwksTestServer = {
  url: string;
  addKey: (kid: string) => Promise<void>;
  sign: (kid: string, claims?: Record<string, unknown>) => Promise<string>;
  requestCount: () => number;
  close: () => Promise<void>;
};

export async function createJwksTestServer(): Promise<JwksTestServer> {
  const keys = new Map<string, KeyPair>();
  let requests = 0;
  const server: Server = createServer((request, response) => {
    requests += 1;
    if (request.url !== "/cdn-cgi/access/certs") {
      response.writeHead(404).end();
      return;
    }
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ keys: [...keys.values()].map(({ jwk }) => jwk) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test JWKS server did not bind");
  const url = `http://127.0.0.1:${address.port}`;
  const addKey = async (kid: string): Promise<void> => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    Object.assign(jwk, { kid, alg: "RS256", use: "sig" });
    keys.set(kid, { kid, privateKey, jwk });
  };
  const sign = async (kid: string, claims: Record<string, unknown> = {}): Promise<string> => {
    const key = keys.get(kid);
    if (!key) throw new Error(`missing test key: ${kid}`);
    const now = Math.floor(Date.now() / 1000);
    const issuer = typeof claims.iss === "string" ? claims.iss : url;
    const audience = typeof claims.aud === "string" || Array.isArray(claims.aud) ? claims.aud as string | string[] : "deledger-test-audience";
    const expiration = typeof claims.exp === "number" ? claims.exp : now + 300;
    const notBefore = typeof claims.nbf === "number" ? claims.nbf : undefined;
    const token = new SignJWT({ email: " User@Example.com ", type: "app", ...claims })
      .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject("subject-1")
      .setIssuedAt(now)
      .setExpirationTime(expiration);
    if (notBefore !== undefined) token.setNotBefore(notBefore);
    return token.sign(key.privateKey);
  };
  return {
    url,
    addKey,
    sign,
    requestCount: () => requests,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
