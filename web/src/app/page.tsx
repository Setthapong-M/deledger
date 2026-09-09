"use client";

import { useCopy, type Messages } from "@/lib/i18n";

import { ui } from "@/components/ui-styles";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, isAuthenticationError, type Bootstrap } from "@/lib/api-client";

const copy = {
  error: { th: "โหลดข้อมูลไม่ได้", en: "Your data couldn’t load" },
  loading: { th: "กำลังโหลด…", en: "Loading…" },
  retry: { th: "ลองใหม่", en: "Try again" },
} satisfies Messages;

export default function HomePage() {
  const { t, errorMessage } = useCopy(copy);
  const router = useRouter();
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    void api.bootstrap().then((state: Bootstrap) => { if (!active) return; router.replace(state.state === "onboarding_required" ? "/start" : state.state === "resume_required" ? "/resume" : "/month"); }).catch((reason) => { if (!active) return; if (isAuthenticationError(reason)) { router.replace("/login"); return; } setError(reason); });
    return () => { active = false; };
  }, [router]);
  return <AppShell><section className={`${ui.card} ${ui.emptyState}`} aria-live="polite"><h1>{t(error ? "error" : "loading")}</h1>{error ? <p>{errorMessage(error)}</p> : null}{error ? <button className={ui.primaryButton} type="button" onClick={() => window.location.reload()}>{t("retry")}</button> : null}</section></AppShell>;
}
