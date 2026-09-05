"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { api, ApiClientError, isAuthenticationError, type HistoryEntry } from "@/lib/api-client";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { StatusBadge, statusText } from "./status-badge";
import { FeedbackBanner } from "./feedback-banner";

export function HistoryExplorer({ initialEntries = [], onSessionExpired }: { initialEntries?: HistoryEntry[]; onSessionExpired?: () => void }) {
  const [entries, setEntries] = useState(initialEntries);
  const [selectedId, setSelectedId] = useState(initialEntries[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(initialEntries.length === 0);
  function expireSession() {
    setEntries([]);
    setSelectedId("");
    setMessage(null);
    (onSessionExpired ?? (() => window.location.assign("/login")))();
  }

  useEffect(() => {
    if (initialEntries.length > 0) return;
    void api.history().then((next) => { setEntries(next); setSelectedId(next[0]?.id ?? ""); }).catch((reason) => { if (isAuthenticationError(reason)) { expireSession(); return; } setMessage(reason instanceof Error ? reason.message : "โหลดประวัติไม่สำเร็จ"); }).finally(() => setLoading(false));
  }, [initialEntries.length]);

  const index = Math.max(0, entries.findIndex((entry) => entry.id === selectedId));
  const selected = entries[index];
  const side = useMemo(() => ({ left: entries[index - 1], right: entries[index + 1] }), [entries, index]);
  function selectAt(next: number) { if (!entries[next]) return; setSelectedId(entries[next]!.id); }
  function keyNavigate(event: KeyboardEvent) { if (event.key === "ArrowLeft") { event.preventDefault(); selectAt(index - 1); } if (event.key === "ArrowRight") { event.preventDefault(); selectAt(index + 1); } }
  if (loading) return <section className={`grid gap-[18px] ${ui.card}`} aria-busy="true"><div className={`${ui.skeleton} h-[88px]`} /><div className={`${ui.skeleton} h-[480px]`} /></section>;
  if (!selected) return <section className={`${ui.emptyState} ${ui.card}`}><h1>ยังไม่มีประวัติรายเดือน</h1><p>เมื่อเริ่มเดือนแรกแล้ว ข้อมูลจะปรากฏที่นี่</p></section>;
  return <section aria-label="ประวัติรายเดือน" onKeyDown={keyNavigate}>
    {message ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{message}</FeedbackBanner> : null}
    <div className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-[3px] pt-1.5 pb-4" role="tablist" aria-label="เลือกเดือน"><button type="button" className="flex-[0_0_44px] rounded-[10px] border border-border bg-surface text-[1.5rem] text-ink" aria-label="เดือนก่อนหน้า" onClick={() => selectAt(index - 1)} disabled={index <= 0}>‹</button>{entries.map((entry, entryIndex) => <button key={entry.id} type="button" role="tab" aria-selected={entry.id === selected.id} aria-current={entry.id === selected.id ? "true" : undefined} className="grid min-h-24 flex-[0_0_152px] snap-center content-center gap-1.5 rounded-[18px] border border-border bg-surface p-4 text-left text-ink [&_small]:text-muted-ink [&_small]:capitalize aria-selected:border-2 aria-selected:border-primary-ink aria-selected:bg-primary aria-selected:text-primary-ink aria-selected:[&_small]:text-primary-ink data-gap:border-dotted mobile:basis-[140px] forced-colors:aria-selected:outline-2 forced-colors:aria-selected:outline-[Highlight]" data-gap={entry.kind === "tracking_gap" ? "" : undefined} onClick={() => selectAt(entryIndex)}><span>{entry.kind === "month" ? formatMonth(entry.id) : "ช่วงข้อมูลขาด"}</span><small>{entry.kind === "month" ? statusText[entry.view.reconciliation.state] : "หยุดติดตาม"}</small></button>)}<button type="button" className="flex-[0_0_44px] rounded-[10px] border border-border bg-surface text-[1.5rem] text-ink" aria-label="เดือนถัดไป" onClick={() => selectAt(index + 1)} disabled={index >= entries.length - 1}>›</button></div>
    <div className="grid min-h-[440px] grid-cols-[minmax(100px,0.45fr)_minmax(320px,2fr)_minmax(100px,0.45fr)] items-stretch gap-[18px] py-3 mobile:min-h-0 mobile:grid-cols-1" tabIndex={0}>
      {side.left ? <SideCover entry={side.left} side="left" onClick={() => selectAt(index - 1)} /> : <div className="grid min-w-0 content-center gap-2.5 rounded-[18px] border border-border bg-surface p-[18px] text-left text-ink [&_strong]:text-[1rem] [&_small]:text-muted-ink mobile:hidden border-dashed bg-transparent shadow-none" aria-hidden="true" />}
      <Cover entry={selected} onRefresh={(next) => setEntries((current) => current.map((entry) => entry.id === next.id ? next : entry))} setMessage={setMessage} onSessionExpired={expireSession} />
      {side.right ? <SideCover entry={side.right} side="right" onClick={() => selectAt(index + 1)} /> : <div className="grid min-w-0 content-center gap-2.5 rounded-[18px] border border-border bg-surface p-[18px] text-left text-ink [&_strong]:text-[1rem] [&_small]:text-muted-ink mobile:hidden border-dashed bg-transparent shadow-none" aria-hidden="true" />}
    </div>
    <p className={`${ui.helperText} text-center`}>เลือกเดือนจากแถบด้านบน หรือใช้ปุ่มลูกศรเพื่อดูเดือนอื่น</p>
  </section>;
}

function SideCover({ entry, side, onClick }: { entry: HistoryEntry; side: "left" | "right"; onClick: () => void }) {
  return <button type="button" className="grid min-w-0 content-center gap-2.5 rounded-[18px] border border-border bg-surface p-[18px] text-left text-ink [&_strong]:text-[1rem] [&_small]:text-muted-ink mobile:hidden data-side:rounded-3xl" data-side={side} onClick={onClick} aria-label={`ดู ${entry.kind === "month" ? formatMonth(entry.id) : "ช่วงข้อมูลขาด"}`}><strong>{entry.kind === "month" ? formatMonth(entry.id) : "ช่วงข้อมูลขาด"}</strong><small>{entry.kind === "month" ? formatMoney(entry.view.summary.monthlySpending ?? entry.view.summary.provisionalSpending) : "—"}</small></button>;
}

function Cover({ entry, onRefresh, setMessage, onSessionExpired }: { entry: HistoryEntry; onRefresh: (entry: HistoryEntry) => void; setMessage: (message: string | null) => void; onSessionExpired: () => void }) {
  if (entry.kind === "tracking_gap") return <article className="min-w-0 rounded-[18px] border border-border bg-surface p-[clamp(20px,4vw,34px)] text-ink shadow-card [&_h1]:m-0 [&_h1]:tracking-[-0.04em] mobile:-order-1 border-dotted [&_h1]:m-0 [&_h1]:tracking-[-0.04em]"><span className={ui.statusBadge}>ช่วงหยุดติดตาม</span><p className={ui.eyebrow}>ไม่มีการบันทึกรายเดือนในช่วงนี้</p><h1>ช่วงข้อมูลขาด</h1><dl className={ui.detailList}><div><dt>เริ่ม archive</dt><dd>{formatDate(entry.archivedAt.slice(0, 10))}</dd></div><div><dt>กู้คืน</dt><dd>{entry.restoredAt ? formatDate(entry.restoredAt.slice(0, 10)) : "ยังไม่กู้คืน"}</dd></div></dl><p className={ui.helperText}>ไม่มีการคาดเดายอดเงินในช่วงนี้</p></article>;
  const view = entry.view;
  async function refresh() {
    try { onRefresh({ kind: "month", id: view.month, view: await api.month(view.month) }); setMessage(null); } catch (reason) { if (isAuthenticationError(reason)) { onSessionExpired(); return; } if (reason instanceof ApiClientError && reason.current) onRefresh({ kind: "month", id: view.month, view: reason.current }); setMessage(reason instanceof Error ? reason.message : "โหลดข้อมูลล่าสุดไม่สำเร็จ"); }
  }
  return <article className="min-w-0 rounded-[18px] border border-border bg-surface p-[clamp(20px,4vw,34px)] text-ink shadow-card [&_h1]:m-0 [&_h1]:tracking-[-0.04em] mobile:-order-1" aria-labelledby="cover-title"><div className={ui.sectionHeading}><div><p className={ui.eyebrow}>บันทึกรายเดือน</p><h1 id="cover-title">{formatMonth(view.month)}</h1></div><StatusBadge state={view.reconciliation.state} partial={view.isPartial} /></div><dl className={ui.detailList}><div><dt>ยอดตั้งต้น</dt><dd>{formatMoney(view.summary.startingBalance)}</dd></div><div><dt>รายรับ</dt><dd>{formatMoney(view.summary.income)}</dd></div><div><dt>{view.summary.endingBalance !== null ? "ยอดปลาย" : "Snapshot ล่าสุด"}</dt><dd>{formatMoney(view.summary.referenceAmount)}</dd></div><div><dt>{view.summary.monthlySpending === null ? "รายจ่ายโดยประมาณ" : "รายจ่ายทั้งเดือน"}</dt><dd>{formatMoney(view.summary.monthlySpending ?? view.summary.provisionalSpending)}</dd></div><div><dt>รายละเอียดที่ยืนยัน</dt><dd>{formatMoney(view.summary.detailTotal)}</dd></div><div><dt>ไม่ระบุรายการ</dt><dd>{formatMoney(view.summary.unitemizedSpending)}</dd></div></dl><div className="flex flex-wrap items-center gap-3.5 border-t border-border pt-4 text-muted-ink [&_button]:ml-auto"><span>{view.lifecycle === "closed" ? "ปิดเดือนแล้ว" : "ยังเปิดอยู่"}</span>{view.reconciliation.issueCodes.length ? <span>{view.reconciliation.issueCodes.length} ประเด็น</span> : <span>ข้อมูลสอดคล้อง</span>}<button className={ui.secondaryButtonCompact} type="button" onClick={() => void refresh()}>โหลดล่าสุด</button></div></article>;
}
