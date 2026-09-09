"use client";

import { TrackingAction } from "./tracking-action";
import { HistoryCorrections } from "./history-corrections";
import { useCalendar } from "@/lib/calendar";
import { Icon } from "./icon";

import { IncomePeriod } from "./income-period";
import { ui } from "@/components/ui-styles";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { api, ApiClientError, isAuthenticationError, type HistoryEntry } from "@/lib/api-client";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { StatusBadge, StatusText } from "./status-badge";
import { FeedbackBanner } from "./feedback-banner";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  emptyTitle: { th: "ยังไม่มีประวัติรายเดือน", en: "No monthly history yet" },
  emptyHint: { th: "เริ่มเดือนแรกแล้ว ข้อมูลจะปรากฏที่นี่", en: "Your history will appear after you start your first month." },
  history: { th: "ประวัติรายเดือน", en: "Monthly history" },
  selectMonth: { th: "เลือกเดือน", en: "Select a month" },
  previousMonth: { th: "เดือนก่อนหน้า", en: "Previous month" },
  nextMonth: { th: "เดือนถัดไป", en: "Next month" },
  trackingGap: { th: "ช่วงข้อมูลขาด", en: "Tracking gap" },
  trackingPaused: { th: "หยุดติดตาม", en: "Tracking paused" },
  viewEntry: { th: "ดู {entry}", en: "View {entry}" },
  gapExplanation: { th: "ไม่ได้บันทึกเดือนหรือคาดเดายอดเงินในช่วงหยุดติดตาม", en: "No months were recorded or balances estimated while tracking was paused." },
  pausedOn: { th: "หยุดติดตามเมื่อ", en: "Paused on" },
  restoredOn: { th: "กู้คืนเมื่อ", en: "Restored on" },
  notRestored: { th: "ยังไม่กู้คืน", en: "Not restored yet" },
  openingBalance: { th: "ยอดต้นเดือน", en: "Opening balance" },
  income: { th: "รายรับ", en: "Income" },
  closingBalance: { th: "ยอดสิ้นเดือน", en: "Closing balance" },
  latestCheckIn: { th: "ยอดเงินระหว่างเดือนล่าสุด", en: "Latest balance check-in" },
  estimatedSpending: { th: "รายจ่ายโดยประมาณ", en: "Estimated spending" },
  monthlySpending: { th: "รายจ่ายทั้งเดือน", en: "Monthly spending" },
  confirmedDetails: { th: "รายจ่ายที่ยืนยันแล้ว", en: "Confirmed spending items" },
  otherSpending: { th: "รายจ่ายอื่น", en: "Other spending" },
  otherSpendingHint: { th: "รายจ่ายอื่นคือส่วนที่ยังไม่ได้แยกรายการ", en: "Other spending is the part of the total that has not been itemized." },
  closed: { th: "ปิดเดือนแล้ว", en: "Month closed" },
  open: { th: "ยังเปิดอยู่", en: "Month open" },
  issueCount: { th: "ต้องตรวจสอบ {count} จุด", en: "Items to review: {count}" },
  consistent: { th: "ข้อมูลสอดคล้อง", en: "Balances match" },
  supplied: { th: "ยอดตั้งต้นที่ระบุเอง", en: "Supplied starting balance" },
  more: { th: "โหลดเดือนก่อนหน้า", en: "Load earlier months" },
  start: { th: "เริ่มเดือนแรก", en: "Start first month" },
  refresh: { th: "โหลดล่าสุด", en: "Refresh" },
} satisfies Messages;

