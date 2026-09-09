"use client";

import { TrackingAction } from "@/components/tracking-action";
import { useCalendar } from "@/lib/calendar";
import { formatDate } from "@/lib/format";
import { monthEnd } from "@/components/tracking-form";
import { useCopy, type Messages } from "@/lib/i18n";

import { ui } from "@/components/ui-styles";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BalanceDialog } from "@/components/balance-dialog";
import { Dialog } from "@/components/dialog";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney, formatMonth } from "@/lib/format";
import { ExpenseChips } from "@/components/expense-chips";
import { ExpenseSetupManager } from "@/components/expense-setup-manager";
import { FeedbackBanner } from "@/components/feedback-banner";
import { MonthSummary } from "@/components/month-summary";
import { MonthTimeline } from "@/components/month-timeline";
import { api, ApiClientError, isAuthenticationError, type MonthView } from "@/lib/api-client";

const copy = {
  outside: { th: "วันที่ระบบอยู่นอกช่วงที่ติดตาม ปรับวันที่หรือกลับวันที่จริง ประวัติเดิมยังอยู่", en: "The system date is outside your tracked period. Adjust or return to the real date. Your history is preserved." },
  period: { th: "รายรับตั้งแต่ {from} ถึง {to}", en: "Income from {from} through {to}" },
  "loadError": {
    "th": "โหลดข้อมูลไม่ได้",
    "en": "Your data couldn’t load"
  },
  "retry": {
    "th": "ลองใหม่",
    "en": "Try again"
  },
  "notStarted": {
    "th": "เริ่มดูแลเงินเดือนแรกกัน",
    "en": "Let’s start your first month"
  },
  "start": {
    "th": "เริ่มเดือนแรก",
    "en": "Start your first month"
  },
  "resumeTitle": {
    "th": "พร้อมกลับมาติดตามเงินแล้ว",
    "en": "Ready for a fresh start"
  },
  "resume": {
    "th": "เริ่มเดือนนี้",
    "en": "Start this month"
  },
  "title": {
    "th": "เดือนนี้",
    "en": "This month"
  },
  "description": {
    "th": "รู้รายจ่ายจากยอดเงินที่มี",
    "en": "See your spending from your balances."
  },
  "history": {
    "th": "ดูย้อนหลัง",
    "en": "View history"
  },
  "incomeEdit": {
    "th": "แก้รายรับ",
    "en": "Edit income"
  },
  "endingEdit": {
    "th": "บันทึกยอดสิ้นเดือน",
    "en": "Save closing balance"
  },
  "snapshotEdit": {
    "th": "บันทึกยอดเงินระหว่างเดือน",
    "en": "Check in your balance"
  },
  "snapshotDate": {
    "th": "วันที่เช็กยอด",
    "en": "Date checked"
  },
  "closeTitle": {
    "th": "ปิดเดือนนี้ไหม?",
    "en": "Close this month?"
  },
  "closeDescription": {
    "th": "ยังแก้ยอดย้อนหลังได้ แต่จะเปิดเดือนนี้ใหม่ไม่ได้",
    "en": "You can still correct amounts later, but you can’t reopen this month."
  },
  "review": {
    "th": "ตรวจยอดก่อนปิดเดือน",
    "en": "Check your totals"
  },
  "income": {
    "th": "รายรับ",
    "en": "Income"
  },
  "ending": {
    "th": "ยอดสิ้นเดือน",
    "en": "Closing balance"
  },
  "spending": {
    "th": "รายจ่ายทั้งเดือน",
    "en": "Monthly spending"
  },
  "other": {
    "th": "รายจ่ายอื่น",
    "en": "Other spending"
  },
  "correction": {
    "th": "ถ้าแก้ยอดย้อนหลัง ยอดเดือนถัดไปอาจเปลี่ยนตาม",
    "en": "Later corrections may change the following months’ balances."
  },
  "cancel": {
    "th": "ยกเลิก",
    "en": "Cancel"
  },
  "close": {
    "th": "ยืนยันปิดเดือน",
    "en": "Confirm and close"
  }
} satisfies Messages;

