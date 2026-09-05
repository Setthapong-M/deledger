import { ui } from "@/components/ui-styles";
import type { MonthView } from "@/lib/api-client";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { StatusBadge } from "./status-badge";

export function MonthSummary({ view }: { view: MonthView }) {
  const spending = view.summary.monthlySpending ?? view.summary.provisionalSpending;
  const provisional = view.summary.monthlySpending === null;
  return (
    <section className={`[&>div:first-child]:gap-3 [&_h2]:text-[1.5rem] ${ui.card}`} aria-labelledby="summary-title">
      <div className={ui.sectionHeading}>
        <div><p className={ui.eyebrow}>ภาพรวมของเดือน</p><h2 id="summary-title">{formatMonth(view.month)}</h2></div>
        <StatusBadge state={view.reconciliation.state} partial={view.isPartial} />
      </div>
      <div className="rounded-[18px] bg-primary p-6 text-primary-ink [&_p]:mt-3 [&_p]:mr-0 [&_p]:mb-0 [&_p]:ml-0 [&_p]:text-[0.82rem] forced-colors:border forced-colors:border-[CanvasText]">
        <div className="flex justify-between gap-3 font-[650]"><span>{provisional ? "รายจ่ายโดยประมาณ" : "รายจ่ายทั้งเดือน"}</span><span className="text-[0.85rem]">บาท</span></div>
        <strong className="my-2 block text-[clamp(2rem,4vw,3.5rem)] leading-[1.2] font-[750] tracking-[-0.045em] tabular-nums wrap-anywhere mobile:text-[clamp(2rem,9vw,3.5rem)]">{formatMoney(spending)}</strong>
        <p>{spending === null ? "ยังมีข้อมูลไม่พอสำหรับคำนวณรายจ่าย" : provisional ? "อ้างอิง Snapshot ระหว่างเดือน ยังไม่ใช่ยอดสรุปจากยอดปลาย" : "คำนวณจากยอดปลายที่ยืนยันแล้ว"}</p>
      </div>
      <dl className="my-6 grid grid-cols-3 gap-4 [&>div]:min-w-0 [&>div]:p-0 [&_dt]:text-[0.86rem] [&_dt]:text-muted-ink [&_dd]:mt-1.5 [&_dd]:mr-0 [&_dd]:mb-0 [&_dd]:ml-0 [&_dd]:text-[clamp(1rem,2vw,1.35rem)] [&_dd]:font-bold [&_dd]:tabular-nums [&_dd]:wrap-anywhere mobile:gap-2.5">
        <div><dt>ยอดตั้งต้น</dt><dd>{formatMoney(view.summary.startingBalance)}</dd></div>
        <div><dt>รายรับ</dt><dd>{formatMoney(view.summary.income)}</dd></div>
        <div><dt>ยอดปลาย</dt><dd>{formatMoney(view.summary.endingBalance)}</dd></div>
      </dl>
      <details className="border-t border-border pt-2 [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:py-2.5 [&_summary]:text-[0.9rem] [&_summary]:font-[650] [&_p]:text-[0.9rem]">
        <summary>ดูวิธีคำนวณ</summary>
        <p>ยอดตั้งต้น + รายรับ − {provisional ? "Snapshot ล่าสุด" : "ยอดปลาย"} = {provisional ? "รายจ่ายโดยประมาณ" : "รายจ่ายทั้งเดือน"}</p>
        <p className={ui.helperText}>{provisional ? "Snapshot เป็นยอดที่สังเกตระหว่างเดือน ต้องยืนยันยอดปลายแยกต่างหาก" : "รายละเอียดรายจ่ายอธิบายยอดรวมนี้ ไม่ได้นำมาบวกเพิ่ม"}</p>
      </details>
      {view.isPartial ? <p className={ui.helperText}>เริ่มติดตามตั้งแต่ {formatDate(view.trackedFrom)} เดือนก่อนหน้านี้จึงไม่รวมในช่วงนี้</p> : null}
    </section>
  );
}
