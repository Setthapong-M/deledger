import { handleUserRoute } from '../../../server/http/route-handler.js';
import { readTrackingOptions } from '../../../server/services/tracking.js';

export async function GET(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: 'GET', operation: ({ client, ownerId }) => readTrackingOptions(client, ownerId) });
}
