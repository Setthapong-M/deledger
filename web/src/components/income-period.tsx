"use client";

import { useCalendar } from "@/lib/calendar";
import type { MonthView } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { monthEnd } from "./tracking-form";

const copy = {
  income: { th: "รายรับ", en: "Income" },
  period: { th: "รายรับตั้งแต่ {from} ถึง {to}", en: "Income from {from} through {to}" },
  supplied: { th: "ยอดตั้งต้นที่ระบุเอง", en: "Supplied starting balance" },
  suppliedHint: { th: "ยอดก่อนหน้านี้ไม่เปลี่ยนยอดตั้งต้นนี้", en: "Earlier records do not change this starting balance." },
} satisfies Messages;

export function IncomePeriod({ view }: { view: MonthView }) {
  const { calendar } = useCalendar();
  const { t, locale } = useCopy(copy);
  const end = calendar && view.month === calendar.businessDate.slice(0, 7) ? calendar.businessDate : monthEnd(view.month);
  return view.isPartial ? t("period", { from: formatDate(view.trackedFrom, locale), to: formatDate(end, locale) }) : t("income");
}

export function SuppliedOpening() {
  const { t } = useCopy(copy);
  return <><span>{t("supplied")}</span><p className="text-sm text-muted-ink">{t("suppliedHint")}</p></>;
}
