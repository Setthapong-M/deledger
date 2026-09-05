"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { api, ApiClientError, isAuthenticationError, type HistoryEntry } from "@/lib/api-client";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { StatusBadge } from "./status-badge";
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
  if (loading) return <section className="history-loading card" aria-busy="true"><div className="skeleton skeleton-filmstrip" /><div className="skeleton skeleton-cover" /></section>;
  if (!selected) return <section className="empty-state card"><h1>ยังไม่มีประวัติรายเดือน</h1><p>เมื่อเริ่มเดือนแรกแล้ว ข้อมูลจะปรากฏที่นี่</p></section>;
  return <section className="history-explorer" aria-label="ประวัติรายเดือน" onKeyDown={keyNavigate}>
    {message ? <FeedbackBanner tone="warning" onDismiss={() => setMessage(null)}>{message}</FeedbackBanner> : null}
    <div className="filmstrip" role="tablist" aria-label="เลือกเดือน"><button type="button" className="filmstrip-arrow" aria-label="เดือนก่อนหน้า" onClick={() => selectAt(index - 1)} disabled={index <= 0}>‹</button>{entries.map((entry, entryIndex) => <button key={entry.id} type="button" role="tab" aria-selected={entry.id === selected.id} aria-current={entry.id === selected.id ? "true" : undefined} className={`film-card${entry.id === selected.id ? " is-selected" : ""}${entry.kind === "tracking_gap" ? " is-gap" : ""}`} onClick={() => selectAt(entryIndex)}><span>{entry.kind === "month" ? formatMonth(entry.id) : "ช่วงข้อมูลขาด"}</span><small>{entry.kind === "month" ? entry.view.reconciliation.state.replaceAll("_", " ") : "Tracking Gap"}</small></button>)}<button type="button" className="filmstrip-arrow" aria-label="เดือนถัดไป" onClick={() => selectAt(index + 1)} disabled={index >= entries.length - 1}>›</button></div>
    <div className="cover-flow" tabIndex={0}>
      {side.left ? <SideCover entry={side.left} side="left" onClick={() => selectAt(index - 1)} /> : <div className="side-cover placeholder-cover" aria-hidden="true" />}
      <Cover entry={selected} onRefresh={(next) => setEntries((current) => current.map((entry) => entry.id === next.id ? next : entry))} setMessage={setMessage} onSessionExpired={expireSession} />
      {side.right ? <SideCover entry={side.right} side="right" onClick={() => selectAt(index + 1)} /> : <div className="side-cover placeholder-cover" aria-hidden="true" />}
    </div>
    <p className="helper-text history-hint">ใช้ปุ่มลูกศรหรือกวาดซ้ายขวาเพื่อดูเดือนอื่น</p>
  </section>;
}

function SideCover({ entry, side, onClick }: { entry: HistoryEntry; side: "left" | "right"; onClick: () => void }) {
  return <button type="button" className={`side-cover side-${side}`} onClick={onClick} aria-label={`ดู ${entry.kind === "month" ? formatMonth(entry.id) : "ช่วงข้อมูลขาด"}`}><strong>{entry.kind === "month" ? formatMonth(entry.id) : "ช่วงข้อมูลขาด"}</strong><small>{entry.kind === "month" ? formatMoney(entry.view.summary.monthlySpending ?? entry.view.summary.provisionalSpending) : "—"}</small></button>;
}

function Cover({ entry, onRefresh, setMessage, onSessionExpired }: { entry: HistoryEntry; onRefresh: (entry: HistoryEntry) => void; setMessage: (message: string | null) => void; onSessionExpired: () => void }) {
  if (entry.kind === "tracking_gap") return <article className="cover-card tracking-gap-card"><StatusBadge state="needs_information" /><p className="eyebrow">TRACKING GAP</p><h1>ช่วงข้อมูลขาด</h1><dl className="detail-list"><div><dt>เริ่ม archive</dt><dd>{formatDate(entry.archivedAt.slice(0, 10))}</dd></div><div><dt>กู้คืน</dt><dd>{entry.restoredAt ? formatDate(entry.restoredAt.slice(0, 10)) : "ยังไม่กู้คืน"}</dd></div></dl><p className="helper-text">ไม่มีการคาดเดายอดเงินในช่วงนี้</p></article>;
  const view = entry.view;
  async function refresh() {
    try { onRefresh({ kind: "month", id: view.month, view: await api.month(view.month) }); setMessage(null); } catch (reason) { if (isAuthenticationError(reason)) { onSessionExpired(); return; } if (reason instanceof ApiClientError && reason.current) onRefresh({ kind: "month", id: view.month, view: reason.current }); setMessage(reason instanceof Error ? reason.message : "โหลดข้อมูลล่าสุดไม่สำเร็จ"); }
  }
  return <article className="cover-card" aria-labelledby="cover-title"><div className="section-heading"><div><p className="eyebrow">REPORTING MONTH</p><h1 id="cover-title">{formatMonth(view.month)}</h1></div><StatusBadge state={view.reconciliation.state} partial={view.isPartial} /></div><dl className="detail-list"><div><dt>ยอดตั้งต้น</dt><dd>{formatMoney(view.summary.startingBalance)}</dd></div><div><dt>รายรับ</dt><dd>{formatMoney(view.summary.income)}</dd></div><div><dt>{view.summary.endingBalance !== null ? "ยอดปลาย" : "Snapshot ล่าสุด"}</dt><dd>{formatMoney(view.summary.referenceAmount)}</dd></div><div><dt>รายจ่ายทั้งเดือน</dt><dd>{formatMoney(view.summary.monthlySpending ?? view.summary.provisionalSpending)}</dd></div><div><dt>รายละเอียดที่ยืนยัน</dt><dd>{formatMoney(view.summary.detailTotal)}</dd></div><div><dt>ไม่ระบุรายการ</dt><dd>{formatMoney(view.summary.unitemizedSpending)}</dd></div></dl><div className="cover-footer"><span>{view.lifecycle === "closed" ? "ปิดเดือนแล้ว" : "ยังเปิดอยู่"}</span>{view.reconciliation.issueCodes.length ? <span>{view.reconciliation.issueCodes.length} ประเด็น</span> : <span>ข้อมูลสอดคล้อง</span>}<button className="secondary-button compact" type="button" onClick={() => void refresh()}>โหลดล่าสุด</button></div></article>;
}
