export function formatMoney(value: string | null): string {
  if (value === null) return "—";
  const [whole, fraction = "00"] = value.replace(/^-/, "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = `${grouped}.${fraction.padEnd(2, "0")}`;
  return value.startsWith("-") ? `−${formatted}` : formatted;
}

export function formatMonth(month: string, locale: "th" | "en" = "th"): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function formatDate(date: string | null, locale: "th" | "en" = "th"): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(`${date}T00:00:00+07:00`));
}
