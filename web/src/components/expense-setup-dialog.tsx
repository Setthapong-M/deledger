"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState, type FormEvent } from "react";
import type { SetupKind } from "@/lib/api-client";
import { Dialog } from "./dialog";
import { MoneyField } from "./money-field";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  editTitle: { th: "แก้ไขรายจ่ายประจำ", en: "Edit recurring expense" },
  addTitle: { th: "เพิ่มรายจ่ายประจำ", en: "Add recurring expense" },
  description: { th: "แก้ไขรายการของเดือนนี้เท่านั้น", en: "Changes apply to this month only" },
  name: { th: "ชื่อรายจ่าย", en: "Expense name" },
  kind: { th: "ประเภท", en: "Type" },
  fixed: { th: "ยอดคงที่", en: "Fixed amount" },
  variable: { th: "กรอกตอนจ่าย", en: "Enter when paid" },
  nameRequired: { th: "กรอกชื่อรายจ่ายก่อนนะ", en: "Enter an expense name first" },
  amountRequired: { th: "กรอกยอดคงที่ก่อนนะ", en: "Enter the fixed amount first" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
  save: { th: "บันทึกรายการ", en: "Save expense" },
} satisfies Messages;

export type SetupDraft = { name: string; kind: SetupKind; fixedAmount: string | null };

export function ExpenseSetupDialog({ initial, onSave, onClose }: { initial?: SetupDraft; onSave: (draft: SetupDraft) => Promise<void> | void; onClose: () => void }) {
  const { t, errorMessage } = useCopy(copy);
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<SetupKind>(initial?.kind ?? "variable");
  const [fixedAmount, setFixedAmount] = useState(initial?.fixedAmount ?? "");
  const [failure, setFailure] = useState<{ reason: unknown } | null>(null);
  const [validation, setValidation] = useState<"nameRequired" | "amountRequired" | null>(null);
  const error = validation ? t(validation) : failure ? errorMessage(failure.reason) : undefined;
  useEffect(() => { setFixedAmount(kind === "fixed" ? (initial?.fixedAmount ?? "") : ""); }, [kind, initial?.fixedAmount]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidation(null);
    if (!name.trim()) { setValidation("nameRequired"); return; }
    if (kind === "fixed" && !fixedAmount.trim()) { setValidation("amountRequired"); return; }
    try { await onSave({ name: name.trim(), kind, fixedAmount: kind === "fixed" ? fixedAmount : null }); onClose(); } catch (reason) { setFailure({ reason }); }
  }
  return <Dialog title={t(initial ? "editTitle" : "addTitle")} description={t("description")} onClose={onClose}>
    <form className={ui.dialogForm} onSubmit={submit}>
      <label className={ui.field} htmlFor="setup-name"><span>{t("name")}</span><input id="setup-name" type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" /></label>
      <fieldset className={ui.choiceField}><legend>{t("kind")}</legend><label><input type="radio" name="setup-kind" value="fixed" checked={kind === "fixed"} onChange={() => setKind("fixed")} /> {t("fixed")}</label><label><input type="radio" name="setup-kind" value="variable" checked={kind === "variable"} onChange={() => setKind("variable")} /> {t("variable")}</label></fieldset>
      {kind === "fixed" ? <MoneyField id="setup-fixed-amount" label={t("fixed")} value={fixedAmount} onChange={setFixedAmount} error={error} /> : error ? <p className={ui.fieldError} role="alert">{error}</p> : null}
      <div className={ui.dialogActions}><button type="button" className={ui.secondaryButton} onClick={onClose}>{t("cancel")}</button><button type="submit" className={ui.primaryButton}>{t("save")}</button></div>
    </form>
  </Dialog>;
}
