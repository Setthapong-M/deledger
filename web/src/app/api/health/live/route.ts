import { loadConfig } from "@/server/config";

export async function GET(): Promise<Response> {
  try {
    loadConfig();
  } catch {
    return Response.json({ error: { code: "SERVICE_UNAVAILABLE", message: "บริการยังไม่พร้อมใช้งาน", field: null, current: null } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return Response.json({ data: { status: "ok" } }, { headers: { "cache-control": "no-store" } });
}
