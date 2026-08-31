const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export function assertIsoDate(value: unknown): asserts value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("date is not a calendar date");
  }
}

export function assertMonthKey(value: unknown): asserts value is string {
  if (typeof value !== "string" || !MONTH_PATTERN.test(value)) {
    throw new Error("month must be YYYY-MM");
  }
}

export function monthStartFromDate(date: string): string {
  assertIsoDate(date);
  return `${date.slice(0, 7)}-01`;
}

export function nextMonthStart(monthStart: string): string {
  assertIsoDate(monthStart);
  const date = new Date(`${monthStart}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function monthKeyFromStart(monthStart: string): string {
  assertIsoDate(monthStart);
  return monthStart.slice(0, 7);
}

export function isFinalDay(monthStart: string, businessDate: string): boolean {
  assertIsoDate(monthStart);
  assertIsoDate(businessDate);
  return nextMonthStart(monthStart) === nextDay(businessDate);
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
