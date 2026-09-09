import { onboardingSchema } from "../../server/http/schemas.js";
import { handleUserRoute, parseJson } from "../../server/http/route-handler.js";
import { startOnboarding } from "../../server/services/lifecycle.js";

export async function POST(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "POST", body: (value) => parseJson(value, onboardingSchema), operation: ({ client, ownerId }, body) => startOnboarding(client, ownerId, body) });
}
