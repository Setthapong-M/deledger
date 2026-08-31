import type { Money } from "./contracts";

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/;

export function parseMoney(value: unknown): Money {
  if (typeof value !== "string" || !MONEY_PATTERN.test(value)) {
    throw new Error("money must be a non-negative decimal string with at most two decimals");
  }
  const [whole, fraction = ""] = value.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  return `${normalizedWhole}.${fraction.padEnd(2, "0")}`;
}

export function isMoney(value: unknown): value is Money {
  try {
    parseMoney(value);
    return true;
  } catch {
    return false;
  }
}
