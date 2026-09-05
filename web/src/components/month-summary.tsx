import type { MonthView } from "@/lib/api-client";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { StatusBadge } from "./status-badge";

export function MonthSummary({ view }: { view: MonthView }) {
  const spending = view.summary.monthlySpending ?? view.summary.provisionalSpending;
  const provisional = view.summary.monthlySpending === null;
  return (
    <section className="month-summary card" aria-labelledby="summary-title">
      <div className="section-heading">
        <div><p className="eyebrow">ภาพรวมของเดือน</p><h2 id="summary-title">{formatMonth(view.month)}</h2></div>
        <StatusBadge state={view.reconciliation.state} partial={view.isPartial} />
      </div>
      <div className="spending-hero">
        <div className="spending-heading"><span>{provisional ? "รายจ่ายโดยประมาณ" : "รายจ่ายทั้งเดือน"}</span><span className="spending-unit">บาท</span></div>
        <strong className="spending-total">{formatMoney(spending)}</strong>
        <p>{spending === null ? "ยังมีข้อมูลไม่พอสำหรับคำนวณรายจ่าย" : provisional ? "อ้างอิง Snapshot ระหว่างเดือน ยังไม่ใช่ยอดสรุปจากยอดปลาย" : "คำนวณจากยอดปลายที่ยืนยันแล้ว"}</p>
      </div>
      <dl className="summary-grid">
        <div><dt>ยอดตั้งต้น</dt><dd>{formatMoney(view.summary.startingBalance)}</dd></div>
        <div><dt>รายรับ</dt><dd>{formatMoney(view.summary.income)}</dd></div>
        <div><dt>ยอดปลาย</dt><dd>{formatMoney(view.summary.endingBalance)}</dd></div>
      </dl>
      <details className="calculation-details">
        <summary>ดูวิธีคำนวณ</summary>
        <p>ยอดตั้งต้น + รายรับ − {provisional ? "Snapshot ล่าสุด" : "ยอดปลาย"} = {provisional ? "รายจ่ายโดยประมาณ" : "รายจ่ายทั้งเดือน"}</p>
        <p className="helper-text">{provisional ? "Snapshot เป็นยอดที่สังเกตระหว่างเดือน ต้องยืนยันยอดปลายแยกต่างหาก" : "รายละเอียดรายจ่ายอธิบายยอดรวมนี้ ไม่ได้นำมาบวกเพิ่ม"}</p>
      </details>
      {view.isPartial ? <p className="helper-text">เริ่มติดตามตั้งแต่ {formatDate(view.trackedFrom)} เดือนก่อนหน้านี้จึงไม่รวมในช่วงนี้</p> : null}
    </section>
  );
}
