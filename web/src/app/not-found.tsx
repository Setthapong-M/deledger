"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ui } from "@/components/ui-styles";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  title: { th: "ไม่พบหน้านี้", en: "Page not found" },
  description: { th: "ลิงก์อาจเปลี่ยนไป กลับไปดูเดือนนี้ได้เลย", en: "This link may have changed. Head back to this month." },
  back: { th: "กลับไปเดือนนี้", en: "Go to this month" },
} satisfies Messages;

export default function NotFound() {
  const { t } = useCopy(copy);
  return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>{t("title")}</h1><p>{t("description")}</p><Link className={ui.primaryButton} href="/month">{t("back")}</Link></section></AppShell>;
}
