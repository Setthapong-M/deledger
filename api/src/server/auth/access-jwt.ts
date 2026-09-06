import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type VerifiedAccessIdentity = {
  email: string;
  subject: string;
  claims: JWTPayload;
};

export type AccessJwtConfig = {
  teamDomain: string;
  audience: string;
};

type Resolver = ReturnType<typeof createRemoteJWKSet>;

const resolvers = new Map<string, Resolver>();

export async function verifyAccessJwt(request: Request, config: AccessJwtConfig): Promise<VerifiedAccessIdentity> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) throw new Error("ACCESS_TOKEN_MISSING");
  const issuer = normalizeTeamDomain(config.teamDomain);
  const jwksUrl = new URL("/cdn-cgi/access/certs", issuer).toString();
  let resolver = getResolver(jwksUrl);
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, resolver, {
      issuer,
      audience: config.audience,
      algorithms: ["RS256"],
    }));
  } catch (error) {
    if (!isUnknownKeyError(error)) throw new Error("ACCESS_TOKEN_INVALID");
    resolvers.delete(jwksUrl);
    resolver = getResolver(jwksUrl);
    try {
      ({ payload } = await jwtVerify(token, resolver, {
        issuer,
        audience: config.audience,
        algorithms: ["RS256"],
      }));
    } catch {
      throw new Error("ACCESS_TOKEN_INVALID");
    }
  }

  if (payload.type !== "app") throw new Error("ACCESS_TOKEN_INVALID");
  if (typeof payload.email !== "string" || payload.email.trim() === "") throw new Error("ACCESS_TOKEN_INVALID");
  if (typeof payload.sub !== "string" || payload.sub.trim() === "") throw new Error("ACCESS_TOKEN_INVALID");
  return { email: payload.email.trim().toLowerCase(), subject: payload.sub, claims: payload };
}

export function resetAccessJwksCache(): void {
  resolvers.clear();
}

function getResolver(url: string): Resolver {
  const existing = resolvers.get(url);
  if (existing) return existing;
  const resolver = createRemoteJWKSet(new URL(url));
  resolvers.set(url, resolver);
  return resolver;
}

function normalizeTeamDomain(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error("ACCESS_TOKEN_INVALID");
  }
  return url.origin;
}

function isUnknownKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ERR_JWKS_NO_MATCHING_KEY";
}