export function HistoryExplorer({ initialEntries = [], onSessionExpired }: { initialEntries?: HistoryEntry[]; onSessionExpired?: () => void }) {
  const { locale, t, errorMessage } = useCopy(copy);
  const { calendar } = useCalendar();
  const calendarKey = `${calendar?.businessDate}:${calendar?.clockRevision}`;
  const currentCalendarKey = useRef(calendarKey);
  currentCalendarKey.current = calendarKey;
  const [entriesKey, setEntriesKey] = useState(initialEntries.length ? calendarKey : null);
  const generation = useRef(0);
  const pagingRequest = useRef(0);
  const [entries, setEntries] = useState(initialEntries);
  const [selectedId, setSelectedId] = useState(initialEntries[0]?.id ?? "");
  const [message, setMessage] = useState<unknown>(null);
  const [loading, setLoading] = useState(initialEntries.length === 0);
  const [pageCursor, setPageCursor] = useState(initialEntries.filter(entry => entry.kind === "month").at(-1)?.id);
  const [paging, setPaging] = useState(false);
  function expireSession() {
    setEntries([]);
    setSelectedId("");
    setMessage(null);
    (onSessionExpired ?? (() => window.location.assign("/login")))();
  }

  async function reload(selectedMonth?: string, before?: string) {
    const request = ++generation.current;
    const pageRequest = ++pagingRequest.current;
    setPaging(true);
    try {
      const list = await api.history(before);
      const requested = selectedMonth && !list.some(entry => entry.kind === "month" && entry.id === selectedMonth) ? await api.month(selectedMonth) : null;
      if (request !== generation.current || currentCalendarKey.current !== calendarKey) return;
      setEntriesKey(calendarKey);
      setPageCursor(list.filter(entry => entry.kind === "month").at(-1)?.id);
      const result: HistoryEntry[] = requested ? [...list, { kind: "month", id: requested.month, view: requested }] : list;
      setEntries(current => {
        const merged = before ? [...current, ...result.filter(entry => !current.some(old => old.id === entry.id))] : result;
        const chronologicalKey = (entry: HistoryEntry) => entry.kind === "month" ? entry.view.month : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(entry.archivedAt)).slice(0, 7);
        return merged.sort((a, b) => chronologicalKey(b).localeCompare(chronologicalKey(a)));
      });
      if (!before) setSelectedId(selectedMonth ?? result[0]?.id ?? "");
      setMessage(null);
    } catch (reason) { if (request !== generation.current) return; if (isAuthenticationError(reason)) { expireSession(); return; } setMessage(reason); }
    finally {
      if (request === generation.current) setLoading(false);
      if (pageRequest === pagingRequest.current) setPaging(false);
    }
  }
  useEffect(() => {
    if (initialEntries.length > 0 && !calendar) return;
    void reload(new URLSearchParams(window.location.search).get("month") ?? undefined);
    return () => { generation.current++; pagingRequest.current++; };
  }, [initialEntries.length, calendar?.clockRevision, calendar?.businessDate]);

  const index = Math.max(0, entries.findIndex((entry) => entry.id === selectedId));
  const selected = entries[index];
  const side = useMemo(() => ({ left: entries[index - 1], right: entries[index + 1] }), [entries, index]);
  function selectAt(next: number) { if (!entries[next]) return; setSelectedId(entries[next]!.id); }
  function keyNavigate(event: KeyboardEvent) {
    const next = event.key === "ArrowLeft" ? index - 1 : event.key === "ArrowRight" ? index + 1 : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : null;
    if (next === null || !entries[next]) return;
    event.preventDefault();
    selectAt(next);
    document.getElementById(`history-tab-${next}`)?.focus();
  }
  if (entriesKey !== calendarKey && message) return <section className={ui.card}><FeedbackBanner tone="warning">{errorMessage(message)}</FeedbackBanner><button className={ui.secondaryButton} onClick={() => void reload(selectedId)}>{t("refresh")}</button></section>;
  if (entriesKey !== calendarKey) return <section className={ui.card} aria-busy="true"><div className={`${ui.skeleton} h-[220px]`} /></section>;
  if (loading) return <section className={`grid gap-[18px] ${ui.card}`} aria-busy="true"><div className={`${ui.skeleton} h-[88px]`} /><div className={`${ui.skeleton} h-[480px]`} /></section>;
  if (!selected) return <section className={`${ui.emptyState} ${ui.card}`}>{message !== null ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{errorMessage(message)}</FeedbackBanner> : <><h1>{t("emptyTitle")}</h1><p>{t("emptyHint")}</p><a href="/start">{t("start")}</a></>}</section>;
  return <section aria-label={t("history")} onKeyDown={event => { if ((event.target as HTMLElement).closest("[role=tablist]")) keyNavigate(event); }}>
    <TrackingAction mode="backfill" revision={entries.map(entry => entry.kind === "month" ? entry.view.revision : "").join(":")} onComplete={(_view, month) => void reload(month)} />
    {message !== null ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{errorMessage(message)}</FeedbackBanner> : null}
    <div className="flex items-stretch gap-3 px-[3px] pt-1.5 pb-4"><button type="button" className="flex-[0_0_44px] rounded-[10px] border border-border bg-surface text-[1.5rem] text-ink" aria-label={t("previousMonth")} onClick={() => selectAt(index - 1)} disabled={index <= 0}><Icon name="previous" /></button><div className="flex min-w-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto" role="tablist" aria-label={t("selectMonth")}>{entries.map((entry, entryIndex) => <button key={entry.id} id={`history-tab-${entryIndex}`} type="button" role="tab" tabIndex={entry.id === selected.id ? 0 : -1} aria-controls="history-cover" aria-selected={entry.id === selected.id} aria-current={entry.id === selected.id ? "true" : undefined} className="grid min-h-24 flex-[0_0_152px] snap-center content-center gap-1.5 rounded-[18px] border border-border bg-surface p-4 text-left text-ink [&_small]:text-muted-ink aria-selected:border-2 aria-selected:border-primary-ink aria-selected:bg-primary aria-selected:text-primary-ink aria-selected:[&_small]:text-primary-ink data-gap:border-dotted mobile:basis-[140px] forced-colors:aria-selected:outline-2 forced-colors:aria-selected:outline-[Highlight]" data-gap={entry.kind === "tracking_gap" ? "" : undefined} onClick={() => selectAt(entryIndex)}><span>{entry.kind === "month" ? formatMonth(entry.id, locale) : t("trackingGap")}</span><small>{entry.kind === "month" ? <StatusText state={entry.view.reconciliation.state} /> : t("trackingPaused")}</small></button>)}</div><button type="button" className="flex-[0_0_44px] rounded-[10px] border border-border bg-surface text-[1.5rem] text-ink" aria-label={t("nextMonth")} onClick={() => selectAt(index + 1)} disabled={index >= entries.length - 1}><Icon name="next" /></button></div>
    <div id="history-cover" role="tabpanel" aria-labelledby={`history-tab-${index}`} className="grid min-h-[440px] grid-cols-[minmax(100px,0.45fr)_minmax(320px,2fr)_minmax(100px,0.45fr)] items-stretch gap-[18px] py-3 mobile:min-h-0 mobile:grid-cols-1" tabIndex={0}>
      {side.left ? <SideCover entry={side.left} side="left" onClick={() => selectAt(index - 1)} /> : <div className="grid min-w-0 content-center gap-2.5 rounded-[18px] border border-border bg-surface p-[18px] text-left text-ink [&_strong]:text-[1rem] [&_small]:text-muted-ink mobile:hidden border-dashed bg-transparent shadow-none" aria-hidden="true" />}
      <Cover key={selected.id} entry={selected} onRefresh={(next) => { if (currentCalendarKey.current !== calendarKey) return; generation.current++; setEntries((current) => current.map((entry) => entry.id === next.id ? next : entry)); }} setMessage={setMessage} onSessionExpired={expireSession} />
      {side.right ? <SideCover entry={side.right} side="right" onClick={() => selectAt(index + 1)} /> : <div className="grid min-w-0 content-center gap-2.5 rounded-[18px] border border-border bg-surface p-[18px] text-left text-ink [&_strong]:text-[1rem] [&_small]:text-muted-ink mobile:hidden border-dashed bg-transparent shadow-none" aria-hidden="true" />}
    </div>
    <button className={ui.secondaryButton} disabled={paging || !pageCursor} onClick={() => void reload(undefined, pageCursor)}>{t("more")}</button>
  </section>;
}

