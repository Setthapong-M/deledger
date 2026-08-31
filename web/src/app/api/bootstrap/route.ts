import { handleUserRoute } from "@/server/http/route-handler";
import { readBootstrap } from "@/server/services/bootstrap";

export async function GET(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "GET", operation: ({ client, ownerId }) => readBootstrap(client, ownerId) });
}
