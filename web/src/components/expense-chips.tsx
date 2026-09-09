"use client";

import { useFinancialClock } from "@/lib/calendar";
import { Icon } from "./icon";

import { ui } from "@/components/ui-styles";

import { useRef, useState } from "react";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  eyebrow: { th: "รายละเอียดรายจ่าย", en: "Expense details" },
  title: { th: "กดรายการที่จ่ายแล้ว", en: "Mark what you’ve paid" },
  explanation: { th: "รายละเอียดช่วยอธิบายรายจ่าย ไม่เพิ่มยอดรายจ่ายทั้งเดือน", en: "Details explain spending; they don’t add to your monthly total." },
  list: { th: "เลือกรายการรายจ่าย", en: "Select an expense" },
  empty: { th: "ยังไม่มีรายการให้เลือก", en: "No expenses to select yet" },
  enterAmount: { th: "กรอกตอนจ่าย", en: "Enter when paid" },
  editDescription: { th: "แก้ยอดหรือยกเลิกการยืนยันได้", en: "Update the amount or undo confirmation" },
  unpaidTitle: { th: "เปลี่ยนเป็นยังไม่จ่าย?", en: "Mark as unpaid?" },
  unpaidDescription: { th: "ยกเลิกสถานะจ่ายแล้วของ {name}", en: "Undo the payment confirmation for {name}." },
  markUnpaid: { th: "เปลี่ยนเป็นยังไม่จ่าย", en: "Mark as unpaid" },
  newAmount: { th: "ยอดใหม่", en: "New amount" },
  undo: { th: "ยกเลิกการยืนยัน", en: "Undo confirmation" },
  update: { th: "แก้ยอด", en: "Update amount" },
  recordTitle: { th: "บันทึก {name}", en: "Record {name}" },
  paidDescription: { th: "กรอกยอดที่จ่ายจริง", en: "Enter the amount actually paid" },
  paidAmount: { th: "ยอดที่จ่าย", en: "Amount paid" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  amountRequired: { th: "กรอกยอดที่จ่ายก่อนนะ", en: "Enter the amount paid first" },
  save: { th: "บันทึกรายจ่าย", en: "Save expense" },
} satisfies Messages;
import { api, ApiClientError, isAuthenticationError, type MonthView } from "@/lib/api-client";
import { Dialog } from "./dialog";
import { MoneyField } from "./money-field";
import { FeedbackBanner } from "./feedback-banner";

