"use client";

import { useFinancialClock } from "@/lib/calendar";
import { Icon } from "./icon";

import { ui } from "@/components/ui-styles";

import { useRef, useState } from "react";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  eyebrow: { th: "ตั้งค่าของเดือน", en: "Monthly setup" },
  title: { th: "รายจ่ายประจำ", en: "Recurring expenses" },
  add: { th: "เพิ่มรายการ", en: "Add expense" },
  list: { th: "รายจ่ายประจำของเดือน", en: "This month’s recurring expenses" },
  empty: { th: "ยังไม่มีรายจ่ายประจำ เพิ่มรายการที่อยากติดตามได้เลย", en: "No recurring expenses yet. Add one to track." },
  reorder: { th: "จัดลำดับ {name}", en: "Reorder {name}" },
  reorderHint: { th: "ลากหรือใช้ปุ่มลูกศรขึ้นลงเพื่อจัดลำดับ", en: "Drag or use the up and down arrow keys to reorder" },
  fixed: { th: "ยอดคงที่ · {amount}", en: "Fixed amount · {amount}" },
  unknown: { th: "ยังไม่ระบุ", en: "Not set" },
  variable: { th: "กรอกตอนจ่าย", en: "Enter when paid" },
  paused: { th: " · พักไว้", en: " · Paused" },
  edit: { th: "แก้ไข {name}", en: "Edit {name}" },
  resume: { th: "เปิดใช้ {name}", en: "Resume {name}" },
  pause: { th: "พักใช้ {name}", en: "Pause {name}" },
} satisfies Messages;
import { api, ApiClientError, isAuthenticationError, type MonthView } from "@/lib/api-client";
import { ExpenseSetupDialog, type SetupDraft } from "./expense-setup-dialog";
import { FeedbackBanner } from "./feedback-banner";
import { SortableExpenses } from "./sortable-expenses";

export function ExpenseSetupManager({ view, onChange, onSessionExpired = () => window.location.assign("/login") }: { view: MonthView; onChange: (view: MonthView) => void; onSessionExpired?: () => void }) {
  const { t, errorMessage } = useCopy(copy);
  const clock = useFinancialClock();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<{ reason: unknown } | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<MonthView>, preserveDialog = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { onChange(await action()); setMessage(null); } catch (reason) {
      if (isAuthenticationError(reason)) { setEditing(null); setAdding(false); setMessage(null); onSessionExpired(); return; }
      if (reason instanceof ApiClientError && reason.current) onChange(reason.current);
      setMessage({ reason });
      if (preserveDialog) throw reason;
    } finally { pending.current = false; setBusy(false); }
  }
  const ordered = [...view.setup].sort((left, right) => left.position - right.position);
  function move(id: string, direction: -1 | 1) {
    if (pending.current || !view.allowedActions.manageSetup) return;
    const index = ordered.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const ids = ordered.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex]!, ids[index]!];
    void run(() => api.reorderSetup(view.month, ids, view.revision, clock));
  }
  return <section className={`scroll-mt-5 ${ui.card}`} aria-labelledby="setup-title">
    <div className={ui.sectionHeading}><div><p className={ui.eyebrow}>{t("eyebrow")}</p><h2 id="setup-title">{t("title")}</h2></div><button className={ui.primaryButtonCompact} type="button" onClick={() => setAdding(true)} disabled={!view.allowedActions.manageSetup || busy}>{t("add")}</button></div>
    {message ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{errorMessage(message.reason)}</FeedbackBanner> : null}
    {ordered.length === 0 ? <p className={ui.emptyState}>{t("empty")}</p> : <SortableExpenses
      items={ordered} version={`${view.month}:${view.revision}`} disabled={!view.allowedActions.manageSetup || busy}
      label={t("list")} onReorder={ids => run(() => api.reorderSetup(view.month, ids, view.revision, clock))}
      renderOverlay={item => <div className="flex h-full items-center gap-3 px-5"><Icon name="grip" className="size-5 text-muted-ink" /><div className="grid min-w-0 gap-1"><strong className="truncate">{item.name}</strong><span className="text-sm text-muted-ink">{item.kind === "fixed" ? t("fixed", { amount: item.fixedAmount ?? t("unknown") }) : t("variable")}</span></div></div>}
      renderItem={(item, handle) => <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl border border-border px-2 py-[13px] mobile:gap-1.5">
        <button type="button" className={ui.iconButton} {...handle} aria-label={t("reorder", { name: item.name })} title={t("reorderHint")} onKeyDown={(event) => { if (event.key === "ArrowUp") { event.preventDefault(); move(item.id, -1); } if (event.key === "ArrowDown") { event.preventDefault(); move(item.id, 1); } }} disabled={!view.allowedActions.manageSetup} aria-disabled={busy || undefined}><Icon name="grip" /></button>
        <div className="grid min-w-0 gap-[5px] [&_strong]:truncate [&_span]:text-[0.86rem] [&_span]:text-muted-ink"><strong>{item.name}</strong><span>{item.kind === "fixed" ? t("fixed", { amount: item.fixedAmount ?? t("unknown") }) : t("variable")}{item.isPaused ? t("paused") : ""}</span></div>
        <div className="flex gap-1"><button className={ui.iconButton} type="button" aria-label={t("edit", { name: item.name })} title={t("edit", { name: item.name })} onClick={() => setEditing(item.id)} disabled={!view.allowedActions.manageSetup || busy}><Icon name="edit" /></button><button className={ui.iconButton} type="button" aria-label={t(item.isPaused ? "resume" : "pause", { name: item.name })} title={t(item.isPaused ? "resume" : "pause", { name: item.name })} onClick={() => void run(() => api.updateSetup(view.month, item.id, { isPaused: !item.isPaused, expectedRevision: view.revision }, clock))} disabled={!view.allowedActions.manageSetup || busy}><Icon name={item.isPaused ? "play" : "pause"} /></button></div>
      </div>}
    />}

    {adding ? <ExpenseSetupDialog onClose={() => setAdding(false)} onSave={(draft) => run(() => api.addSetup(view.month, { ...draft, expectedRevision: view.revision }, clock), true)} /> : null}
    {editing ? (() => { const item = view.setup.find((entry) => entry.id === editing); return item ? <ExpenseSetupDialog initial={{ name: item.name, kind: item.kind, fixedAmount: item.fixedAmount }} onClose={() => setEditing(null)} onSave={(draft: SetupDraft) => run(() => api.updateSetup(view.month, item.id, { ...draft, expectedRevision: view.revision }, clock), true)} /> : null; })() : null}
  </section>;
}
