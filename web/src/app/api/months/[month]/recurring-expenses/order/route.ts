import { handleUserRoute, parseJson } from "@/server/http/route-handler";
import { monthStart, reorderSchema } from "@/server/http/schemas";
import { reorderRecurringExpenses } from "@/server/services/month-write";

export async function PUT(request: Request, { params }: { params: Promise<{ month: string }> }): Promise<Response> {
  const { month } = await params;
  let start: string;
  try { start = monthStart(month); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "เดือนต้องเป็น YYYY-MM", field: "month", current: null } }, { status: 400 }); }
  return handleUserRoute(request, { method: "PUT", body: (value) => parseJson(value, reorderSchema), operation: ({ client, ownerId, requestId }, body) => reorderRecurringExpenses({ client, ownerId, requestId }, { monthStart: start, expectedRevision: body.expectedRevision, setupItemIds: body.orderedIds }) });
}
