"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LocalLoginForm } from "@/components/local-login-form";
import { AppShell } from "@/components/app-shell";
import { api, type AuthMode } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";

const messages = {
  eyebrow: { th: "DELEDGER", en: "DELEDGER" },
  title: { th: "เข้าสู่ระบบ", en: "Sign in" },
  localDescription: { th: "เข้าใช้บนเครื่องนี้ด้วยอีเมลหรือเบอร์มือถือไทย สำหรับทดสอบเท่านั้น", en: "Sign in locally with an email or Thai mobile number. For testing only." },
  accessDescription: { th: "เข้าสู่ระบบผ่าน Cloudflare Access แล้วกลับมาเปิด Deledger", en: "Sign in through Cloudflare Access, then return to Deledger." },
  back: { th: "กลับไป Deledger", en: "Back to Deledger" },
  checking: { th: "กำลังตรวจสอบการเข้าสู่ระบบ…", en: "Checking sign-in options…" },
} satisfies Messages;

export default function LoginPage() {
  const { t, errorMessage } = useCopy(messages);
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { void api.authMode().then(setMode).catch((reason) => setError(reason)); }, []);
  return <AppShell><section className={`mx-auto mt-[8vh] mb-0 w-full max-w-[620px] [&>p:not(:first-child)]:leading-[1.65] [&>p:not(:first-child)]:text-muted-ink ${ui.card}`} aria-labelledby="login-title"><p className={ui.eyebrow}>{t("eyebrow")}</p><h1 id="login-title">{t("title")}</h1>{error !== null ? <p className={ui.fieldError} role="alert">{errorMessage(error)}</p> : null}{mode?.environment === "local" ? <><p>{t("localDescription")}</p><LocalLoginForm /></> : mode?.environment === "qas" ? <><p>{t("accessDescription")}</p><Link className={ui.primaryButton} href="/">{t("back")}</Link></> : <p>{t("checking")}</p>}</section></AppShell>;
}
