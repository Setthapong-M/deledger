import { handleUserRoute, parseJson } from "@/server/http/route-handler";
import { monthStart, snapshotSchema } from "@/server/http/schemas";
import { recordSnapshot } from "@/server/services/month-write";

export async function POST(request: Request, { params }: { params: Promise<{ month: string }> }): Promise<Response> {
  const { month } = await params;
  let start: string;
  try { start = monthStart(month); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "เดือนต้องเป็น YYYY-MM", field: "month", current: null } }, { status: 400 }); }
  return handleUserRoute(request, { method: "POST", body: (value) => parseJson(value, snapshotSchema), operation: ({ client, ownerId, requestId }, body) => recordSnapshot({ client, ownerId, requestId }, { monthStart: start, expectedRevision: body.expectedRevision, observedOn: body.observedOn, amount: body.amount }) });
}
