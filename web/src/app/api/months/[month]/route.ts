import { handleUserRoute } from "@/server/http/route-handler";
import { monthStart } from "@/server/http/schemas";
import { readMonth } from "@/server/services/history";

export async function GET(request: Request, { params }: { params: Promise<{ month: string }> }): Promise<Response> {
  const { month } = await params;
  let start: string;
  try { start = monthStart(month); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "เดือนต้องเป็น YYYY-MM", field: "month", current: null } }, { status: 400 }); }
  return handleUserRoute(request, { method: "GET", operation: ({ client, ownerId }) => readMonth(client, ownerId, start) });
}
