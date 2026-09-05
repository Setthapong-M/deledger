import { clearedSessionCookie, digestLocalSessionToken, readLocalSessionToken } from "@/server/auth/local";
import { domainFailure, success } from "@/server/http/envelope";
import { localConfigOrFailure } from "@/server/http/route-handler";
import { withClient } from "@/server/db/transaction";
import { DomainError } from "@/server/domain/errors";

export async function POST(request: Request): Promise<Response> {
  try {
    localConfigOrFailure(request, "POST");
    const token = readLocalSessionToken(request);
    if (token) await withClient((client) => client.query("SELECT public.revoke_local_session($1)", [digestLocalSessionToken(token)]));
    const response = success({ authenticated: false });
    response.headers.set("set-cookie", clearedSessionCookie());
    return response;
  } catch (error) {
    if (error instanceof DomainError) return domainFailure(error);
    return domainFailure(new DomainError("INTERNAL_ERROR", "เกิดข้อผิดพลาดภายในระบบ"));
  }
}
