import type { MonthView } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/format";

export function MonthTimeline({ view, onIncome, onSnapshot, onEnding, onClose }: { view: MonthView; onIncome: () => void; onSnapshot: () => void; onEnding: () => void; onClose: () => void }) {
  return (
    <section className="timeline card" aria-labelledby="timeline-title">
      <div className="section-heading"><div><p className="eyebrow">อัปเดตทีละนิด</p><h2 id="timeline-title">ข้อมูลของเดือนนี้</h2></div>{view.lifecycle === "closed" ? <span className="lifecycle-mark">ปิดเดือนแล้ว</span> : null}</div>
      <ol className="timeline-list">
        <li><span className="timeline-dot" aria-hidden="true">1</span><div><strong>รายรับ</strong><span>{formatMoney(view.summary.income)}</span></div>{view.allowedActions.editIncome ? <button className="secondary-button compact" type="button" onClick={onIncome} aria-label="แก้ไขรายรับ">แก้ไข</button> : null}</li>
        <li><span className="timeline-dot" aria-hidden="true">2</span><div><strong>Snapshot ระหว่างเดือน</strong><span>{view.summary.latestSnapshot ? `${formatMoney(view.summary.latestSnapshot.amount)} · ${formatDate(view.summary.latestSnapshot.observedOn)}` : "บันทึกยอดที่เห็น เพื่อดูรายจ่ายโดยประมาณ"}</span></div>{view.allowedActions.recordSnapshot ? <button className="secondary-button compact" type="button" onClick={onSnapshot}>บันทึก</button> : null}</li>
        <li><span className="timeline-dot" aria-hidden="true">3</span><div><strong>รายละเอียดที่ยืนยันแล้ว</strong><span>{formatMoney(view.summary.detailTotal)}</span></div></li>
        <li><span className="timeline-dot" aria-hidden="true">4</span><div><strong>ยอดปลาย</strong><span>{formatMoney(view.summary.endingBalance)}</span></div>{view.allowedActions.editEndingBalance ? <button className="secondary-button compact" type="button" onClick={onEnding} aria-label="แก้ไขยอดปลาย">แก้ไข</button> : null}</li>
      </ol>
      {view.allowedActions.manualClose ? <div className="close-row"><p>ข้อมูลครบแล้ว ปิดเดือนในวันสุดท้ายได้</p><button className="primary-button" type="button" onClick={onClose}>ปิดเดือน</button></div> : view.lifecycle === "open" ? <p className="helper-text">ระบบจะปิดเดือนให้อัตโนมัติเมื่อผ่านวันสุดท้าย หรือคุณปิดเองได้เมื่อข้อมูลครบ</p> : null}
    </section>
  );
}
