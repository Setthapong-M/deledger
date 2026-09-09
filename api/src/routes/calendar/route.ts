import { handleUserRoute } from "../../server/http/route-handler.js";
import { readCalendarContext } from "../../server/domain/local-calendar.js";

export async function GET(request: Request): Promise<Response> {
  return handleUserRoute(request, { method: "GET", skipCatchUp: true, operation: async (_context, _body, { config }) => readCalendarContext(config.environment === "local") });
}
