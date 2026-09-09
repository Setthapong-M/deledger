"use client";

import { ui } from "@/components/ui-styles";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";
import { FeedbackBanner } from "./feedback-banner";

const messages = {
  identifier: { th: "อีเมลหรือเบอร์โทร", en: "Email or phone number" },
  identifierPlaceholder: { th: "อีเมลหรือเบอร์มือถือไทย", en: "Email or Thai mobile number" },
  localHelp: { th: "ใช้เฉพาะบนเครื่องนี้ ไม่ต้องใช้รหัสผ่านหรือ OTP", en: "Local use only. No password or OTP needed." },
  signingIn: { th: "กำลังเข้าสู่ระบบ…", en: "Signing in…" },
  continue: { th: "ดำเนินการต่อ", en: "Continue" },
} satisfies Messages;

export function LocalLoginForm() {
  const { t, errorMessage } = useCopy(messages);
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try { await api.login(identifier); router.replace("/"); router.refresh(); }
    catch (reason) { setError(reason); }
    finally { setBusy(false); }
  }
  return <form className="mt-[26px] grid gap-[18px]" onSubmit={submit}>
    {error !== null ? <FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner> : null}
    <label className={ui.field} htmlFor="login-identifier"><span>{t("identifier")}</span><input id="login-identifier" name="identifier" type="text" inputMode="email" autoComplete="username" placeholder={t("identifierPlaceholder")} value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={busy} required aria-describedby="login-help" /></label>
    <p id="login-help" className={ui.helperText}>{t("localHelp")}</p>
    <button className={ui.primaryButton} type="submit" disabled={busy || identifier.trim() === ""}>{t(busy ? "signingIn" : "continue")}</button>
  </form>;
}
