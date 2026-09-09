"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile-form";
import { api, type AuthMode } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";

const messages = {
  eyebrow: { th: "พื้นที่ของคุณ", en: "Your space" },
  title: { th: "ข้อมูลส่วนตัว", en: "Profile" },
  description: { th: "ดูและแก้ไขข้อมูลส่วนตัว", en: "View and update your details" },
  loading: { th: "กำลังโหลดข้อมูล…", en: "Loading your profile…" },
} satisfies Messages;

export default function ProfilePage() {
  const { t } = useCopy(messages);
  const [mode, setMode] = useState<AuthMode | null>(null);
  useEffect(() => { void api.authMode().then(setMode); }, []);
  return <AppShell><div className={ui.pageHeading}><div><p className={ui.eyebrow}>{t("eyebrow")}</p><h1>{t("title")}</h1><p className={`${ui.helperText} mb-0`}>{t("description")}</p></div></div>{mode?.environment === "local" || mode?.environment === "qas" ? <ProfileForm environment={mode.environment} /> : <section className={`${ui.card} ${ui.emptyState}`}>{t("loading")}</section>}</AppShell>;
}
