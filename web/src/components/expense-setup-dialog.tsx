"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState, type FormEvent } from "react";
import type { SetupKind } from "@/lib/api-client";
import { Dialog } from "./dialog";
import { MoneyField } from "./money-field";

export type SetupDraft = { name: string; kind: SetupKind; fixedAmount: string | null };

export function ExpenseSetupDialog({ initial, onSave, onClose }: { initial?: SetupDraft; onSave: (draft: SetupDraft) => Promise<void> | void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<SetupKind>(initial?.kind ?? "variable");
  const [fixedAmount, setFixedAmount] = useState(initial?.fixedAmount ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setFixedAmount(kind === "fixed" ? (initial?.fixedAmount ?? "") : ""); }, [kind, initial?.fixedAmount]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) { setError("กรุณากรอกรายละเอียด"); return; }
    if (kind === "fixed" && !fixedAmount.trim()) { setError("กรุณากรอกยอดประจำ"); return; }
    try { await onSave({ name: name.trim(), kind, fixedAmount: kind === "fixed" ? fixedAmount : null }); onClose(); } catch (reason) { setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
  }
  return <Dialog title={initial ? "แก้รายการรายจ่ายประจำ" : "เพิ่มรายการรายจ่ายประจำ"} description="รายการนี้เป็น snapshot ของเดือนปัจจุบัน" onClose={onClose}>
    <form className={ui.dialogForm} onSubmit={submit}>
      <label className={ui.field} htmlFor="setup-name"><span>รายละเอียดรายจ่าย</span><input id="setup-name" type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /></label>
      <fieldset className={ui.choiceField}><legend>ประเภท</legend><label><input type="radio" name="setup-kind" value="fixed" checked={kind === "fixed"} onChange={() => setKind("fixed")} /> Fixed — มียอดประจำ</label><label><input type="radio" name="setup-kind" value="variable" checked={kind === "variable"} onChange={() => setKind("variable")} /> Variable — กรอกยอดเมื่อจ่าย</label></fieldset>
      {kind === "fixed" ? <MoneyField id="setup-fixed-amount" label="ยอดประจำ" value={fixedAmount} onChange={setFixedAmount} error={error ?? undefined} /> : error ? <p className={ui.fieldError} role="alert">{error}</p> : null}
      <div className={ui.dialogActions}><button type="button" className={ui.secondaryButton} onClick={onClose}>ยกเลิก</button><button type="submit" className={ui.primaryButton}>บันทึกรายการ</button></div>
    </form>
  </Dialog>;
}
