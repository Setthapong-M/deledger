import { safeConfig } from "../../../server/http/route-handler.js";
import { success } from "../../../server/http/envelope.js";

export async function GET(): Promise<Response> {
  try {
    return success({ environment: safeConfig().environment });
  } catch {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "บริการยังไม่พร้อมใช้งาน", field: null, current: null } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
