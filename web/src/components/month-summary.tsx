"use client";

import { IncomePeriod, SuppliedOpening } from "./income-period";
import { ui } from "@/components/ui-styles";
import type { MonthView } from "@/lib/api-client";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { StatusBadge } from "./status-badge";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  estimatedSpending: { th: "รายจ่ายโดยประมาณ", en: "Estimated spending" },
  monthlySpending: { th: "รายจ่ายทั้งเดือน", en: "Monthly spending" },
  currency: { th: "บาท", en: "THB" },
  insufficientInformation: { th: "ยังมีข้อมูลไม่พอคำนวณรายจ่าย", en: "More information is needed to calculate spending." },
  provisionalExplanation: { th: "อ้างอิงยอดเงินระหว่างเดือน ยังไม่ใช่ยอดสรุป", en: "Based on a balance check-in. This is not the final total." },
  confirmedExplanation: { th: "คำนวณจากยอดสิ้นเดือนที่ยืนยันแล้ว", en: "Based on your confirmed closing balance." },
  openingBalance: { th: "ยอดต้นเดือน", en: "Opening balance" },
  income: { th: "รายรับ", en: "Income" },
  closingBalance: { th: "ยอดสิ้นเดือน", en: "Closing balance" },
  calculation: { th: "ดูวิธีคำนวณ", en: "How it is calculated" },
  estimatedFormula: { th: "ยอดต้นเดือน + รายรับ − ยอดเงินระหว่างเดือนล่าสุด = รายจ่ายโดยประมาณ", en: "Opening balance + income − latest balance check-in = estimated spending" },
  confirmedFormula: { th: "ยอดต้นเดือน + รายรับ − ยอดสิ้นเดือน = รายจ่ายทั้งเดือน", en: "Opening balance + income − closing balance = monthly spending" },
  confirmationNeeded: { th: "ยอดเงินระหว่างเดือนใช้ดูรายจ่ายคร่าว ๆ ต้องยืนยันยอดสิ้นเดือนอีกครั้ง", en: "Balance check-ins estimate spending. Confirm the closing balance separately." },
  detailsExplanation: { th: "รายการรายจ่ายเป็นส่วนหนึ่งของยอดรวม ไม่ได้บวกเพิ่ม", en: "Itemized spending is part of this total, not added on top." },
  trackedFrom: { th: "เริ่มติดตาม {date} ไม่รวมช่วงก่อนหน้านี้", en: "Tracking started on {date}. Earlier dates are excluded." },
} satisfies Messages;

export function MonthSummary({ view }: { view: MonthView }) {
  const { locale, t } = useCopy(copy);
  const spending = view.summary.monthlySpending ?? view.summary.provisionalSpending;
  const provisional = view.summary.monthlySpending === null;
  return (
    <section className={`[&>div:first-child]:gap-3 [&_h2]:text-[1.5rem] ${ui.card}`} aria-labelledby="summary-title">
      <div className={ui.sectionHeading}>
        <div><h2 id="summary-title">{formatMonth(view.month, locale)}</h2></div>
        <StatusBadge state={view.reconciliation.state} partial={view.isPartial} />
      </div>
      <div className="rounded-[18px] bg-primary p-6 text-primary-ink [&_p]:mt-3 [&_p]:mr-0 [&_p]:mb-0 [&_p]:ml-0 [&_p]:text-[0.82rem] forced-colors:border forced-colors:border-[CanvasText]">
        <div className="flex justify-between gap-3 font-[650]"><span>{t(provisional ? "estimatedSpending" : "monthlySpending")}</span><span className="text-[0.85rem]">{t("currency")}</span></div>
        <strong className="my-2 block text-[clamp(2rem,4vw,3.5rem)] leading-[1.2] font-[750] tracking-[-0.045em] tabular-nums wrap-anywhere mobile:text-[clamp(2rem,9vw,3.5rem)]">{formatMoney(spending)}</strong>
        <p>{t(spending === null ? "insufficientInformation" : provisional ? "provisionalExplanation" : "confirmedExplanation")}</p>
      </div>
      <dl className="my-6 grid grid-cols-3 gap-4 [&>div]:min-w-0 [&>div]:p-0 [&_dt]:text-[0.86rem] [&_dt]:text-muted-ink [&_dd]:mt-1.5 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-[clamp(1rem,2vw,1.35rem)] [&_dd]:font-bold [&_dd]:tabular-nums [&_dd]:wrap-anywhere mobile:gap-2.5">
        <div><dt>{view.openingSource === "supplied" ? <SuppliedOpening /> : t("openingBalance")}</dt><dd>{formatMoney(view.summary.startingBalance)}</dd></div>
        <div><dt>{<IncomePeriod view={view} />}</dt><dd>{formatMoney(view.summary.income)}</dd></div>
        <div><dt>{t("closingBalance")}</dt><dd>{formatMoney(view.summary.endingBalance)}</dd></div>
      </dl>
      <details className="border-t border-border pt-2 [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:py-2.5 [&_summary]:text-[0.9rem] [&_summary]:font-[650] [&_p]:text-[0.9rem]">
        <summary>{t("calculation")}</summary>
        <p>{t(provisional ? "estimatedFormula" : "confirmedFormula")}</p>
        <p className={ui.helperText}>{t(provisional ? "confirmationNeeded" : "detailsExplanation")}</p>
      </details>
      {view.isPartial ? <p className={ui.helperText}>{t("trackedFrom", { date: formatDate(view.trackedFrom, locale) })}</p> : null}
    </section>
  );
}
