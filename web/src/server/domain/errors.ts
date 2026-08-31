import type { MonthView } from "./contracts";

export type DomainErrorCode =
  | "INVALID_INPUT"
  | "ACCESS_TOKEN_MISSING"
  | "ACCESS_TOKEN_INVALID"
  | "USER_NOT_INVITED"
  | "USER_ARCHIVED"
  | "MONTH_NOT_FOUND"
  | "SETUP_ITEM_NOT_FOUND"
  | "REVISION_CONFLICT"
  | "IDENTITY_CONFLICT"
  | "MONTH_NOT_OPEN"
  | "MANUAL_CLOSE_NOT_ALLOWED"
  | "SUMMARY_INCOMPLETE"
  | "SUMMARY_INCONSISTENT"
  | "DETAIL_ALREADY_CONFIRMED"
  | "SETUP_ITEM_CONFIRMED"
  | "REVISION_REQUIRED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly field: string | null;
  readonly current: MonthView | null;

  constructor(code: DomainErrorCode, message: string, field: string | null = null, current: MonthView | null = null) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.field = field;
    this.current = current;
  }
}
