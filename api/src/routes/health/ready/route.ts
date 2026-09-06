import { handleUserRoute } from "../../../server/http/route-handler.js";
import { readReadiness } from "../../../server/services/readiness.js";

export async function GET(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "GET", operation: ({ client }) => readReadiness(client) });
}
