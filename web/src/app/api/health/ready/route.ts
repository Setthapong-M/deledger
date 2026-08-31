import { handleUserRoute } from "@/server/http/route-handler";
import { readReadiness } from "@/server/services/readiness";

export async function GET(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "GET", operation: ({ client }) => readReadiness(client) });
}
