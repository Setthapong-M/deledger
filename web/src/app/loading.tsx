"use client";

import { ui } from "@/components/ui-styles";
import { AppShell } from "@/components/app-shell";
import { useLocale } from "@/lib/i18n";

export default function Loading() {
  const { locale } = useLocale();
  return <AppShell><section className="grid gap-[18px]" aria-busy="true" aria-label={locale === "th" ? "กำลังโหลด" : "Loading"}><div className={`${ui.skeleton} h-[220px]`} /><div className={`${ui.skeleton} h-80`} /></section></AppShell>;
}
