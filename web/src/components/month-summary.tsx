import type { MonthView } from "@/lib/api-client";
import { formatMoney, formatMonth } from "@/lib/format";
import { StatusBadge } from "./status-badge";

export function MonthSummary({ view }: { view: MonthView }) {
  const spending = view.summary.monthlySpending ?? view.summary.provisionalSpending;
  const spendingLabel = view.summary.monthlySpending === null ? "รายจ่ายโดยประมาณ" : "รายจ่ายทั้งเดือน";
  return (
    <section className="month-summary card" aria-labelledby="summary-title">
      <div className="section-heading"><div><p className="eyebrow">ภาพรวม</p><h1 id="summary-title">{formatMonth(view.month)}</h1></div><StatusBadge state={view.reconciliation.state} partial={view.isPartial} /></div>
      <div className="summary-grid">
        <div><span>ยอดตั้งต้น</span><strong>{formatMoney(view.summary.startingBalance)}</strong></div>
        <div><span>รายรับ</span><strong>{formatMoney(view.summary.income)}</strong></div>
        <div><span>ยอดปลาย</span><strong>{formatMoney(view.summary.endingBalance)}</strong></div>
        <div className="summary-emphasis"><span>{spendingLabel}</span><strong>{formatMoney(spending)}</strong></div>
      </div>
      {view.isPartial ? <p className="helper-text">เริ่มติดตามตั้งแต่ {view.trackedFrom} เดือนก่อนหน้านี้จึงไม่รวมในช่วงนี้</p> : null}
    </section>
  );
}
