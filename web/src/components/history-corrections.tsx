"use client";

import { useState } from "react";
import { api, ApiClientError, type MonthView } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";
import { BalanceDialog } from "./balance-dialog";
import { ui } from "./ui-styles";
import { formatDate } from "@/lib/format";
import { monthEnd } from "./tracking-form";

const copy = {
  income: { th: "แก้ไขรายรับ", en: "Edit income" },
  ending: { th: "แก้ไขยอดสิ้นเดือน", en: "Edit closing balance" },
  period: { th: "รายรับตั้งแต่ {from} ถึง {to}", en: "Income from {from} through {to}" },
} satisfies Messages;

export function HistoryCorrections({ view, onChange }: { view: MonthView; onChange: (view: MonthView) => void }) {
  const { t, locale } = useCopy(copy);
  const [dialog, setDialog] = useState<"income" | "ending" | null>(null);
  const [target, setTarget] = useState(view);
  async function save(amount: string, _date?: string, clock?: string | null) {
    try {
      const next = dialog === "income" ? await api.income(target.month, amount, target.revision, clock) : await api.endingBalance(target.month, amount, target.revision, clock);
      onChange(next);
      for (const month of next.affectedMonthKeys.filter(key => key !== next.month)) {
        const dependent = await api.month(month);
        if (dependent.openingSource === "prior_ending") onChange(dependent);
      }
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.current) { onChange(reason.current); setTarget(reason.current); }
      throw reason;
    }
  }
  return <div className="my-4 flex flex-wrap gap-3">
    {view.allowedActions.editIncome ? <button className={ui.secondaryButton} onClick={() => { setTarget(view); setDialog("income"); }}>{t("income")}</button> : null}
    {view.allowedActions.editEndingBalance ? <button className={ui.secondaryButton} onClick={() => { setTarget(view); setDialog("ending"); }}>{t("ending")}</button> : null}
    {dialog ? <BalanceDialog title={dialog === "income" && target.isPartial ? t("period", { from: formatDate(target.trackedFrom, locale), to: formatDate(monthEnd(target.month), locale) }) : t(dialog)} initialValue={(dialog === "income" ? target.summary.income : target.summary.endingBalance) ?? ""} onClose={() => setDialog(null)} onSubmit={save} /> : null}
  </div>;
}
