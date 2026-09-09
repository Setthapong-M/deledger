"use client";

import { ui } from "@/components/ui-styles";

import { useState, type FormEvent } from "react";
import { api, ApiClientError, isAuthenticationError, type MonthView } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";
import { MoneyField } from "./money-field";
import { FeedbackBanner } from "./feedback-banner";
import { TrackingForm } from "./tracking-form";
import { useCalendar } from "@/lib/calendar";

const messages = {
  openingBalance: { th: "ยอดเงินตั้งต้น", en: "Opening balance" },
  income: { th: "รายรับเดือนนี้", en: "This month’s income" },
  help: { th: "ไม่มีรายรับ ใส่ 0 ได้ ไม่ต้องกรอกเดือนที่ขาดย้อนหลัง", en: "Enter 0 if you have no income. No need to fill in missing months." },
  saving: { th: "กำลังบันทึก…", en: "Saving…" },
  resume: { th: "เริ่มติดตามต่อ", en: "Resume tracking" },
  start: { th: "เริ่มเดือนแรก", en: "Start first month" },
  review: { th: "ตรวจวันที่และยอดเงิน", en: "Review date and amounts" },
  changed: { th: "วันที่ระบบเปลี่ยนแล้ว ตรวจยอดเงินให้ตรงกับวันที่ใหม่ก่อนบันทึก", en: "The system date changed. Review your amounts for the new date before saving." },
} satisfies Messages;

export function LifecycleForm({ mode, onComplete }: { mode: "start" | "resume"; onComplete?: (month: MonthView) => void }) {
  const { calendar } = useCalendar();
  const [clock, setClock] = useState(calendar?.clockRevision);
  const [needsReview, setNeedsReview] = useState(false);
  const stale = needsReview || calendar !== null && clock !== calendar.clockRevision;
  const { t, errorMessage } = useCopy(messages);
  const [openingBalance, setOpeningBalance] = useState("");
  const [income, setIncome] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const isResume = mode === "resume";
  async function review() {
    setBusy(true);
    try {
      const current = await api.bootstrap();
      if (current.state !== "resume_required") { window.location.assign("/month"); return; }
      setClock(calendar?.clockRevision); setNeedsReview(false); setError(null);
    } catch (reason) { setError(reason); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) return;
    setError(null);
    setBusy(true);
    try {
      const month = isResume ? await api.resume({ openingBalance, income }, clock) : await api.onboarding({ openingBalance, income }, clock);
      onComplete?.(month);
      if (!onComplete) window.location.assign("/month");
    } catch (reason) {
      if (isAuthenticationError(reason)) { window.location.assign("/login"); return; }
      setError(reason);
      if (reason instanceof ApiClientError && reason.code === "CLOCK_CONFLICT") setNeedsReview(true);
    } finally {
      setBusy(false);
    }
  }

  if (!isResume && calendar) return <TrackingForm mode="start" onComplete={onComplete} />;
  return (
    <form className="mt-[26px] grid gap-[18px]" onSubmit={submit}>
      {error !== null ? <FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner> : null}
      {stale ? <><p role="status">{t("changed")}</p><button type="button" className={ui.secondaryButton} disabled={busy} onClick={() => void review()}>{t("review")}</button></> : null}
      <MoneyField id="opening-balance" label={t("openingBalance")} value={openingBalance} onChange={setOpeningBalance} disabled={busy} />
      <MoneyField id="income" label={t("income")} value={income} onChange={setIncome} disabled={busy} />
      <p className={ui.helperText}>{t("help")}</p>
      <button className={ui.primaryButton} type="submit" disabled={busy || stale || openingBalance === "" || income === ""}>{t(busy ? "saving" : isResume ? "resume" : "start")}</button>
    </form>
  );
}
