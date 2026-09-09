"use client";

import { ui } from "@/components/ui-styles";

import { useState, type FormEvent } from "react";
import { Dialog } from "./dialog";
import { MoneyField } from "./money-field";
import { DateInput } from "./date-input";
import { useCopy, type Messages } from "@/lib/i18n";
import { useCalendar, useFinancialClock } from "@/lib/calendar";

const copy = {
  amount: { th: "ยอดเงิน", en: "Amount" },
  amountRequired: { th: "กรอกยอดเงินก่อนนะ", en: "Enter an amount first" },
  dateRequired: { th: "เลือกวันที่เช็กยอดก่อนนะ", en: "Choose the check-in date first" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  save: { th: "บันทึก", en: "Save" },
  stale: { th: "วันที่ระบบเปลี่ยนแล้ว ปิดหน้าต่างแล้วตรวจข้อมูลล่าสุดก่อนบันทึก", en: "The system date changed. Close this dialog and review the latest information before saving." },
} satisfies Messages;

export function BalanceDialog({ title, initialValue = "", dateLabel, minDate, onSubmit, onClose }: { title: string; initialValue?: string; dateLabel?: string; minDate?: string; onSubmit: (amount: string, date?: string, clock?: string | null) => Promise<void> | void; onClose: () => void }) {
  const { calendar } = useCalendar();
  const clock = useFinancialClock();
  const stale = calendar !== null && clock !== calendar.clockRevision;
  const [busy, setBusy] = useState(false);
  const { t, errorMessage } = useCopy(copy);
  const [amount, setAmount] = useState(initialValue);
  const [date, setDate] = useState("");
  const [failure, setFailure] = useState<{ reason: unknown } | null>(null);
  const [validation, setValidation] = useState<"amountRequired" | "dateRequired" | null>(null);
  const error = validation ? t(validation) : failure ? errorMessage(failure.reason) : undefined;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) return;
    setValidation(null);
    if (amount.trim() === "") { setValidation("amountRequired"); return; }
    if (dateLabel && !date) { setValidation("dateRequired"); return; }
    setBusy(true);
    try { await onSubmit(amount, date || undefined, clock); onClose(); } catch (reason) { setFailure({ reason }); }
    finally { setBusy(false); }
  }
  return <Dialog title={title} onClose={onClose}><form className={ui.dialogForm} onSubmit={submit}>
    {stale ? <p role="alert">{t("stale")}</p> : null}
    <MoneyField id="dialog-amount" label={t("amount")} value={amount} onChange={setAmount} error={validation === "dateRequired" ? undefined : error} />
    {dateLabel ? <div className={ui.field}><label id="dialog-date-label" htmlFor="dialog-date">{dateLabel}</label><DateInput min={minDate} max={calendar?.businessDate} today={calendar?.businessDate} id="dialog-date" aria-labelledby="dialog-date-label" value={date} onValueChange={setDate} aria-invalid={validation === "dateRequired"} aria-describedby={validation === "dateRequired" ? "dialog-date-error" : undefined} />{validation === "dateRequired" ? <small id="dialog-date-error" className={ui.fieldError} role="alert">{t("dateRequired")}</small> : null}</div> : null}
    <div className={ui.dialogActions}><button type="button" className={ui.secondaryButton} onClick={onClose}>{t("cancel")}</button><button className={ui.primaryButton} disabled={busy || stale} type="submit">{t("save")}</button></div>
  </form></Dialog>;
}
