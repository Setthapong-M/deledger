import { sessionCookie } from "../../../server/auth/local.js";
import { localLoginSchema } from "../../../server/http/schemas.js";
import { domainFailure, success } from "../../../server/http/envelope.js";
import { localConfigOrFailure, parseJson } from "../../../server/http/route-handler.js";
import { loginLocalWithTransaction } from "../../../server/services/local-auth.js";
import { DomainError } from "../../../server/domain/errors.js";

export async function POST(request: Request): Promise<Response> {
  try {
    localConfigOrFailure(request, "POST");
    const input = await parseJson(request, localLoginSchema);
    const result = await loginLocalWithTransaction(input.identifier);
    const response = success({ authenticated: true });
    response.headers.set("set-cookie", sessionCookie(result.token));
    return response;
  } catch (error) {
    if (error instanceof DomainError) return domainFailure(error);
    return domainFailure(new DomainError("INTERNAL_ERROR", "เกิดข้อผิดพลาดภายในระบบ"));
  }
}
