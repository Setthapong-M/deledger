"use client";

import { ui } from "@/components/ui-styles";

import { useState } from "react";
import { api, ApiClientError, isAuthenticationError, type MonthView } from "@/lib/api-client";
import { Dialog } from "./dialog";
import { MoneyField } from "./money-field";
import { FeedbackBanner } from "./feedback-banner";

export function ExpenseChips({ view, onChange, onSessionExpired = () => window.location.assign("/login") }: { view: MonthView; onChange: (view: MonthView) => void; onSessionExpired?: () => void }) {
  const [selected, setSelected] = useState<MonthView["setup"][number] | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const items = [...view.setup].sort((left, right) => left.position - right.position);
  async function save(nextAmount?: string) {
    if (!selected) return;
    try { const next = selected.detail ? await api.confirmDetail(view.month, selected.id, nextAmount, view.revision) : await api.confirmDetail(view.month, selected.id, selected.kind === "variable" ? nextAmount : undefined, view.revision); onChange(next); setSelected(null); setError(null); } catch (reason) { if (isAuthenticationError(reason)) { setSelected(null); setError(null); setMessage(null); onSessionExpired(); return; } if (reason instanceof ApiClientError && reason.current) onChange(reason.current); setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
  }
  async function cancel() {
    if (!selected) return;
    try { onChange(await api.cancelDetail(view.month, selected.id, view.revision)); setSelected(null); } catch (reason) { if (isAuthenticationError(reason)) { setSelected(null); setError(null); setMessage(null); onSessionExpired(); return; } if (reason instanceof ApiClientError && reason.current) onChange(reason.current); setMessage(reason instanceof Error ? reason.message : "ยกเลิกไม่สำเร็จ"); setSelected(null); }
  }
  function choose(item: MonthView["setup"][number]) {
    if (!view.allowedActions.confirmDetails) return;
    setSelected(item);
    setAmount(item.detail?.confirmedAmount ?? item.fixedAmount ?? "");
    setError(null);
  }
  return <section className={`scroll-mt-5 [&>div:first-child]:items-center ${ui.card}`} aria-labelledby="chips-title">
    <div className={ui.sectionHeading}><div><p className={ui.eyebrow}>รายละเอียดที่นึกได้</p><h2 id="chips-title">กดรายการที่จ่ายแล้ว</h2></div><span className={`${ui.helperText} max-w-[370px]`}>รายละเอียดช่วยอธิบายยอดรายจ่าย ไม่เพิ่มยอดรายจ่ายทั้งเดือน</span></div>
    {message ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{message}</FeedbackBanner> : null}
    <div className="flex flex-wrap gap-2.5" role="list" aria-label="เลือกรายการรายจ่าย">
      {items.length === 0 ? <p className={ui.emptyState}>ยังไม่มีรายการให้เลือก</p> : items.map((item) => <div key={item.id} role="listitem"><button type="button" className="inline-flex min-h-12 items-center gap-[9px] rounded-full border border-dashed border-state-muted bg-surface px-[13px] py-2 text-ink [&_small]:text-muted-ink aria-pressed:border-solid aria-pressed:border-primary-ink aria-pressed:bg-primary aria-pressed:text-primary-ink aria-pressed:[&_small]:text-primary-ink data-paused:border-dotted forced-colors:aria-pressed:outline-2 forced-colors:aria-pressed:outline-[Highlight]" data-paused={item.isPaused ? "" : undefined} onClick={() => choose(item)} disabled={!view.allowedActions.confirmDetails} aria-pressed={Boolean(item.detail)}><span aria-hidden="true">{item.detail ? "✓" : "○"}</span><span>{item.name}</span><small>{item.detail ? item.detail.confirmedAmount : item.kind === "fixed" ? item.fixedAmount : "กรอกยอด"}</small></button></div>)}
    </div>
    {selected && selected.detail ? <Dialog title={selected.name} description={selected.kind === "variable" ? "เลือกแก้ยอดหรือยกเลิกการยืนยัน" : "รายการ Fixed นี้ถูกยืนยันแล้ว"} onClose={() => setSelected(null)}><div className={ui.dialogForm}>
      {selected.kind === "variable" ? <MoneyField id="replace-amount" label="ยอดใหม่" value={amount} onChange={setAmount} error={error ?? undefined} /> : error ? <p className={ui.fieldError} role="alert">{error}</p> : null}
      <div className={ui.dialogActions}><button className={ui.secondaryButton} type="button" onClick={() => void cancel()}>ยกเลิกการยืนยัน</button>{selected.kind === "variable" ? <button className={ui.primaryButton} type="button" onClick={() => void save(amount)}>แก้ยอด</button> : null}</div>
    </div></Dialog> : null}
    {selected && !selected.detail && selected.kind === "variable" ? <Dialog title={`บันทึก ${selected.name}`} description="กรอกยอดที่จ่ายจริงในครั้งนี้" onClose={() => setSelected(null)}><div className={ui.dialogForm}><MoneyField id="variable-amount" label="ยอดที่จ่าย" value={amount} onChange={setAmount} error={error ?? undefined} /><div className={ui.dialogActions}><button className={ui.secondaryButton} type="button" onClick={() => setSelected(null)}>ยกเลิก</button><button className={ui.primaryButton} type="button" onClick={() => { if (!amount.trim()) { setError("กรุณากรอกยอดที่จ่าย"); return; } void save(amount); }}>บันทึกรายจ่าย</button></div></div></Dialog> : null}
    {selected && !selected.detail && selected.kind === "fixed" ? <Dialog title={`ยืนยัน ${selected.name}`} description="ใช้ยอด Fixed ที่ตั้งไว้ในเดือนนี้" onClose={() => setSelected(null)}><div className={ui.dialogForm}><p className="m-0 bg-surface-muted p-[18px] text-center text-[1.8rem] font-[750]">{selected.fixedAmount}</p>{error ? <p className={ui.fieldError} role="alert">{error}</p> : null}<div className={ui.dialogActions}><button className={ui.secondaryButton} type="button" onClick={() => setSelected(null)}>ยกเลิก</button><button className={ui.primaryButton} type="button" onClick={() => void save()}>ยืนยันว่าจ่ายแล้ว</button></div></div></Dialog> : null}
  </section>;
}
