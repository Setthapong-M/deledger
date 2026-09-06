import { clearedSessionCookie, revokeLocalSession, readLocalSessionToken } from "../../../server/auth/local.js";
import { domainFailure, success } from "../../../server/http/envelope.js";
import { localConfigOrFailure } from "../../../server/http/route-handler.js";
import { withClient } from "../../../server/db/transaction.js";
import { DomainError } from "../../../server/domain/errors.js";

export async function POST(request: Request): Promise<Response> {
  try {
    localConfigOrFailure(request, "POST");
    const token = readLocalSessionToken(request);
    if (token) await withClient((client) => revokeLocalSession(client, token));
    const response = success({ authenticated: false });
    response.headers.set("set-cookie", clearedSessionCookie());
    return response;
  } catch (error) {
    if (error instanceof DomainError) return domainFailure(error);
    return domainFailure(new DomainError("INTERNAL_ERROR", "เกิดข้อผิดพลาดภายในระบบ"));
  }
}
