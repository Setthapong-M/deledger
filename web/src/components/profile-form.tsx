"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiClientError, isAuthenticationError, type UserProfile } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { FeedbackBanner } from "./feedback-banner";
import { DateInput } from "./date-input";

const messages = {
  email: { th: "อีเมล", en: "Email" },
  phone: { th: "เบอร์โทร", en: "Phone number" },
  dateOfBirth: { th: "วันเกิด", en: "Date of birth" },
  notProvided: { th: "ยังไม่ได้ระบุ", en: "Not provided" },
  contactHelp: { th: "เก็บอีเมลหรือเบอร์มือถือไว้อย่างน้อยหนึ่งช่องทางเพื่อเข้าสู่ระบบ", en: "Keep at least one email or mobile number to sign in." },
  readOnlyHelp: { th: "ข้อมูลติดต่อดูได้อย่างเดียว หากต้องการเปลี่ยน ติดต่อผู้ดูแล", en: "Contact details are read-only. Contact your administrator to change them." },
  optional: { th: "ไม่บังคับ", en: "Optional" },
  saved: { th: "บันทึกข้อมูลแล้ว", en: "Profile saved" },
  saving: { th: "กำลังบันทึก…", en: "Saving…" },
  save: { th: "บันทึกข้อมูล", en: "Save profile" },
} satisfies Messages;

export function ProfileForm({ environment }: { environment: "local" | "qas" }) {
  const { locale, t, errorMessage } = useCopy(messages);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [message, setMessage] = useState<"saved" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, ApiClientError>>({});
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
  useEffect(() => {
    let active = true;
    void api.profile().then((next) => {
      if (!active) return;
      setProfile(next);
      setEmail(next.email ?? "");
      setPhone(next.phone ?? "");
      setDateOfBirth(next.dateOfBirth ?? "");
    }).catch((reason) => {
      if (!active) return;
      if (isAuthenticationError(reason)) { expireSession(); return; }
      setError(reason);
    });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setFieldErrors({}); setMessage(null);
    try { const next = await api.updateProfile({ ...(environment === "local" ? { email: email || null, phone: phone || null } : {}), dateOfBirth: dateOfBirth || null }); setProfile(next); setEmail(next.email ?? ""); setPhone(next.phone ?? ""); setDateOfBirth(next.dateOfBirth ?? ""); setMessage("saved"); }
    catch (reason) { if (isAuthenticationError(reason)) { expireSession(); return; } setError(reason); if (reason instanceof ApiClientError && reason.field) setFieldErrors({ [reason.field]: reason }); }
    finally { setBusy(false); }
  }
  if (error !== null && !profile) return <section className={`${ui.card} ${ui.emptyState}`}><FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner></section>;
  return <form className={`mx-auto w-full max-w-[680px] grid gap-6 [&_input[readonly]]:bg-surface-muted [&_input[readonly]]:text-muted-ink ${ui.card}`} onSubmit={submit}>
    {error !== null ? <FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner> : null}{message ? <FeedbackBanner>{t(message)}</FeedbackBanner> : null}
    <p id="profile-contact-help" className={`${ui.helperText} m-0`}>{t(environment === "local" ? "contactHelp" : "readOnlyHelp")}</p>
    <label className={ui.field} htmlFor="profile-email"><span id="profile-email-label">{t("email")}</span><input aria-labelledby="profile-email-label" id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} readOnly={environment === "qas"} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "profile-contact-help profile-email-error" : "profile-contact-help"} />{fieldErrors.email ? <small id="profile-email-error" className={ui.fieldError} role="alert">{errorMessage(fieldErrors.email)}</small> : null}</label>
    <label className={ui.field} htmlFor="profile-phone"><span id="profile-phone-label">{t("phone")}</span><input aria-labelledby="profile-phone-label" id="profile-phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} readOnly={environment === "qas"} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "profile-contact-help profile-phone-error" : "profile-contact-help"} />{fieldErrors.phone ? <small id="profile-phone-error" className={ui.fieldError} role="alert">{errorMessage(fieldErrors.phone)}</small> : null}</label>
    <div className={ui.field}><label htmlFor="profile-date-of-birth" id="profile-date-of-birth-label">{t("dateOfBirth")}</label><DateInput aria-labelledby="profile-date-of-birth-label" id="profile-date-of-birth" value={dateOfBirth} onValueChange={setDateOfBirth} aria-invalid={Boolean(fieldErrors.dateOfBirth)} aria-describedby={fieldErrors.dateOfBirth ? "profile-date-of-birth-help profile-date-of-birth-error" : "profile-date-of-birth-help"} /><span id="profile-date-of-birth-help" className={`${ui.helperText} block font-normal`}>{profile?.dateOfBirth ? formatDate(profile.dateOfBirth, locale) : t("notProvided")}</span><span className={`${ui.helperText} block font-normal`}>{t("optional")}</span>{fieldErrors.dateOfBirth ? <small id="profile-date-of-birth-error" className={ui.fieldError} role="alert">{errorMessage(fieldErrors.dateOfBirth)}</small> : null}</div>
    <button className={ui.primaryButton} type="submit" disabled={busy || !profile}>{t(busy ? "saving" : "save")}</button>
  </form>;
}
