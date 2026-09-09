"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LifecycleForm } from "@/components/lifecycle-form";
import { api, isAuthenticationError, type Bootstrap } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";
import { useCalendar } from "@/lib/calendar";

const messages = {
  checking: { th: "กำลังเตรียมข้อมูล…", en: "Getting ready…" },
  unavailable: { th: "เปิดหน้านี้ไม่ได้", en: "Can’t open this page" },
  retry: { th: "ลองใหม่", en: "Try again" },
  startEyebrow: { th: "เริ่มต้นกัน", en: "Let’s get started" },
  resumeEyebrow: { th: "ยินดีต้อนรับกลับ", en: "Welcome back" },
  startTitle: { th: "เริ่มบันทึกรายรับรายจ่าย", en: "Start tracking your money" },
  resumeTitle: { th: "เริ่มต่อจากเดือนนี้", en: "Pick up from this month" },
  startDescription: { th: "ใส่ยอดที่รู้ตอนนี้ แล้วค่อยเติมรายละเอียดได้", en: "Enter the amounts you know. You can add details later." },
  resumeDescription: { th: "เราจะทำเครื่องหมายช่วงที่ขาดไว้ ไม่ต้องกรอกย้อนหลัง", en: "We’ll mark the gap in your records. No need to fill it in." },
} satisfies Messages;

export function LifecyclePage({ mode }: { mode: "start" | "resume" }) {
  const { calendar } = useCalendar();
  const { t, errorMessage } = useCopy(messages);
  const [state, setState] = useState<"checking" | "ready" | "error">("checking");
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    void api.bootstrap().then((bootstrap: Bootstrap) => {
      if (!active) return;
      const expected = mode === "start" ? "onboarding_required" : "resume_required";
      if (bootstrap.state !== expected) {
        const destination = bootstrap.state === "onboarding_required" ? "/start" : bootstrap.state === "resume_required" ? "/resume" : "/month";
        window.location.assign(destination);
        return;
      }
      setState("ready");
    }).catch((reason) => {
      if (!active) return;
      if (isAuthenticationError(reason)) {
        window.location.assign("/login");
        return;
      }
      setError(reason);
      setState("error");
    });
    return () => { active = false; };
  }, [mode, calendar?.clockRevision, calendar?.businessDate]);

  if (state === "checking") return <AppShell><section className={`${ui.card} ${ui.emptyState}`} aria-live="polite"><p>{t("checking")}</p></section></AppShell>;
  if (state === "error") return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>{t("unavailable")}</h1><p>{errorMessage(error)}</p><button className={ui.primaryButton} type="button" onClick={() => window.location.reload()}>{t("retry")}</button></section></AppShell>;
  return <AppShell><section className={`mx-auto mt-[8vh] mb-0 w-full max-w-[620px] [&>p:not(:first-child)]:leading-[1.65] [&>p:not(:first-child)]:text-muted-ink ${ui.card}`} aria-labelledby={`${mode}-title`}><p className={ui.eyebrow}>{t(mode === "start" ? "startEyebrow" : "resumeEyebrow")}</p><h1 id={`${mode}-title`}>{t(mode === "start" ? "startTitle" : "resumeTitle")}</h1><p>{t(mode === "start" ? "startDescription" : "resumeDescription")}</p><LifecycleForm mode={mode} /></section></AppShell>;
}
