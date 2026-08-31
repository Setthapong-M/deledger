import type { MonthView } from "../domain/contracts";
import type { DomainError, DomainErrorCode } from "../domain/errors";

export function success<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status, headers: { "cache-control": "no-store" } });
}

export function failure(error: { code: DomainErrorCode; message: string; field?: string | null; current?: MonthView | null }, status: number): Response {
  return Response.json({ error: { code: error.code, message: error.message, field: error.field ?? null, current: error.current ?? null } }, { status, headers: { "cache-control": "no-store" } });
}

export function statusForCode(code: DomainErrorCode): number {
  if (code === "ACCESS_TOKEN_MISSING" || code === "ACCESS_TOKEN_INVALID") return 401;
  if (code === "USER_NOT_INVITED" || code === "USER_ARCHIVED") return 403;
  if (code === "MONTH_NOT_FOUND" || code === "SETUP_ITEM_NOT_FOUND") return 404;
  if (code === "REVISION_CONFLICT" || code === "IDENTITY_CONFLICT") return 409;
  if (code === "MONTH_NOT_OPEN" || code === "MANUAL_CLOSE_NOT_ALLOWED" || code === "SUMMARY_INCOMPLETE" || code === "SUMMARY_INCONSISTENT" || code === "DETAIL_ALREADY_CONFIRMED" || code === "SETUP_ITEM_CONFIRMED") return 422;
  if (code === "REVISION_REQUIRED") return 428;
  if (code === "SERVICE_UNAVAILABLE") return 503;
  return 400;
}

export function domainFailure(error: DomainError): Response {
  return failure(error, statusForCode(error.code));
}
