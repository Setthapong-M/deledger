"use client";

import { useState, type FormEvent } from "react";
import { api, ApiClientError, isAuthenticationError, type MonthView, type TrackingOptions } from "@/lib/api-client";
import { useCalendar } from "@/lib/calendar";
import { useCopy, type Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { DateInput } from "./date-input";
import { MoneyField } from "./money-field";
import { FeedbackBanner } from "./feedback-banner";
import { ui } from "./ui-styles";

const copy = {
  date: { th: "วันเริ่มติดตาม", en: "Tracking start date" },
  opening: { th: "เงินคงเหลือ ณ วันเริ่ม", en: "Balance on the start date" },
  income: { th: "รายรับตั้งแต่ {from} ถึง {to}", en: "Income from {from} through {to}" },
  start: { th: "เริ่มเดือนแรก", en: "Start first month" },
  backfill: { th: "เพิ่มเดือนย้อนหลัง", en: "Add earlier months" },
  restart: { th: "เริ่มติดตามใหม่", en: "Start fresh" },
  review: { th: "ตรวจวันที่และยอดเงินแล้ว", en: "I have reviewed the date and amounts" },
  changed: { th: "ช่วงวันที่เปลี่ยนแล้ว ตรวจยอดเงินให้ตรงกับช่วงใหม่", en: "The period changed. Check your amounts against the new dates." },
  warning: { th: "เริ่มนับจากวันที่เลือก ยอดก่อนหน้านี้ยังอยู่ แต่จะไม่เชื่อมกับยอดตั้งต้นใหม่", en: "Start from this date. Earlier records stay, but will not set your new starting balance." },
  confirm: { th: "ยืนยันเริ่มติดตามใหม่", en: "Confirm fresh start" },
  range: { th: "{range} · {count} เดือน", en: "{range} · {count} months" },
  historical: { th: "เดือนก่อนหน้าจะปิดโดยยังมีข้อมูลที่ต้องเติม รายรับนี้ใช้เฉพาะเดือนเริ่ม", en: "Past months will be closed with information still to complete. This income belongs only to the start month." },
  supplied: { th: "ยอดตั้งต้นที่ระบุเองของเดือนเดิมจะไม่เปลี่ยน", en: "Existing supplied starting balances will stay unchanged." },
} satisfies Messages;

export function monthEnd(month: string) {
  const [year, number] = month.split("-").map(Number);
  return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`;
}

export function TrackingForm({ mode, options, onComplete }: { mode: "start" | "backfill" | "restart"; options?: TrackingOptions; onComplete?: (view: MonthView, selectedMonth: string) => void }) {
  const { calendar } = useCalendar();
  const { t, locale, errorMessage } = useCopy(copy);
  if (!calendar) return null;
  return <TrackingFields mode={mode} options={options} onComplete={onComplete} businessDate={calendar.businessDate} clock={calendar.clockRevision} t={t} locale={locale} errorMessage={errorMessage} />;
}

function TrackingFields({ mode, options, onComplete, businessDate, clock, t, locale, errorMessage }: {
  mode: "start" | "backfill" | "restart"; options?: TrackingOptions;
  onComplete?: (view: MonthView, selectedMonth: string) => void;
  businessDate: string; clock: string | null;
} & ReturnType<typeof useCopy<typeof copy>>) {
  const [boundary, setBoundary] = useState(options);
  const [token, setToken] = useState(clock);
  const [date, setDate] = useState(mode === "backfill" ? options?.prepend.maxDate ?? "" : businessDate);
  const [openingBalance, setOpening] = useState("");
  const [income, setIncome] = useState("");
  const [reviewed, setReviewed] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const stale = token !== clock;
  const selectedMonth = date.slice(0, 7);
  const end = selectedMonth === businessDate.slice(0, 7) ? businessDate : date ? monthEnd(selectedMonth) : "";
  const range = mode === "backfill" ? boundary?.prepend : mode === "restart" ? boundary?.restart : undefined;
  const first = new Date(`${businessDate.slice(0, 7)}-01T12:00:00Z`);
  first.setUTCMonth(first.getUTCMonth() - 23);
  const min = range?.minDate ?? first.toISOString().slice(0, 10);
  const max = range?.maxDate ?? businessDate;
  const lastMonth = mode === "backfill" && boundary?.earliestMonth
    ? new Date(Date.UTC(Number(boundary.earliestMonth.slice(0, 4)), Number(boundary.earliestMonth.slice(5, 7)) - 1, 0)).toISOString().slice(0, 7)
    : businessDate.slice(0, 7);
  const count = date ? (Number(lastMonth.slice(0, 4)) - Number(date.slice(0, 4))) * 12 + Number(lastMonth.slice(5, 7)) - Number(date.slice(5, 7)) + 1 : 0;
  const valid = !!date && date >= min && date <= max && count > 0 && count <= 24 && (mode === "start" || range?.allowed === true);

  async function review() {
    setBusy(true);
    try {
      if (mode !== "start") setBoundary(await api.trackingOptions());
      setToken(clock); setReviewed(true); setConfirmed(false); setError(null);
    } catch (reason) { setError(reason); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || stale || !reviewed || !valid || !openingBalance || !income) return;
    if (mode === "restart" && !confirmed) { setConfirmed(true); return; }
    setBusy(true); setError(null);
    try {
      const payload = { startDate: date, openingBalance, income };
      const view = mode === "start" ? await api.onboarding(payload, token)
        : mode === "backfill" ? (await api.backfill({ ...payload, expectedEarliestMonth: boundary!.earliestMonth!, expectedEarliestRevision: boundary!.earliestRevision! }, token)).month
        : await api.restart(boundary!.restart.month!, { ...payload, expectedRevision: boundary!.restart.expectedRevision! }, token);
      if (onComplete) onComplete(view, selectedMonth);
      else window.location.assign(mode === "start" && selectedMonth !== businessDate.slice(0, 7) ? `/history?month=${selectedMonth}` : "/month");
    } catch (reason) {
      if (isAuthenticationError(reason)) { window.location.assign("/login"); return; }
      setError(reason);
      if (reason instanceof ApiClientError && reason.status === 409) { setReviewed(false); setConfirmed(false); }
    } finally { setBusy(false); }
  }
  return <form className={ui.dialogForm} onSubmit={submit}>
    {error ? <FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner> : null}
    <label id="tracking-start-label" htmlFor="tracking-start">{t("date")}</label>
    <DateInput id="tracking-start" aria-labelledby="tracking-start-label" value={date} today={businessDate} min={min} max={max} disabled={busy} onValueChange={value => { setDate(value); setReviewed(!openingBalance && !income); setConfirmed(false); }} />
    <MoneyField id="tracking-opening" label={t("opening")} value={openingBalance} onChange={value => { setOpening(value); setConfirmed(false); }} disabled={busy} />
    <MoneyField id="tracking-income" label={t("income", { from: date ? formatDate(date, locale) : "—", to: end ? formatDate(end, locale) : "—" })} value={income} onChange={value => { setIncome(value); setConfirmed(false); }} disabled={busy} />
    {mode !== "restart" ? <><p>{t("range", { range: `${selectedMonth} → ${lastMonth}`, count })}</p><p className={ui.helperText}>{t(mode === "backfill" ? "supplied" : "historical")}</p></> : <p>{t("warning")}</p>}
    {stale || !reviewed ? <><p role="status">{t("changed")}</p><button type="button" className={ui.secondaryButton} disabled={busy} onClick={() => void review()}>{t("review")}</button></> : null}
    <button type="submit" className={ui.primaryButton} disabled={busy || !valid || !openingBalance || !income || stale || !reviewed}>{t(confirmed ? "confirm" : mode)}</button>
  </form>;
}
