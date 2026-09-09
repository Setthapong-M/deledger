"use client";

import { useState } from "react";
import { useCalendar } from "@/lib/calendar";
import { api } from "@/lib/api-client";
import { useCopy, type Messages } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { DateInput } from "./date-input";
import { Dialog } from "./dialog";
import { FeedbackBanner } from "./feedback-banner";
import { ui } from "./ui-styles";

const copy = {
  banner: { th: "โหมดทดสอบ · วันที่ระบบ {date} · มีผลกับทุกบัญชีใน local นี้", en: "Test mode · System date {date} · Affects every account in this local instance" },
  real: { th: "วันที่จริง", en: "Real date" },
  simulated: { th: "วันที่จำลอง", en: "Simulated date" },
  change: { th: "เปลี่ยนวันที่ระบบ", en: "Change system date" },
  reset: { th: "กลับวันที่จริง", en: "Return to real date" },
  warning: { th: "การข้ามเดือนอาจปิดเดือนและสร้างเดือนใหม่ การย้อนวันที่หรือรีสตาร์ต API ไม่ย้อนข้อมูล", en: "Moving across months may close and create months. Moving back or restarting the API does not undo records." },
  confirm: { th: "รับทราบและเปลี่ยนวันที่", en: "Acknowledge and change date" },
  cancel: { th: "ยกเลิก", en: "Cancel" },
} satisfies Messages;

export function CalendarControl() {
  const { calendar, accept, error: calendarError } = useCalendar();
  const { t, locale, errorMessage } = useCopy(copy);
  const [draft, setDraft] = useState<{ date: string | null; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!calendar?.canSimulate || calendar.clockRevision === null) return null;
  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    try { accept(await api.setClock(draft.date, draft.token)); setDraft(null); setError(null); }
    catch (reason) { setError(reason); }
    finally { setBusy(false); }
  }
  return <aside className={`${ui.card} mb-5`} aria-label={t("change")}>
    <p role="status">{t("banner", { date: formatDate(calendar.businessDate, locale) })} · {t(calendar.mode === "real" ? "real" : "simulated")}</p>
    <p className={ui.helperText}>{t("warning")}</p>
    {calendarError ? <FeedbackBanner tone="warning">{errorMessage(calendarError)}</FeedbackBanner> : null}
    <div className="flex flex-wrap gap-3">
      <button className={ui.secondaryButton} onClick={() => { setError(null); setDraft({ date: calendar.businessDate, token: calendar.clockRevision! }); }}>{t("change")}</button>
      <button className={ui.secondaryButton} onClick={() => { setError(null); setDraft({ date: null, token: calendar.clockRevision! }); }}>{t("reset")}</button>
    </div>
    {draft ? <Dialog title={t(draft.date === null ? "reset" : "change")} onClose={() => { if (!busy) setDraft(null); }}>
      <div className={ui.dialogForm}>
        <p className="m-0 leading-relaxed">{t("warning")}</p>
        {error ? <FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner> : null}
        {draft.date !== null ? <div className={ui.field}><label id="clock-date-label" htmlFor="clock-date">{t("change")}</label><DateInput id="clock-date" aria-labelledby="clock-date-label" value={draft.date} onValueChange={date => setDraft({ ...draft, date })} today={calendar.realDate} min={calendar.minDate} max={calendar.maxDate} disabled={busy} /></div> : null}
        <div className={`${ui.dialogActions} pt-1`}><button className={ui.secondaryButton} disabled={busy} onClick={() => setDraft(null)}>{t("cancel")}</button><button className={ui.primaryButton} disabled={busy || draft.date === "" || draft.token !== calendar.clockRevision} onClick={() => void save()}>{t("confirm")}</button></div>
      </div>
    </Dialog> : null}
  </aside>;
}
