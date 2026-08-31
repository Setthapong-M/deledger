import { handleUserRoute } from "@/server/http/route-handler";
import { monthQuerySchema } from "@/server/http/schemas";
import { listHistory } from "@/server/services/history";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = monthQuerySchema.safeParse({ before: url.searchParams.get("before") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) return Response.json({ error: { code: "INVALID_INPUT", message: "พารามิเตอร์ไม่ถูกต้อง", field: null, current: null } }, { status: 400 });
  return handleUserRoute(request, { method: "GET", operation: ({ client, ownerId }) => listHistory(client, ownerId, parsed.data) });
}
