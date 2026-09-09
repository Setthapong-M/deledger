import { handleUserRoute, parseJson } from '../../../../server/http/route-handler.js';
import { monthStart, restartSchema } from '../../../../server/http/schemas.js';
import { failure } from '../../../../server/http/envelope.js';
import { restartTracking } from '../../../../server/services/tracking.js';

export async function POST(request: Request, { params }: { params: Promise<{ month: string }> }): Promise<Response> {
  const { month } = await params;
  let start: string;
  try { start = monthStart(month); } catch { return failure({ code: 'INVALID_INPUT', message: 'เดือนต้องเป็น YYYY-MM', field: 'month', current: null }, 400); }
  return handleUserRoute(request, { method: 'POST', body: value => parseJson(value, restartSchema), operation: (context, body) => restartTracking(context, { ...body, monthStart: start }) });
}
