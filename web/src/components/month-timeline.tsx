import { IncomePeriod, SuppliedOpening } from "./income-period";
import { ui } from "@/components/ui-styles";
import { Icon } from "./icon";
import type { MonthView } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  title: { th: "ข้อมูลเดือนนี้", en: "Monthly details" },
  closed: { th: "ปิดเดือนแล้ว", en: "Month closed" },
  income: { th: "รายรับ", en: "Income" },
  edit: { th: "แก้ไข", en: "Edit" },
  editIncome: { th: "แก้ไขรายรับ", en: "Edit income" },
  balanceCheckIn: { th: "ยอดเงินระหว่างเดือน", en: "Balance check-in" },
  checkInHint: { th: "บันทึกยอดเงินเพื่อดูรายจ่ายคร่าว ๆ", en: "Record your balance to estimate spending." },
  record: { th: "บันทึก", en: "Record" },
  recordCheckIn: { th: "บันทึกยอดเงินระหว่างเดือน", en: "Record a balance check-in" },
  confirmedDetails: { th: "รายจ่ายที่ยืนยันแล้ว", en: "Confirmed spending items" },
  closingBalance: { th: "ยอดสิ้นเดือน", en: "Closing balance" },
  editClosingBalance: { th: "แก้ไขยอดสิ้นเดือน", en: "Edit closing balance" },
  readyToClose: { th: "ข้อมูลครบแล้ว ปิดเดือนได้ในวันสุดท้าย", en: "Everything is ready. You can close on the last day of the month." },
  closeMonth: { th: "ปิดเดือน", en: "Close month" },
  automaticClose: { th: "ระบบปิดเดือนให้อัตโนมัติแม้ข้อมูลยังไม่ครบ หรือปิดเองได้ในวันสุดท้ายเมื่อข้อมูลครบ", en: "The month closes automatically even with missing information. You can also close it on the last day when everything is complete." },
} satisfies Messages;

export function MonthTimeline({ view, onIncome, onSnapshot, onEnding, onClose }: { view: MonthView; onIncome: () => void; onSnapshot: () => void; onEnding: () => void; onClose: () => void }) {
  const { locale, t } = useCopy(copy);
  return (
    <section className={ui.card} aria-labelledby="timeline-title">
      <div className={ui.sectionHeading}><div><h2 id="timeline-title">{t("title")}</h2></div>{view.lifecycle === "closed" ? <span className="font-[650] text-muted-ink">{t("closed")}</span> : null}</div>
      <ol className="m-0 grid list-none gap-0 p-0 [&_li]:grid [&_li]:min-h-[68px] [&_li]:grid-cols-[34px_minmax(0,1fr)_auto] [&_li]:items-center [&_li]:gap-3 [&_li]:border-t [&_li]:border-border [&_span]:text-[0.86rem] [&_span]:text-muted-ink [&_li>div]:grid [&_li>div]:gap-1">
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">1</span><div><strong>{<IncomePeriod view={view} />}</strong><span>{formatMoney(view.summary.income)}</span></div>{view.allowedActions.editIncome ? <button className={ui.iconButton} type="button" onClick={onIncome} aria-label={t("editIncome")} title={t("editIncome")}><Icon name="edit" /></button> : null}</li>
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">2</span><div><strong>{t("balanceCheckIn")}</strong><span>{view.summary.latestSnapshot ? `${formatMoney(view.summary.latestSnapshot.amount)} · ${formatDate(view.summary.latestSnapshot.observedOn, locale)}` : t("checkInHint")}</span></div>{view.allowedActions.recordSnapshot ? <button className={ui.iconButton} type="button" onClick={onSnapshot} aria-label={t("recordCheckIn")} title={t("recordCheckIn")}><Icon name="plus" /></button> : null}</li>
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">3</span><div><strong>{t("confirmedDetails")}</strong><span>{formatMoney(view.summary.detailTotal)}</span></div></li>
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">4</span><div><strong>{t("closingBalance")}</strong><span>{formatMoney(view.summary.endingBalance)}</span></div>{view.allowedActions.editEndingBalance ? <button className={ui.iconButton} type="button" onClick={onEnding} aria-label={t("editClosingBalance")} title={t("editClosingBalance")}><Icon name="edit" /></button> : null}</li>
      </ol>
      {view.allowedActions.manualClose ? <div className="mt-5 flex items-center justify-between gap-5 border-t border-border pt-4 [&_p]:m-0 [&_p]:text-muted-ink mobile:flex-col mobile:items-stretch mobile:[&_button]:w-full"><p>{t("readyToClose")}</p><button className={ui.primaryButton} type="button" onClick={onClose}>{t("closeMonth")}</button></div> : view.lifecycle === "open" ? <p className={ui.helperText}>{t("automaticClose")}</p> : null}
    </section>
  );
}
