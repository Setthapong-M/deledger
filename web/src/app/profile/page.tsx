"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { api, type AuthMode } from "@/lib/api-client";

export default function ProfilePage() {
  const [mode, setMode] = useState<AuthMode | null>(null);
  useEffect(() => { void api.authMode().then(setMode); }, []);
  return <AppShell><div className={ui.pageHeading}><div><p className={ui.eyebrow}>พื้นที่ของคุณ</p><h1>ข้อมูลส่วนตัว</h1><p className={`${ui.helperText} mb-0`}>จัดการข้อมูลติดต่อและข้อมูลส่วนตัวของคุณ</p></div></div>{mode?.environment === "local" || mode?.environment === "qas" ? <ProfileForm environment={mode.environment} /> : <section className={`${ui.card} ${ui.emptyState}`}>กำลังโหลดข้อมูลส่วนตัว…</section>}</AppShell>;
}
