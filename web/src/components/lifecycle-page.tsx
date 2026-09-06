"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { LifecycleForm } from "@/components/lifecycle-form";
import { api, isAuthenticationError, type Bootstrap } from "@/lib/api-client";

export function LifecyclePage({ mode }: { mode: "start" | "resume" }) {
  const [state, setState] = useState<"checking" | "ready" | "error">("checking");
  const [error, setError] = useState<string | null>(null);

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
      setError(reason instanceof Error ? reason.message : "โหลดสถานะไม่สำเร็จ");
      setState("error");
    });
    return () => { active = false; };
  }, [mode]);

  if (state === "checking") return <AppShell><section className={`${ui.card} ${ui.emptyState}`} aria-live="polite"><p>กำลังตรวจสอบสิทธิ์…</p></section></AppShell>;
  if (state === "error") return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>เข้าถึงหน้านี้ไม่ได้</h1><p>{error}</p><button className={ui.primaryButton} type="button" onClick={() => window.location.reload()}>ลองใหม่</button></section></AppShell>;
  return <AppShell><section className={`mx-auto mt-[8vh] mb-0 w-full max-w-[620px] [&>p:not(:first-child)]:leading-[1.65] [&>p:not(:first-child)]:text-muted-ink ${ui.card}`} aria-labelledby={`${mode}-title`}><p className={ui.eyebrow}>{mode === "start" ? "เริ่มต้นติดตาม" : "กลับมาเริ่มใหม่"}</p><h1 id={`${mode}-title`}>{mode === "start" ? "เริ่มบัญชีรายรับรายจ่าย" : "เริ่มติดตามจากเดือนนี้"}</h1><p>{mode === "start" ? "กรอกยอดที่รู้ตอนนี้ แล้วค่อยเติมรายละเอียดระหว่างเดือนได้ ไม่ต้องรอรอบหรือจำทุกรายการ" : "ช่วงก่อนหน้าจะถูกทำเครื่องหมายเป็นช่วงข้อมูลขาด ไม่ต้องย้อนสร้างรายการเดิม"}</p><LifecycleForm mode={mode} /></section></AppShell>;
}
