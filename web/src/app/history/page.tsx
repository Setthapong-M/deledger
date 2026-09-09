"use client";

import { ui } from "@/components/ui-styles";

import { AppShell } from "@/components/app-shell";
import { HistoryExplorer } from "@/components/history-explorer";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  title: { th: "ย้อนหลัง", en: "History" },
  description: { th: "ดูยอดเงินและรายจ่ายในแต่ละเดือน", en: "Your balances and spending, month by month." },
} satisfies Messages;

export default function HistoryPage() {
  const { t } = useCopy(copy);
  return <AppShell><div className={ui.pageHeading}><div><h1>{t("title")}</h1><p className={`${ui.helperText} mb-0`}>{t("description")}</p></div></div><HistoryExplorer /></AppShell>;
}
