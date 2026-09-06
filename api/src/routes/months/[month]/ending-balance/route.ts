import { handleUserRoute, parseJson } from "../../../../server/http/route-handler.js";
import { endingBalanceSchema, monthStart } from "../../../../server/http/schemas.js";
import { updateEndingBalance } from "../../../../server/services/month-write.js";

export async function PUT(request: Request, { params }: { params: Promise<{ month: string }> }): Promise<Response> {
  const { month } = await params;
  let start: string;
  try { start = monthStart(month); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "เดือนต้องเป็น YYYY-MM", field: "month", current: null } }, { status: 400 }); }
  return handleUserRoute(request, { method: "PUT", body: (value) => parseJson(value, endingBalanceSchema), operation: ({ client, ownerId, requestId }, body) => updateEndingBalance({ client, ownerId, requestId }, { monthStart: start, expectedRevision: body.expectedRevision, endingBalance: body.amount }) });
}
