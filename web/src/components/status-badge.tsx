"use client";

import { Icon, type IconName } from "./icon";

import { ui } from "@/components/ui-styles";
import type { ReconciliationState } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  draft: { th: "กำลังกรอก", en: "In progress" },
  needs_information: { th: "ข้อมูลไม่ครบ", en: "Needs information" },
  inconsistent: { th: "ยอดไม่ตรงกัน", en: "Balances don’t match" },
  reconciled: { th: "ยอดตรงกัน", en: "Balances match" },
  partialMonth: { th: "เริ่มกลางเดือน", en: "Started mid-month" },
} satisfies Messages;

export function StatusText({ state }: { state: ReconciliationState }) {
  const { t } = useCopy(copy);
  return t(state);
}

const statusSymbol: Record<ReconciliationState, IconName> = {
  draft: "unchecked",
  needs_information: "info",
  inconsistent: "warning",
  reconciled: "checked",
};

export function StatusBadge({ state, partial = false }: { state: ReconciliationState; partial?: boolean }) {
  const { t } = useCopy(copy);
  return (
    <span className={ui.statusBadge} data-state={state === "needs_information" ? "needs-information" : state}>
      <Icon name={statusSymbol[state]} className="size-4" />
      <span>{t(state)}</span>
      {partial ? <span className="font-medium">· {t("partialMonth")}</span> : null}
    </span>
  );
}
