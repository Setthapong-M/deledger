"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LocalLoginForm } from "@/components/local-login-form";
import { AppShell } from "@/components/app-shell";
import { api, type AuthMode } from "@/lib/api-client";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api.authMode().then(setMode).catch((reason) => setError(reason instanceof Error ? reason.message : "บริการยังไม่พร้อมใช้งาน")); }, []);
  return <AppShell><section className="lifecycle-page card" aria-labelledby="login-title"><p className="eyebrow">DELEDGER LOCAL</p><h1 id="login-title">เข้าสู่ระบบ</h1>{error ? <p className="field-error" role="alert">{error}</p> : null}{mode?.environment === "local" ? <><p>เลือก User สำหรับการพัฒนา โดยใช้ email หรือเบอร์มือถือไทย</p><LocalLoginForm /></> : mode?.environment === "qas" ? <><p>QAS ใช้ Cloudflare Access ตามปกติ หลังผ่าน Cloudflare ให้เปิด Deledger อีกครั้ง</p><Link className="primary-button" href="/">กลับไป Deledger</Link></> : <p>กำลังตรวจสอบ environment…</p>}</section></AppShell>;
}
