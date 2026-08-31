"use client";

import { useState, type FormEvent } from "react";
import { api, ApiClientError, type MonthView } from "@/lib/api-client";
import { MoneyField } from "./money-field";
import { FeedbackBanner } from "./feedback-banner";

export function LifecycleForm({ mode, onComplete }: { mode: "start" | "resume"; onComplete?: (month: MonthView) => void }) {
  const [openingBalance, setOpeningBalance] = useState("");
  const [income, setIncome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isResume = mode === "resume";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const month = isResume ? await api.resume({ openingBalance, income }) : await api.onboarding({ openingBalance, income });
      onComplete?.(month);
      if (!onComplete) window.location.assign("/month");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="lifecycle-form" onSubmit={submit}>
      {error ? <FeedbackBanner tone="warning">{error}</FeedbackBanner> : null}
      <MoneyField id="opening-balance" label="ยอดตั้งต้นที่รู้ตอนนี้" value={openingBalance} onChange={setOpeningBalance} disabled={busy} />
      <MoneyField id="income" label="รายรับของเดือนนี้" value={income} onChange={setIncome} disabled={busy} />
      <p className="helper-text">ใส่ 0 ได้ หากเดือนไม่มีรายรับ และไม่จำเป็นต้องย้อนกรอกเดือนก่อนหน้าที่ข้อมูลขาด</p>
      <button className="primary-button" type="submit" disabled={busy || openingBalance === "" || income === ""}>{busy ? "กำลังบันทึก…" : isResume ? "เริ่มติดตามต่อ" : "เริ่มเดือนแรก"}</button>
    </form>
  );
}
