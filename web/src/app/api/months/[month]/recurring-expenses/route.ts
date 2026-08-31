import { handleUserRoute, parseJson } from "@/server/http/route-handler";
import { addRecurringSchema, monthStart } from "@/server/http/schemas";
import { addRecurringExpense } from "@/server/services/month-write";

export async function POST(request: Request, { params }: { params: Promise<{ month: string }> }): Promise<Response> {
  const { month } = await params;
  let start: string;
  try { start = monthStart(month); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "เดือนต้องเป็น YYYY-MM", field: "month", current: null } }, { status: 400 }); }
  return handleUserRoute(request, { method: "POST", body: (value) => parseJson(value, addRecurringSchema), operation: ({ client, ownerId, requestId }, body) => addRecurringExpense({ client, ownerId, requestId }, { monthStart: start, expectedRevision: body.expectedRevision, name: body.name, kind: body.kind, fixedAmount: body.fixedAmount }) });
}
