"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BalanceDialog } from "@/components/balance-dialog";
import { ExpenseChips } from "@/components/expense-chips";
import { ExpenseSetupManager } from "@/components/expense-setup-manager";
import { FeedbackBanner } from "@/components/feedback-banner";
import { MonthSummary } from "@/components/month-summary";
import { MonthTimeline } from "@/components/month-timeline";
import { api, ApiClientError, type MonthView } from "@/lib/api-client";

type DialogKind = "income" | "snapshot" | "ending" | "close" | null;

export default function MonthPage() {
  const [view, setView] = useState<MonthView | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const load = useCallback(async () => {
    setError(null);
    try { const current = await api.current(); setState(current.state); setView(current.month); } catch (reason) { setError(reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function update(action: () => Promise<MonthView>) {
    try { setView(await action()); setError(null); } catch (reason) { if (reason instanceof ApiClientError && reason.current) setView(reason.current); setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ"); }
  }
  if (error && !view) return <AppShell><section className="card empty-state"><h1>โหลดข้อมูลไม่สำเร็จ</h1><FeedbackBanner tone="warning">{error}</FeedbackBanner><button className="primary-button" type="button" onClick={() => void load()}>ลองใหม่</button></section></AppShell>;
  if (state === "onboarding_required") return <AppShell><section className="card empty-state"><h1>ยังไม่มีเดือนที่เริ่มติดตาม</h1><Link className="primary-button" href="/start">เริ่มเดือนแรก</Link></section></AppShell>;
  if (state === "resume_required") return <AppShell><section className="card empty-state"><h1>ต้องเริ่มติดตามใหม่</h1><Link className="primary-button" href="/resume">กรอกยอดของเดือนนี้</Link></section></AppShell>;
  if (!view) return <AppShell><section className="page-loading"><div className="skeleton skeleton-summary" /><div className="skeleton skeleton-card" /></section></AppShell>;
  return <AppShell>{error ? <FeedbackBanner tone="warning" onDismiss={() => setError(null)}>{error}</FeedbackBanner> : null}<div className="page-heading"><div><p className="eyebrow">FINANCIAL BOUNDARY เดียว</p><h1>เดือนของคุณ</h1></div><Link className="secondary-button" href="/history">ดูประวัติ</Link></div><MonthSummary view={view} /><MonthTimeline view={view} onIncome={() => setDialog("income")} onSnapshot={() => setDialog("snapshot")} onEnding={() => setDialog("ending")} onClose={() => setDialog("close")} /><ExpenseChips view={view} onChange={setView} /><ExpenseSetupManager view={view} onChange={setView} />
    {dialog === "income" ? <BalanceDialog title="แก้รายรับ" initialValue={view.summary.income ?? ""} onClose={() => setDialog(null)} onSubmit={(amount) => update(() => api.income(view.month, amount, view.revision))} /> : null}
    {dialog === "ending" ? <BalanceDialog title="บันทึกยอดปลาย" initialValue={view.summary.endingBalance ?? ""} onClose={() => setDialog(null)} onSubmit={(amount) => update(() => api.endingBalance(view.month, amount, view.revision))} /> : null}
    {dialog === "snapshot" ? <BalanceDialog title="บันทึก Snapshot" dateLabel="วันที่เห็นยอด" onClose={() => setDialog(null)} onSubmit={(amount, date) => update(() => api.snapshot(view.month, date ?? "", amount, view.revision))} /> : null}
    {dialog === "close" ? <div className="dialog-backdrop" role="presentation"><div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="close-title"><div className="dialog-heading"><div><h2 id="close-title">ปิดเดือนนี้?</h2><p>ปิดแล้วจะแก้ไขข้อมูลได้ แต่จะไม่เปิดเดือนเดิมอีก</p></div><button className="icon-button" type="button" aria-label="ปิดหน้าต่าง" onClick={() => setDialog(null)}>×</button></div><div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setDialog(null)}>ยกเลิก</button><button className="primary-button" type="button" onClick={() => { setDialog(null); void update(() => api.close(view.month, view.revision)); }}>ยืนยันปิดเดือน</button></div></div></div> : null}
  </AppShell>;
}
