import { handleUserRoute, parseJson } from "@/server/http/route-handler";
import { monthStart, updateRecurringSchema, uuid } from "@/server/http/schemas";
import { updateRecurringExpense } from "@/server/services/month-write";

export async function PATCH(request: Request, { params }: { params: Promise<{ month: string; id: string }> }): Promise<Response> {
  const { month, id } = await params;
  let start: string;
  try { start = monthStart(month); uuid.parse(id); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "พารามิเตอร์ไม่ถูกต้อง", field: null, current: null } }, { status: 400 }); }
  return handleUserRoute(request, { method: "PATCH", body: (value) => parseJson(value, updateRecurringSchema), operation: ({ client, ownerId, requestId }, body) => updateRecurringExpense({ client, ownerId, requestId }, { monthStart: start, setupItemId: id, ...body }) });
}
