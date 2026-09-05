"use client";

import { ui } from "@/components/ui-styles";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api-client";
import { FeedbackBanner } from "./feedback-banner";

export function LocalLoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try { await api.login(identifier); router.replace("/"); router.refresh(); }
    catch (reason) { setError(reason instanceof ApiClientError ? reason.message : "เข้าสู่ระบบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <form className="mt-[26px] grid gap-[18px]" onSubmit={submit}>
    {error ? <FeedbackBanner tone="warning">{error}</FeedbackBanner> : null}
    <label className={ui.field} htmlFor="login-identifier"><span>อีเมลหรือเบอร์โทร</span><input id="login-identifier" name="identifier" type="text" inputMode="email" autoComplete="username" placeholder="Phone number or email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={busy} required aria-describedby="login-help" /></label>
    <p id="login-help" className={ui.helperText}>Local development ไม่ต้องใช้ password หรือ OTP</p>
    <button className={ui.primaryButton} type="submit" disabled={busy || identifier.trim() === ""}>{busy ? "กำลังเข้าสู่ระบบ…" : "ดำเนินการต่อ"}</button>
  </form>;
}