function SideCover({ entry, side, onClick }: { entry: HistoryEntry; side: "left" | "right"; onClick: () => void }) {
  const { locale, t } = useCopy(copy);
  return <button type="button" className="grid min-w-0 content-center gap-2.5 rounded-[18px] border border-border bg-surface p-[18px] text-left text-ink [&_strong]:text-[1rem] [&_small]:text-muted-ink mobile:hidden data-side:rounded-3xl" data-side={side} onClick={onClick} aria-label={t("viewEntry", { entry: entry.kind === "month" ? formatMonth(entry.id, locale) : t("trackingGap") })}><strong>{entry.kind === "month" ? formatMonth(entry.id, locale) : t("trackingGap")}</strong><small>{entry.kind === "month" ? formatMoney(entry.view.summary.monthlySpending ?? entry.view.summary.provisionalSpending) : "—"}</small></button>;
}

function Cover({ entry, onRefresh, setMessage, onSessionExpired }: { entry: HistoryEntry; onRefresh: (entry: HistoryEntry) => void; setMessage: (message: unknown) => void; onSessionExpired: () => void }) {
  const { locale, t } = useCopy(copy);
  if (entry.kind === "tracking_gap") return <article className="min-w-0 rounded-[18px] border border-border bg-surface p-[clamp(20px,4vw,34px)] text-ink shadow-card [&_h1]:m-0 [&_h1]:tracking-[-0.04em] mobile:-order-1 border-dotted [&_h1]:m-0 [&_h1]:tracking-[-0.04em]"><span className={ui.statusBadge}>{t("trackingPaused")}</span><h1>{t("trackingGap")}</h1><dl className={ui.detailList}><div><dt>{t("pausedOn")}</dt><dd>{formatDate(entry.archivedAt.slice(0, 10), locale)}</dd></div><div><dt>{t("restoredOn")}</dt><dd>{entry.restoredAt ? formatDate(entry.restoredAt.slice(0, 10), locale) : t("notRestored")}</dd></div></dl><p className={ui.helperText}>{t("gapExplanation")}</p></article>;
  const view = entry.view;
  async function refresh() {
    try { onRefresh({ kind: "month", id: view.month, view: await api.month(view.month) }); setMessage(null); } catch (reason) { if (isAuthenticationError(reason)) { onSessionExpired(); return; } if (reason instanceof ApiClientError && reason.current) onRefresh({ kind: "month", id: view.month, view: reason.current }); setMessage(reason); }
  }
  return <article className="min-w-0 rounded-[18px] border border-border bg-surface p-[clamp(20px,4vw,34px)] text-ink shadow-card [&_h1]:m-0 [&_h1]:tracking-[-0.04em] mobile:-order-1" aria-labelledby="cover-title"><div className={ui.sectionHeading}><div><h1 id="cover-title">{formatMonth(view.month, locale)}</h1></div><StatusBadge state={view.reconciliation.state} partial={view.isPartial} /></div><dl className={ui.detailList}><div><dt>{t(view.openingSource === "supplied" ? "supplied" : "openingBalance")}</dt><dd>{formatMoney(view.summary.startingBalance)}</dd></div><div><dt>{<IncomePeriod view={view} />}</dt><dd>{formatMoney(view.summary.income)}</dd></div><div><dt>{t(view.summary.endingBalance !== null ? "closingBalance" : "latestCheckIn")}</dt><dd>{formatMoney(view.summary.referenceAmount)}</dd></div><div><dt>{t(view.summary.monthlySpending === null ? "estimatedSpending" : "monthlySpending")}</dt><dd>{formatMoney(view.summary.monthlySpending ?? view.summary.provisionalSpending)}</dd></div><div><dt>{t("confirmedDetails")}</dt><dd>{formatMoney(view.summary.detailTotal)}</dd></div><div><dt>{t("otherSpending")}</dt><dd>{formatMoney(view.summary.unitemizedSpending)}</dd></div></dl><p className={ui.helperText}>{t("otherSpendingHint")}</p><HistoryCorrections view={view} onChange={next => onRefresh({ kind: "month", id: next.month, view: next })} /><div className="flex flex-wrap items-center gap-3.5 border-t border-border pt-4 text-muted-ink [&_button]:ml-auto"><span>{t(view.lifecycle === "closed" ? "closed" : "open")}</span>{view.reconciliation.issueCodes.length ? <span>{t("issueCount", { count: view.reconciliation.issueCodes.length })}</span> : null}<button className={ui.iconButton} type="button" aria-label={t("refresh")} title={t("refresh")} onClick={() => void refresh()}><Icon name="refresh" /></button></div></article>;
}
