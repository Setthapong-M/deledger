export type Locale = "th" | "en";

export const localeCookie = "deledger_locale";

export function resolveLocale(value: unknown): Locale {
  return value === "en" ? "en" : "th";
}
