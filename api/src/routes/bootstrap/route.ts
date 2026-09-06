import { handleUserRoute } from "../../server/http/route-handler.js";
import { readBootstrap } from "../../server/services/bootstrap.js";

export async function GET(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "GET", operation: ({ client, ownerId }) => readBootstrap(client, ownerId) });
}
