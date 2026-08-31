import { randomUUID } from "node:crypto";
import { loadConfig, type AppConfig } from "../config";
import { DomainError } from "../domain/errors";
import { logOperation } from "../logging";
import { withUserTransaction, type UserTransaction } from "../db/transaction";
import { domainFailure, failure, success } from "./envelope";

export type RouteContext = { requestId: string; config: AppConfig };

export async function handleUserRoute<T>(request: Request, options: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  config?: AppConfig;
  body?: (request: Request) => Promise<T>;
  operation: (context: Parameters<UserTransaction<unknown>>[0], body: T, route: RouteContext) => Promise<unknown>;
}): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  try {
    const config = options.config ?? safeConfig();
    if (options.method !== "GET" && options.method !== "DELETE") {
      if (!isJsonRequest(request)) return failure({ code: "INVALID_INPUT", message: "ต้องส่งข้อมูล JSON", field: null, current: null }, 400);
      if (request.headers.get("origin") !== config.APP_ORIGIN) return failure({ code: "INVALID_INPUT", message: "แหล่งที่มาของคำขอไม่ถูกต้อง", field: "origin", current: null }, 400);
    }
    if (options.method === "DELETE" && request.headers.get("origin") !== config.APP_ORIGIN) return failure({ code: "INVALID_INPUT", message: "แหล่งที่มาของคำขอไม่ถูกต้อง", field: "origin", current: null }, 400);
    const body = options.body ? await options.body(request) : undefined as T;
    const data = await withUserTransaction(request, requestId, { teamDomain: config.CLOUDFLARE_TEAM_DOMAIN, audience: config.CLOUDFLARE_ACCESS_AUD }, (context) => options.operation(context, body, { requestId, config }));
    return success(data);
  } catch (error) {
    if (error instanceof DomainError) return domainFailure(error);
    const code = error instanceof Error && error.message === "REVISION_REQUIRED" ? "REVISION_REQUIRED" : "INTERNAL_ERROR";
    logOperation({ requestId, operation: "route", latencyMs: 0, resultCode: code });
    return failure({ code, message: code === "REVISION_REQUIRED" ? "ต้องส่ง revision ล่าสุด" : "เกิดข้อผิดพลาดภายในระบบ", field: null, current: null }, code === "REVISION_REQUIRED" ? 428 : 500);
  }
}

export async function parseJson<T>(request: Request, schema: { parse: (value: unknown) => T }): Promise<T> {
  try {
    return schema.parse(await request.json());
  } catch {
    throw new DomainError("INVALID_INPUT", "รูปแบบข้อมูลไม่ถูกต้อง");
  }
}

export function safeConfig(): AppConfig {
  try {
    return loadConfig();
  } catch {
    throw new DomainError("SERVICE_UNAVAILABLE", "บริการยังไม่พร้อมใช้งาน");
  }
}

function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase() === "application/json";
}
