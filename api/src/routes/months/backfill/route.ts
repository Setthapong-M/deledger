import { handleUserRoute, parseJson } from '../../../server/http/route-handler.js';
import { backfillSchema } from '../../../server/http/schemas.js';
import { backfillMonths } from '../../../server/services/tracking.js';

export async function POST(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: 'POST', body: value => parseJson(value, backfillSchema), operation: (context, body) => backfillMonths(context, body) });
}