export function ExpenseChips({ view, onChange, onSessionExpired = () => window.location.assign("/login") }: { view: MonthView; onChange: (view: MonthView) => void; onSessionExpired?: () => void }) {
  const { t, errorMessage } = useCopy(copy);
  const clock = useFinancialClock();
  const [selected, setSelected] = useState<MonthView["setup"][number] | null>(null);
  const [amount, setAmount] = useState("");
  const [failure, setFailure] = useState<{ reason: unknown } | null>(null);
  const [validation, setValidation] = useState<"amountRequired" | null>(null);
  const error = validation ? t(validation) : failure ? errorMessage(failure.reason) : undefined;
  const [message, setMessage] = useState<{ reason: unknown } | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const items = [...view.setup].sort((left, right) => left.position - right.position);
  async function save(nextAmount?: string, item = selected) {
    if (!item || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    const direct = item.kind === "fixed" && !item.detail;
    try {
      const next = await api.confirmDetail(view.month, item.id, item.kind === "fixed" ? undefined : nextAmount, view.revision, clock);
      onChange(next);
      setSelected(null);
      setFailure(null);
      setValidation(null);
    } catch (reason) {
      if (isAuthenticationError(reason)) {
        setSelected(null); setFailure(null); setValidation(null); setMessage(null); onSessionExpired(); return;
      }
      if (reason instanceof ApiClientError && reason.current) onChange(reason.current);
      setValidation(null);
      if (direct) setMessage({ reason });
      else setFailure({ reason });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function cancel() {
    if (!selected || pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      onChange(await api.cancelDetail(view.month, selected.id, view.revision, clock));
      setSelected(null);
    } catch (reason) {
      if (isAuthenticationError(reason)) {
        setSelected(null); setFailure(null); setValidation(null); setMessage(null); onSessionExpired(); return;
      }
      if (reason instanceof ApiClientError && reason.current) onChange(reason.current);
      setMessage({ reason });
      setSelected(null);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function choose(item: MonthView["setup"][number]) {
    if (!view.allowedActions.confirmDetails || pending.current) return;
    if (item.kind === "fixed" && !item.detail) { void save(undefined, item); return; }
    setSelected(item);
    setAmount(item.detail?.confirmedAmount ?? item.fixedAmount ?? "");
    setFailure(null); setValidation(null);
  }
  return <section className={`scroll-mt-5 [&>div:first-child]:items-center ${ui.card}`} aria-labelledby="chips-title">
    <div className={ui.sectionHeading}><div><p className={ui.eyebrow}>{t("eyebrow")}</p><h2 id="chips-title">{t("title")}</h2></div><span className={`${ui.helperText} max-w-[370px]`}>{t("explanation")}</span></div>
    {message ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{errorMessage(message.reason)}</FeedbackBanner> : null}
    <div className="flex flex-wrap gap-2.5" role="list" aria-label={t("list")}>
      {items.length === 0 ? <p className={ui.emptyState}>{t("empty")}</p> : items.map((item) => <div key={item.id} role="listitem"><button type="button" className="inline-flex min-h-12 items-center gap-[9px] rounded-full border border-dashed border-state-muted bg-surface px-[13px] py-2 text-ink [&_small]:text-muted-ink aria-pressed:border-solid aria-pressed:border-primary-ink aria-pressed:bg-primary aria-pressed:text-primary-ink aria-pressed:[&_small]:text-primary-ink data-paused:border-dotted forced-colors:aria-pressed:outline-2 forced-colors:aria-pressed:outline-[Highlight]" data-paused={item.isPaused ? "" : undefined} onClick={() => choose(item)} disabled={!view.allowedActions.confirmDetails || busy} aria-busy={busy} aria-pressed={Boolean(item.detail)}><Icon name={item.detail ? "checked" : "unchecked"} /><span>{item.name}</span><small>{item.detail ? item.detail.confirmedAmount : item.kind === "fixed" ? item.fixedAmount : t("enterAmount")}</small></button></div>)}
    </div>
    {selected && selected.detail && selected.kind === "variable" ? <Dialog title={selected.name} description={t("editDescription")} onClose={() => setSelected(null)}><div className={ui.dialogForm}>
      {selected.kind === "variable" ? <MoneyField id="replace-amount" label={t("newAmount")} value={amount} onChange={setAmount} error={error ?? undefined} /> : error ? <p className={ui.fieldError} role="alert">{error}</p> : null}
      <div className={ui.dialogActions}><button className={ui.secondaryButton} type="button" disabled={busy} onClick={() => void cancel()}>{t("undo")}</button>{selected.kind === "variable" ? <button className={ui.primaryButton} type="button" disabled={busy} onClick={() => void save(amount)}>{t("update")}</button> : null}</div>
    </div></Dialog> : null}
    {selected && !selected.detail && selected.kind === "variable" ? <Dialog title={t("recordTitle", { name: selected.name })} description={t("paidDescription")} onClose={() => setSelected(null)}><div className={ui.dialogForm}><MoneyField id="variable-amount" label={t("paidAmount")} value={amount} onChange={setAmount} error={error ?? undefined} /><div className={ui.dialogActions}><button className={ui.secondaryButton} type="button" onClick={() => setSelected(null)}>{t("cancel")}</button><button className={ui.primaryButton} type="button" disabled={busy} onClick={() => { if (!amount.trim()) { setValidation("amountRequired"); return; } void save(amount); }}>{t("save")}</button></div></div></Dialog> : null}
    {selected && selected.detail && selected.kind === "fixed" ? <Dialog title={t("unpaidTitle")} description={t("unpaidDescription", { name: selected.name })} onClose={() => setSelected(null)}>
      <div className={ui.dialogForm}>
        <div className={ui.dialogActions}>
          <button className={ui.secondaryButton} type="button" onClick={() => setSelected(null)}>{t("cancel")}</button>
          <button className={ui.primaryButton} type="button" disabled={busy} onClick={() => void cancel()}>{t("markUnpaid")}</button>
        </div>
      </div>
    </Dialog> : null}
  </section>;
}