type DialogKind = "income" | "snapshot" | "ending" | "close" | null;

export default function MonthPage() {
  const { locale, t, errorMessage } = useCopy(copy);
  const { calendar } = useCalendar();
  const calendarKey = `${calendar?.businessDate}:${calendar?.clockRevision}`;
  const latestCalendarKey = useRef(calendarKey);
  latestCalendarKey.current = calendarKey;
  function acceptView(next: MonthView) {
    if (latestCalendarKey.current !== calendarKey) return;
    generation.current++;
    setView(next);
  }
  const generation = useRef(0);
  const [dialogTarget, setDialogTarget] = useState<{ view: MonthView; clock: string | null | undefined } | null>(null);
  const [view, setView] = useState<MonthView | null>(null);
  const [viewCalendarKey, setViewCalendarKey] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const expireSession = useCallback(() => {
    setView(null);
    setState(null);
    setDialog(null);
    setError(null);
    window.location.assign("/login");
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setError(null);
    try { const current = await api.current(); if (request !== generation.current || latestCalendarKey.current !== calendarKey) return; setState(current.state); setView(current.month); setViewCalendarKey(calendarKey); }
    catch (reason) { if (request !== generation.current) return; if (isAuthenticationError(reason)) { expireSession(); return; } setError(reason); }
  }, [expireSession, calendarKey]);
  useEffect(() => {
    void load();
    return () => { generation.current++; };
  }, [load, calendar?.clockRevision, calendar?.businessDate]);
  function openDialog(kind: DialogKind) {
    if (!view) return;
    setDialogTarget({ view, clock: calendar?.clockRevision });
    setDialog(kind);
  }
  async function update(action: () => Promise<MonthView>) {
    const request = ++generation.current;
    try { const next = await action(); if (request !== generation.current) return; setView(next); setError(null); }
    catch (reason) {
      if (request !== generation.current) throw reason;
      if (isAuthenticationError(reason)) { expireSession(); throw reason; }
      if (reason instanceof ApiClientError && reason.current) { setView(reason.current); setDialogTarget(current => current ? { ...current, view: reason.current! } : null); }
      setError(reason); throw reason;
    }
  }
  const target = dialogTarget?.view ?? view;
  const dialogValid = !dialogTarget || (dialogTarget.clock === calendar?.clockRevision && target?.month === view?.month);
  if (viewCalendarKey !== calendarKey) return <AppShell><section aria-busy={!error}>{error ? <><FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner><button className={ui.primaryButton} onClick={() => void load()}>{t("retry")}</button></> : <div className={`${ui.skeleton} h-[220px]`} />}</section></AppShell>;
  if (state === "simulation_outside_tracking") return <AppShell><section className={ui.card}><h1>{t("outside")}</h1><Link href="/history">{t("history")}</Link></section></AppShell>;
  if (error && !view) return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>{t("loadError")}</h1><FeedbackBanner tone="warning">{errorMessage(error)}</FeedbackBanner><button className={ui.primaryButton} type="button" onClick={() => void load()}>{t("retry")}</button></section></AppShell>;
  if (state === "onboarding_required") return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>{t("notStarted")}</h1><Link className={ui.primaryButton} href="/start">{t("start")}</Link></section></AppShell>;
  if (state === "resume_required") return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>{t("resumeTitle")}</h1><Link className={ui.primaryButton} href="/resume">{t("resume")}</Link></section></AppShell>;
  if (!view) return <AppShell><section className="grid gap-[18px]"><div className={`${ui.skeleton} h-[220px]`} /><div className={`${ui.skeleton} h-80`} /></section></AppShell>;
  return <AppShell>{error ? <FeedbackBanner tone="warning" onDismiss={() => setError(null)}>{errorMessage(error)}</FeedbackBanner> : null}<div className={ui.pageHeading}><div><h1>{t("title")}</h1><p className={`${ui.helperText} mb-0`}>{t("description")}</p></div><Link className={ui.secondaryButton} href="/history">{t("history")}</Link></div><div className="grid grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)] items-stretch gap-6 [&>section]:m-0 [&>section]:min-w-0 tablet:grid-cols-1 mobile:gap-[18px]"><MonthSummary view={view} /><MonthTimeline view={view} onIncome={() => openDialog("income")} onSnapshot={() => openDialog("snapshot")} onEnding={() => openDialog("ending")} onClose={() => openDialog("close")} /></div><TrackingAction mode="restart" revision={view.revision} onComplete={acceptView} /><ExpenseChips key={`chips:${view.month}:${calendar?.clockRevision}`} view={view} onChange={acceptView} onSessionExpired={expireSession} /><ExpenseSetupManager key={`setup:${view.month}:${calendar?.clockRevision}`} view={view} onChange={acceptView} onSessionExpired={expireSession} />
    {dialogValid && target && dialog === "income" ? <BalanceDialog title={target.isPartial ? t("period", { from: formatDate(target.trackedFrom, locale), to: formatDate(target.lifecycle === "open" && calendar ? calendar.businessDate : monthEnd(target.month), locale) }) : t("incomeEdit")} initialValue={view.summary.income ?? ""} onClose={() => setDialog(null)} onSubmit={(amount, _date, clock) => update(() => api.income(target.month, amount, target.revision, clock))} /> : null}
    {dialogValid && target && dialog === "ending" ? <BalanceDialog title={t("endingEdit")} initialValue={view.summary.endingBalance ?? ""} onClose={() => setDialog(null)} onSubmit={(amount, _date, clock) => update(() => api.endingBalance(target.month, amount, target.revision, clock))} /> : null}
    {dialogValid && target && dialog === "snapshot" ? <BalanceDialog title={t("snapshotEdit")} dateLabel={t("snapshotDate")} minDate={target.trackedFrom} onClose={() => setDialog(null)} onSubmit={(amount, date, clock) => update(() => api.snapshot(target.month, date ?? "", amount, target.revision, clock))} /> : null}
    {dialogValid && target && dialog === "close" ? <Dialog title={t("closeTitle")} description={t("closeDescription")} labelledBy="close-title" onClose={() => setDialog(null)}>
      <div className="my-6 rounded-2xl bg-canvas p-5 [&_h3]:mt-0 [&_h3]:mr-0 [&_h3]:mb-3 [&_h3]:ml-0 [&_h3]:text-[1.3rem] [&_dl]:my-3">
        <p className={ui.eyebrow}>{t("review")}</p>
        <h3>{formatMonth(view.month, locale)}</h3>
        <StatusBadge state={view.reconciliation.state} />
        <dl className={ui.detailList}>
          <div><dt>{t("income")}</dt><dd>{formatMoney(view.summary.income)}</dd></div>
          <div><dt>{t("ending")}</dt><dd>{formatMoney(view.summary.endingBalance)}</dd></div>
          <div><dt>{t("spending")}</dt><dd>{formatMoney(view.summary.monthlySpending)}</dd></div>
          <div><dt>{t("other")}</dt><dd>{formatMoney(view.summary.unitemizedSpending)}</dd></div>
        </dl>
        <p className={ui.helperText}>{t("correction")}</p>
      </div>
      <div className={ui.dialogActions}><button className={ui.secondaryButton} type="button" onClick={() => setDialog(null)}>{t("cancel")}</button><button className={ui.primaryButton} type="button" onClick={() => { setDialog(null); void update(() => api.close(target.month, target.revision, dialogTarget?.clock)).catch(() => {}); }}>{t("close")}</button></div>
    </Dialog> : null}
  </AppShell>;
}
