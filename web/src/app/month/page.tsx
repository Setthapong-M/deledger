"use client";

import { ui } from "@/components/ui-styles";

import { useCallback, useEffect, useState } from "react";
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

type DialogKind = "income" | "snapshot" | "ending" | "close" | null;

export default function MonthPage() {
  const [view, setView] = useState<MonthView | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const expireSession = useCallback(() => {
    setView(null);
    setState(null);
    setDialog(null);
    setError(null);
    window.location.assign("/login");
  }, []);
  const load = useCallback(async () => {
    setError(null);
    try { const current = await api.current(); setState(current.state); setView(current.month); } catch (reason) { if (isAuthenticationError(reason)) { expireSession(); return; } setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ"); }
  }, [expireSession]);
  useEffect(() => { void load(); }, [load]);
  async function update(action: () => Promise<MonthView>) {
    try { setView(await action()); setError(null); } catch (reason) { if (isAuthenticationError(reason)) { expireSession(); return; } if (reason instanceof ApiClientError && reason.current) setView(reason.current); setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
  }
  if (error && !view) return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>โหลดข้อมูลไม่สำเร็จ</h1><FeedbackBanner tone="warning">{error}</FeedbackBanner><button className={ui.primaryButton} type="button" onClick={() => void load()}>ลองใหม่</button></section></AppShell>;
  if (state === "onboarding_required") return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>ยังไม่มีเดือนที่เริ่มติดตาม</h1><Link className={ui.primaryButton} href="/start">เริ่มเดือนแรก</Link></section></AppShell>;
  if (state === "resume_required") return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>ต้องเริ่มติดตามใหม่</h1><Link className={ui.primaryButton} href="/resume">กรอกยอดของเดือนนี้</Link></section></AppShell>;
  if (!view) return <AppShell><section className="grid gap-[18px]"><div className={`${ui.skeleton} h-[220px]`} /><div className={`${ui.skeleton} h-80`} /></section></AppShell>;
  return <AppShell>{error ? <FeedbackBanner tone="warning" onDismiss={() => setError(null)}>{error}</FeedbackBanner> : null}<div className={ui.pageHeading}><div><p className={ui.eyebrow}>เห็นภาพรวม โดยไม่ต้องจดทุกรายการ</p><h1>เดือนของคุณ</h1><p className={`${ui.helperText} mb-0`}>รู้ว่าจ่ายไปเท่าไร จากยอดเงินที่คุณมี</p></div><Link className={ui.secondaryButton} href="/history">ดูประวัติ</Link></div><div className="grid grid-cols-[minmax(0,1.18fr)_minmax(0,1fr)] items-stretch gap-6 [&>section]:m-0 [&>section]:min-w-0 tablet:grid-cols-1 mobile:gap-[18px]"><MonthSummary view={view} /><MonthTimeline view={view} onIncome={() => setDialog("income")} onSnapshot={() => setDialog("snapshot")} onEnding={() => setDialog("ending")} onClose={() => setDialog("close")} /></div><ExpenseChips view={view} onChange={setView} onSessionExpired={expireSession} /><ExpenseSetupManager view={view} onChange={setView} onSessionExpired={expireSession} />
    {dialog === "income" ? <BalanceDialog title="แก้รายรับ" initialValue={view.summary.income ?? ""} onClose={() => setDialog(null)} onSubmit={(amount) => update(() => api.income(view.month, amount, view.revision))} /> : null}
    {dialog === "ending" ? <BalanceDialog title="บันทึกยอดปลาย" initialValue={view.summary.endingBalance ?? ""} onClose={() => setDialog(null)} onSubmit={(amount) => update(() => api.endingBalance(view.month, amount, view.revision))} /> : null}
    {dialog === "snapshot" ? <BalanceDialog title="บันทึก Snapshot" dateLabel="วันที่เห็นยอด" onClose={() => setDialog(null)} onSubmit={(amount, date) => update(() => api.snapshot(view.month, date ?? "", amount, view.revision))} /> : null}
    {dialog === "close" ? <Dialog title="ปิดเดือนนี้?" description="ปิดแล้วจะแก้ไขข้อมูลได้ แต่จะไม่เปิดเดือนเดิมอีก" labelledBy="close-title" onClose={() => setDialog(null)}>
      <div className="my-6 rounded-2xl bg-canvas p-5 [&_h3]:mt-0 [&_h3]:mr-0 [&_h3]:mb-3 [&_h3]:ml-0 [&_h3]:text-[1.3rem] [&_dl]:my-3">
        <p className={ui.eyebrow}>ตรวจทานก่อนยืนยัน</p>
        <h3>{formatMonth(view.month)}</h3>
        <StatusBadge state={view.reconciliation.state} />
        <dl className={ui.detailList}>
          <div><dt>รายรับ</dt><dd>{formatMoney(view.summary.income)}</dd></div>
          <div><dt>ยอดปลาย</dt><dd>{formatMoney(view.summary.endingBalance)}</dd></div>
          <div><dt>รายจ่ายทั้งเดือน</dt><dd>{formatMoney(view.summary.monthlySpending)}</dd></div>
          <div><dt>ไม่ระบุรายการ</dt><dd>{formatMoney(view.summary.unitemizedSpending)}</dd></div>
        </dl>
        <p className={ui.helperText}>หากแก้ไขข้อมูลภายหลัง ยอดของเดือนถัดไปที่ต่อเนื่องกันอาจเปลี่ยนตาม</p>
      </div>
      <div className={ui.dialogActions}><button className={ui.secondaryButton} type="button" onClick={() => setDialog(null)}>ยกเลิก</button><button className={ui.primaryButton} type="button" onClick={() => { setDialog(null); void update(() => api.close(view.month, view.revision)); }}>ยืนยันปิดเดือน</button></div>
    </Dialog> : null}
  </AppShell>;
}
