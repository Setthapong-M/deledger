import { handleUserRoute, parseJson } from "@/server/http/route-handler";
import { detailSchema, monthStart, uuid, revision } from "@/server/http/schemas";
import { cancelExpenseDetail, confirmExpenseDetail } from "@/server/services/month-write";

export async function PUT(request: Request, { params }: { params: Promise<{ month: string; setupItemId: string }> }): Promise<Response> {
  const { month, setupItemId } = await params;
  let start: string;
  try { start = monthStart(month); uuid.parse(setupItemId); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "พารามิเตอร์ไม่ถูกต้อง", field: null, current: null } }, { status: 400 }); }
  return handleUserRoute(request, { method: "PUT", body: (value) => parseJson(value, detailSchema), operation: ({ client, ownerId, requestId }, body) => confirmExpenseDetail({ client, ownerId, requestId }, { monthStart: start, setupItemId, expectedRevision: body.expectedRevision, amount: body.amount, replace: true }) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ month: string; setupItemId: string }> }): Promise<Response> {
  const { month, setupItemId } = await params;
  let start: string;
  try { start = monthStart(month); uuid.parse(setupItemId); } catch { return Response.json({ error: { code: "INVALID_INPUT", message: "พารามิเตอร์ไม่ถูกต้อง", field: null, current: null } }, { status: 400 }); }
  const expectedRevision = new URL(request.url).searchParams.get("expectedRevision");
  if (expectedRevision === null) return Response.json({ error: { code: "REVISION_REQUIRED", message: "ต้องส่ง revision ล่าสุด", field: "expectedRevision", current: null } }, { status: 428 });
  const parsedRevision = revision.safeParse(expectedRevision);
  if (!parsedRevision.success) return Response.json({ error: { code: "INVALID_INPUT", message: "revision ไม่ถูกต้อง", field: "expectedRevision", current: null } }, { status: 400 });
  return handleUserRoute(request, { method: "DELETE", operation: ({ client, ownerId, requestId }) => cancelExpenseDetail({ client, ownerId, requestId }, { monthStart: start, setupItemId, expectedRevision: parsedRevision.data }) });
}
