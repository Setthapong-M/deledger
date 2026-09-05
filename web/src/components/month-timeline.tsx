import { ui } from "@/components/ui-styles";
import type { MonthView } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";

export function MonthTimeline({ view, onIncome, onSnapshot, onEnding, onClose }: { view: MonthView; onIncome: () => void; onSnapshot: () => void; onEnding: () => void; onClose: () => void }) {
  return (
    <section className={ui.card} aria-labelledby="timeline-title">
      <div className={ui.sectionHeading}><div><p className={ui.eyebrow}>อัปเดตทีละนิด</p><h2 id="timeline-title">ข้อมูลของเดือนนี้</h2></div>{view.lifecycle === "closed" ? <span className="font-[650] text-muted-ink">ปิดเดือนแล้ว</span> : null}</div>
      <ol className="m-0 grid list-none gap-0 p-0 [&_li]:grid [&_li]:min-h-[68px] [&_li]:grid-cols-[34px_minmax(0,1fr)_auto] [&_li]:items-center [&_li]:gap-3 [&_li]:border-t [&_li]:border-border [&_span]:text-[0.86rem] [&_span]:text-muted-ink [&_li>div]:grid [&_li>div]:gap-1">
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">1</span><div><strong>รายรับ</strong><span>{formatMoney(view.summary.income)}</span></div>{view.allowedActions.editIncome ? <button className={ui.secondaryButtonCompact} type="button" onClick={onIncome} aria-label="แก้ไขรายรับ">แก้ไข</button> : null}</li>
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">2</span><div><strong>Snapshot ระหว่างเดือน</strong><span>{view.summary.latestSnapshot ? `${formatMoney(view.summary.latestSnapshot.amount)} · ${formatDate(view.summary.latestSnapshot.observedOn)}` : "บันทึกยอดที่เห็น เพื่อดูรายจ่ายโดยประมาณ"}</span></div>{view.allowedActions.recordSnapshot ? <button className={ui.secondaryButtonCompact} type="button" onClick={onSnapshot}>บันทึก</button> : null}</li>
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">3</span><div><strong>รายละเอียดที่ยืนยันแล้ว</strong><span>{formatMoney(view.summary.detailTotal)}</span></div></li>
        <li><span className="grid size-[30px] place-items-center rounded-full border border-border text-[0.8rem] text-muted-ink" aria-hidden="true">4</span><div><strong>ยอดปลาย</strong><span>{formatMoney(view.summary.endingBalance)}</span></div>{view.allowedActions.editEndingBalance ? <button className={ui.secondaryButtonCompact} type="button" onClick={onEnding} aria-label="แก้ไขยอดปลาย">แก้ไข</button> : null}</li>
      </ol>
      {view.allowedActions.manualClose ? <div className="mt-5 flex items-center justify-between gap-5 border-t border-border pt-4 [&_p]:m-0 [&_p]:text-muted-ink mobile:flex-col mobile:items-stretch mobile:[&_button]:w-full"><p>ข้อมูลครบแล้ว ปิดเดือนในวันสุดท้ายได้</p><button className={ui.primaryButton} type="button" onClick={onClose}>ปิดเดือน</button></div> : view.lifecycle === "open" ? <p className={ui.helperText}>ระบบจะปิดเดือนให้อัตโนมัติเมื่อผ่านวันสุดท้าย หรือคุณปิดเองได้เมื่อข้อมูลครบ</p> : null}
    </section>
  );
}
