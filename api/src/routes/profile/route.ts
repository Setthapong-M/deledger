import { handleUserRoute, parseJson } from "../../server/http/route-handler.js";
import { profileSchema } from "../../server/http/profile-schema.js";
import { readProfile, updateProfile } from "../../server/services/profile.js";

export async function GET(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "GET", operation: ({ client, ownerId }) => readProfile(client, ownerId) });
}

export async function PATCH(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "PATCH", body: (value) => parseJson(value, profileSchema), operation: ({ client, ownerId }, body, route) => updateProfile(client, ownerId, body, route.config.environment === "local") });
}
