"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError, isAuthenticationError, type UserProfile } from "@/lib/api-client";
import { FeedbackBanner } from "./feedback-banner";

export function ProfileForm({ environment }: { environment: "local" | "qas" }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  function expireSession() {
    setProfile(null);
    setEmail("");
    setPhone("");
    setDateOfBirth("");
    setMessage(null);
    setError(null);
    setFieldErrors({});
    window.location.assign("/login");
  }
  useEffect(() => { void api.profile().then((next) => { setProfile(next); setEmail(next.email ?? ""); setPhone(next.phone ?? ""); setDateOfBirth(next.dateOfBirth ?? ""); }).catch((reason) => { if (isAuthenticationError(reason)) { expireSession(); return; } setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ"); }); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setFieldErrors({}); setMessage(null);
    try { const next = await api.updateProfile({ ...(environment === "local" ? { email: email || null, phone: phone || null } : {}), dateOfBirth: dateOfBirth || null }); setProfile(next); setEmail(next.email ?? ""); setPhone(next.phone ?? ""); setDateOfBirth(next.dateOfBirth ?? ""); setMessage("บันทึกข้อมูลแล้ว"); }
    catch (reason) { if (isAuthenticationError(reason)) { expireSession(); return; } if (reason instanceof ApiClientError) { setError(reason.message); if (reason.field) setFieldErrors({ [reason.field]: reason.message }); } else setError("บันทึกข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  if (error && !profile) return <section className="card empty-state"><FeedbackBanner tone="warning">{error}</FeedbackBanner></section>;
  return <form className="profile-form card" onSubmit={submit}>
    {error ? <FeedbackBanner tone="warning">{error}</FeedbackBanner> : null}{message ? <FeedbackBanner>{message}</FeedbackBanner> : null}
    <label className="field" htmlFor="profile-email"><span>อีเมล</span><input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={environment === "qas"} aria-invalid={Boolean(fieldErrors.email)} aria-describedby="profile-email-help profile-email-error" /><span id="profile-email-help" className="helper-text">{profile?.email ?? "ยังไม่ได้ระบุ"}</span>{fieldErrors.email ? <small id="profile-email-error" className="field-error" role="alert">{fieldErrors.email}</small> : null}</label>
    <label className="field" htmlFor="profile-phone"><span>เบอร์โทร</span><input id="profile-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} readOnly={environment === "qas"} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby="profile-phone-help profile-phone-error" /><span id="profile-phone-help" className="helper-text">{profile?.phone ?? "ยังไม่ได้ระบุ"}</span>{fieldErrors.phone ? <small id="profile-phone-error" className="field-error" role="alert">{fieldErrors.phone}</small> : null}</label>
    <label className="field" htmlFor="profile-date-of-birth"><span>วันเดือนปีเกิด</span><input id="profile-date-of-birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} aria-invalid={Boolean(fieldErrors.dateOfBirth)} aria-describedby="profile-date-of-birth-help profile-date-of-birth-error" /><span id="profile-date-of-birth-help" className="helper-text">{profile?.dateOfBirth ?? "ยังไม่ได้ระบุ"}</span><span className="helper-text">ข้อมูลนี้ไม่บังคับ</span>{fieldErrors.dateOfBirth ? <small id="profile-date-of-birth-error" className="field-error" role="alert">{fieldErrors.dateOfBirth}</small> : null}</label>
    <button className="primary-button" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button>
  </form>;
}
