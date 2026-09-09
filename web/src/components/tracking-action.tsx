"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError, type MonthView, type TrackingOptions } from "@/lib/api-client";
import { useCalendar } from "@/lib/calendar";
import { useCopy, type Messages } from "@/lib/i18n";
import { TrackingForm } from "./tracking-form";
import { Dialog } from "./dialog";
import { ui } from "./ui-styles";
import { FeedbackBanner } from "./feedback-banner";

const copy = {
  backfill: { th: "เพิ่มเดือนย้อนหลัง", en: "Add earlier months" },
  restart: { th: "เริ่มติดตามใหม่", en: "Start fresh" },
  history: { th: "หรือแก้ยอดเดือนก่อนในประวัติ", en: "Or correct earlier amounts in History" },
  start: { th: "เริ่มเดือนแรก", en: "Start first month" },
} satisfies Messages;

export function TrackingAction({ mode, revision, onComplete }: { mode: "backfill" | "restart"; revision?: string; onComplete: (view: MonthView, selected: string) => void }) {
  const { calendar } = useCalendar();
  const calendarKey = `${calendar?.businessDate}:${calendar?.clockRevision}`;
  const [optionsKey, setOptionsKey] = useState<string | null>(null);
  const { t, errorMessage } = useCopy(copy);
  const [options, setOptions] = useState<TrackingOptions | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!calendar) return;
    let active = true;
    void api.trackingOptions().then(value => { if (active) { setOptions(value); setOptionsKey(calendarKey); setError(null); } }).catch(reason => { if (active) setError(reason); });
    return () => { active = false; };
  }, [calendar?.clockRevision, calendar?.businessDate, revision]);
  const capability = mode === "backfill" ? options?.prepend : options?.restart;
  return <div className="my-4">
    {error ? <FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner> : null}
    {options && mode === "backfill" && !options.earliestMonth ? <a className={ui.secondaryButton} href="/start">{t("start")}</a> : null}
    {capability?.allowed && optionsKey === calendarKey && options?.businessDate === calendar?.businessDate ? <button className={ui.secondaryButton} onClick={() => setOpen(true)}>{t(mode)}</button> : null}
    {mode === "restart" && capability?.allowed ? <a className="ml-4 underline" href="/history">{t("history")}</a> : null}
    {mode === "backfill" && capability?.reason ? <p>{errorMessage(new ApiClientError(409, { code: capability.reason, message: "" }))}</p> : null}
    {open && options ? <Dialog title={t(mode)} onClose={() => setOpen(false)}><TrackingForm mode={mode} options={options} onComplete={(view, selected) => { setOpen(false); onComplete(view, selected); }} /></Dialog> : null}
  </div>;
}
