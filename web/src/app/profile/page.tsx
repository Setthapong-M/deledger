"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { api, type AuthMode } from "@/lib/api-client";

export default function ProfilePage() {
  const [mode, setMode] = useState<AuthMode | null>(null);
  useEffect(() => { void api.authMode().then(setMode); }, []);
  return <AppShell><div className="page-heading"><div><p className="eyebrow">YOUR PROFILE</p><h1>ข้อมูลส่วนตัว</h1><p className="helper-text">ข้อมูลของ User ที่กำลังเข้าสู่ระบบ</p></div></div>{mode?.environment === "local" || mode?.environment === "qas" ? <ProfileForm environment={mode.environment} /> : <section className="card empty-state">กำลังตรวจสอบ environment…</section>}</AppShell>;
}
