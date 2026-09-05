import { sessionCookie } from "@/server/auth/local";
import { localLoginSchema } from "@/server/http/schemas";
import { domainFailure, success } from "@/server/http/envelope";
import { localConfigOrFailure, parseJson } from "@/server/http/route-handler";
import { withClient } from "@/server/db/transaction";
import { loginLocal } from "@/server/services/local-auth";
import { DomainError } from "@/server/domain/errors";

export async function POST(request: Request): Promise<Response> {
  try {
    localConfigOrFailure(request, "POST");
    const input = await parseJson(request, localLoginSchema);
    const result = await withClient((client) => loginLocal(client, input.identifier));
    const response = success({ authenticated: true });
    response.headers.set("set-cookie", sessionCookie(result.token));
    return response;
  } catch (error) {
    if (error instanceof DomainError) return domainFailure(error);
    return domainFailure(new DomainError("INTERNAL_ERROR", "เกิดข้อผิดพลาดภายในระบบ"));
  }
}
