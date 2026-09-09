"use client";

import { ui } from "@/components/ui-styles";

import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  title: { th: "โหลดหน้านี้ไม่ได้", en: "This page couldn’t load" },
  help: { th: "ลองโหลดหน้าอีกครั้ง", en: "Try loading this page again." },
  retry: { th: "ลองใหม่", en: "Try again" },
} satisfies Messages;

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useCopy(copy);
  useEffect(() => { console.error(error); }, [error]);
  return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>{t("title")}</h1><p>{t("help")}</p><button className={ui.primaryButton} type="button" onClick={reset}>{t("retry")}</button></section></AppShell>;
}
