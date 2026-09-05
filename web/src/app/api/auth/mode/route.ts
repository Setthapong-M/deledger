import { safeConfig } from "@/server/http/route-handler";
import { success } from "@/server/http/envelope";

export async function GET(): Promise<Response> {
  try {
    return success({ environment: safeConfig().environment });
  } catch {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "บริการยังไม่พร้อมใช้งาน", field: null, current: null } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
