"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api, type Bootstrap } from "@/lib/api-client";

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void api.bootstrap().then((state: Bootstrap) => { if (!active) return; router.replace(state.state === "onboarding_required" ? "/start" : state.state === "resume_required" ? "/resume" : "/month"); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "ระบบยังไม่พร้อม"); });
    return () => { active = false; };
  }, [router]);
  return <AppShell><section className="card empty-state" aria-live="polite"><p className="eyebrow">DELEDGER PRIVATE BETA</p><h1>{error ? "เข้าถึงข้อมูลไม่ได้" : "กำลังตรวจสอบสถานะ…"}</h1><p>{error ?? "กำลังเตรียม Financial Boundary ของคุณ"}</p>{error ? <button className="primary-button" type="button" onClick={() => window.location.reload()}>ลองใหม่</button> : null}</section></AppShell>;
}
