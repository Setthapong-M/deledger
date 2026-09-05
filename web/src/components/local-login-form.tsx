"use client";

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
  return <form className="lifecycle-form" onSubmit={submit}>
    {error ? <FeedbackBanner tone="warning">{error}</FeedbackBanner> : null}
    <label className="field" htmlFor="login-identifier"><span>อีเมลหรือเบอร์โทร</span><input id="login-identifier" name="identifier" type="text" inputMode="email" autoComplete="username" placeholder="Phone number or email" value={identifier} onChange={(event) => setIdentifier(event.target.value)} disabled={busy} required aria-describedby="login-help" /></label>
    <p id="login-help" className="helper-text">Local development ไม่ต้องใช้ password หรือ OTP</p>
    <button className="primary-button" type="submit" disabled={busy || identifier.trim() === ""}>{busy ? "กำลังเข้าสู่ระบบ…" : "ดำเนินการต่อ"}</button>
  </form>;
}
