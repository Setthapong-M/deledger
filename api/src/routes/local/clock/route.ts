import { z } from "zod";
import { changeLocalDate, withCalendarGate } from "../../../server/domain/local-calendar.js";
import { DomainError } from "../../../server/domain/errors.js";
import { domainFailure, success } from "../../../server/http/envelope.js";
import { handleUserRoute, parseJson, safeConfig } from "../../../server/http/route-handler.js";

const schema = z.object({ date: z.string().nullable(), expectedClockRevision: z.string().min(1), acknowledged: z.literal(true) }).strict();

export async function PATCH(request: Request): Promise<Response> {
  try {
    const config = safeConfig();
    if (config.environment !== "local") return new Response(null, { status: 404 });
    return await withCalendarGate(true, async () => {
      let body: z.infer<typeof schema> | undefined;
      const authenticated = await handleUserRoute(request, {
        method: "PATCH", config, skipCatchUp: true,
        body: request => parseJson(request, schema),
        operation: async (_context, input) => { body = input; return null; },
      });
      if (!authenticated.ok || !body) return authenticated;
      return success(changeLocalDate(body.date, body.expectedClockRevision));
    });
  } catch (error) {
    return domainFailure(error instanceof DomainError ? error : new DomainError("INTERNAL_ERROR", "เกิดข้อผิดพลาดภายในระบบ"));
  }
}
