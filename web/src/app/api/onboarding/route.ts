import { lifecycleSchema } from "@/server/http/schemas";
import { handleUserRoute, parseJson } from "@/server/http/route-handler";
import { startOnboarding } from "@/server/services/lifecycle";

export async function POST(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "POST", body: (value) => parseJson(value, lifecycleSchema), operation: ({ client, ownerId }, body) => startOnboarding(client, ownerId, body) });
}
