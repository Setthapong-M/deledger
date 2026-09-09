"use client";

import { ui } from "@/components/ui-styles";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  dismiss: { th: "ปิด", en: "Dismiss" },
} satisfies Messages;
export function FeedbackBanner({ children, tone = "neutral", onDismiss }: { children: React.ReactNode; tone?: "neutral" | "warning"; onDismiss?: () => void }) {
  const { t } = useCopy(copy);
  return <div className="my-3 flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-muted px-3.5 py-3 data-warning:border-2 data-warning:border-double data-warning:border-state-strong" data-warning={tone === "warning" ? "" : undefined} role="status"><span>{children}</span>{onDismiss ? <button type="button" className={ui.textButton} onClick={onDismiss}>{t("dismiss")}</button> : null}</div>;
}
