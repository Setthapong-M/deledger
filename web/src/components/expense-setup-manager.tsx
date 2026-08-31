"use client";

import { useState } from "react";
import { api, ApiClientError, type MonthView } from "@/lib/api-client";
import { ExpenseSetupDialog, type SetupDraft } from "./expense-setup-dialog";
import { FeedbackBanner } from "./feedback-banner";

export function ExpenseSetupManager({ view, onChange }: { view: MonthView; onChange: (view: MonthView) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  async function run(action: () => Promise<MonthView>) {
    try { onChange(await action()); setMessage(null); } catch (reason) {
      if (reason instanceof ApiClientError && reason.current) onChange(reason.current);
      setMessage(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    }
  }
  const ordered = [...view.setup].sort((left, right) => left.position - right.position);
  function move(id: string, direction: -1 | 1) {
    const index = ordered.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const ids = ordered.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex]!, ids[index]!];
    void run(() => api.reorderSetup(view.month, ids, view.revision));
  }
  return <section className="setup-manager card" aria-labelledby="setup-title">
    <div className="section-heading"><div><p className="eyebrow">ตั้งค่าของเดือน</p><h2 id="setup-title">รายการรายจ่ายประจำ</h2></div><button className="primary-button compact" type="button" onClick={() => setAdding(true)} disabled={!view.allowedActions.manageSetup}>เพิ่มรายการ</button></div>
    {message ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{message}</FeedbackBanner> : null}
    <div className="setup-list" role="list" aria-label="รายการรายจ่ายประจำของเดือน">
      {ordered.length === 0 ? <p className="empty-state">ยังไม่มีรายการประจำ เพิ่มรายการที่ต้องการติดตามได้เลย</p> : ordered.map((item, index) => <div className={`setup-row${dragging === item.id ? " is-dragging" : ""}`} key={item.id} role="listitem" draggable={view.allowedActions.manageSetup} onDragStart={() => setDragging(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!dragging || dragging === item.id) return; const from = ordered.findIndex((entry) => entry.id === dragging); const to = index; const ids = ordered.map((entry) => entry.id); const [picked] = ids.splice(from, 1); ids.splice(to, 0, picked!); setDragging(null); void run(() => api.reorderSetup(view.month, ids, view.revision)); }} onDragEnd={() => setDragging(null)}>
        <button type="button" className="drag-handle" aria-label={`ลากเพื่อจัดลำดับ ${item.name}`} title="ลากเพื่อจัดลำดับ" onKeyDown={(event) => { if (event.key === "ArrowUp") { event.preventDefault(); move(item.id, -1); } if (event.key === "ArrowDown") { event.preventDefault(); move(item.id, 1); } }} disabled={!view.allowedActions.manageSetup}>⠿</button>
        <div className="setup-copy"><strong>{item.name}</strong><span>{item.kind === "fixed" ? `Fixed · ${item.fixedAmount ?? "—"}` : "Variable · กรอกตอนจ่าย"}{item.isPaused ? " · พักไว้" : ""}</span></div>
        <div className="setup-actions"><button className="icon-button" type="button" aria-label={`แก้ไข ${item.name}`} onClick={() => setEditing(item.id)} disabled={!view.allowedActions.manageSetup}>✎</button><button className="icon-button" type="button" aria-label={item.isPaused ? `เปิดใช้ ${item.name}` : `พักใช้ ${item.name}`} onClick={() => void run(() => api.updateSetup(view.month, item.id, { isPaused: !item.isPaused, expectedRevision: view.revision }))} disabled={!view.allowedActions.manageSetup}>{item.isPaused ? "▶" : "Ⅱ"}</button></div>
      </div>)}
    </div>
    {adding ? <ExpenseSetupDialog onClose={() => setAdding(false)} onSave={(draft) => run(() => api.addSetup(view.month, { ...draft, expectedRevision: view.revision }))} /> : null}
    {editing ? (() => { const item = view.setup.find((entry) => entry.id === editing); return item ? <ExpenseSetupDialog initial={{ name: item.name, kind: item.kind, fixedAmount: item.fixedAmount }} onClose={() => setEditing(null)} onSave={(draft: SetupDraft) => run(() => api.updateSetup(view.month, item.id, { ...draft, expectedRevision: view.revision }))} /> : null; })() : null}
  </section>;
}
