"use client";

import { useState, type FormEvent } from "react";
import { Dialog } from "./dialog";
import { MoneyField } from "./money-field";

export function BalanceDialog({ title, initialValue = "", dateLabel, onSubmit, onClose }: { title: string; initialValue?: string; dateLabel?: string; onSubmit: (amount: string, date?: string) => Promise<void> | void; onClose: () => void }) {
  const [amount, setAmount] = useState(initialValue);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (amount.trim() === "") { setError("กรุณากรอกยอดเงิน"); return; }
    try { await onSubmit(amount, date || undefined); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
  }
  return <Dialog title={title} onClose={onClose}><form className="dialog-form" onSubmit={submit}>
    <MoneyField id="dialog-amount" label="ยอดเงิน" value={amount} onChange={setAmount} error={error ?? undefined} />
    {dateLabel ? <label className="field" htmlFor="dialog-date"><span>{dateLabel}</span><input id="dialog-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label> : null}
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>ยกเลิก</button><button className="primary-button" type="submit">บันทึก</button></div>
  </form></Dialog>;
}
