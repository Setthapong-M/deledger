import type { ReconciliationState } from "@/lib/api-client";

export const statusText: Record<ReconciliationState, string> = {
  draft: "กำลังกรอก",
  needs_information: "ข้อมูลไม่ครบ",
  inconsistent: "ยอดไม่สอดคล้อง",
  reconciled: "ตรวจสอบแล้ว",
};

const statusSymbol: Record<ReconciliationState, string> = {
  draft: "○",
  needs_information: "!",
  inconsistent: "⚠",
  reconciled: "✓",
};

export function StatusBadge({ state, partial = false }: { state: ReconciliationState; partial?: boolean }) {
  return (
    <span className={`status-badge status-${state}`}>
      <span aria-hidden="true">{statusSymbol[state]}</span>
      <span>{statusText[state]}</span>
      {partial ? <span className="status-partial">· เริ่มกลางเดือน</span> : null}
    </span>
  );
}
