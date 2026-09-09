"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  choose: { th: "เลือกวันที่", en: "Choose a date" },
  calendar: { th: "ปฏิทินเลือกวันที่", en: "Date picker" },
  previous: { th: "เดือนก่อนหน้า", en: "Previous month" },
  next: { th: "เดือนถัดไป", en: "Next month" },
  month: { th: "เดือน", en: "Month" },
  year: { th: "ปี", en: "Year" },
  clear: { th: "ล้างวันที่", en: "Clear" },
  today: { th: "วันนี้", en: "Today" },
} satisfies Messages;

function iso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parse(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day, 12) : new Date();
}

export function DateInput({ id, value, onValueChange, min, max, today: accountingToday, disabled, "aria-labelledby": labelledBy, "aria-describedby": describedBy, "aria-invalid": invalid }: {
  id: string; value: string; onValueChange: (value: string) => void;
  min?: string; max?: string; today?: string; disabled?: boolean;
  "aria-labelledby"?: string; "aria-describedby"?: string; "aria-invalid"?: boolean;
}) {
  const { locale, t } = useCopy(copy);
  const th = locale === "th";
  const language = th ? "th-TH" : "en-GB";
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => parse(value));
  const [focused, setFocused] = useState(() => iso(parse(value)));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const keyboardFocus = useRef(false);
  const today = accountingToday ?? iso(new Date());
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max);
  const bounded = (date: string) => min && date < min ? min : max && date > max ? max : date;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1, 12).getDay();
  const count = new Date(year, monthIndex + 1, 0, 12).getDate();
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(language, { month: "long" }).format(new Date(2024, index, 1)));

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[data-day][tabindex="0"]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (keyboardFocus.current) {
      root.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
      keyboardFocus.current = false;
    }
  }, [focused]);

  function close() { setOpen(false); trigger.current?.focus(); }
  function choose(next: string) { if (next && !allowed(next)) return; onValueChange(next); close(); }
  function changeMonth(next: Date) { const date = bounded(iso(next)); setMonth(parse(date)); setFocused(date); }

  return <div ref={root} className="min-w-0" onKeyDown={event => {
    if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
  }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button ref={trigger} id={id} disabled={disabled} type="button" aria-labelledby={labelledBy} aria-describedby={describedBy} aria-invalid={invalid} aria-expanded={open} aria-controls={open ? `${id}-calendar` : undefined}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-input px-3 py-2.5 text-left font-medium text-ink hover:border-primary-ink aria-expanded:border-primary-ink aria-invalid:border-state-strong"
      onClick={() => { if (open) close(); else { const next = parse(bounded(value || today)); setMonth(next); setFocused(iso(next)); setOpen(true); } }}>
      <span className={value ? "" : "text-muted-ink"}>{value ? new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(parse(value)) : t("choose")}</span>
      <span className="grid size-8 shrink-0 place-items-center"><Icon name="calendar" /></span>
    </button>
    <input type="hidden" name={id} value={value} />
    {open ? <div id={`${id}-calendar`} role="group" aria-label={t("calendar")} className="date-calendar mt-2 w-full max-w-[380px] rounded-2xl border border-border bg-surface p-3 text-ink shadow-card">
      <div className="date-calendar-header mb-3 grid grid-cols-[32px_minmax(0,1fr)_88px_32px] items-center gap-2">
        <button type="button" className="grid h-11 w-8 shrink-0 place-items-center rounded-xl hover:bg-surface-muted" aria-label={t("previous")} onClick={() => changeMonth(new Date(year, monthIndex - 1, 1, 12))}><Icon name="previous" /></button>
        <select aria-label={t("month")} className="min-h-11 min-w-0 w-full rounded-lg bg-surface px-2 font-semibold" value={monthIndex} onChange={event => changeMonth(new Date(year, Number(event.target.value), 1, 12))}>{months.map((name, index) => <option key={index} value={index}>{name}</option>)}</select>
        <select aria-label={t("year")} className="min-h-11 min-w-0 w-full rounded-lg bg-surface px-2 font-semibold" value={year} onChange={event => changeMonth(new Date(Number(event.target.value), monthIndex, 1, 12))}>{Array.from({ length: Math.max(2100, year) - Math.min(1900, year) + 1 }, (_, index) => Math.min(1900, year) + index).map(option => <option key={option} value={option}>{th ? option + 543 : option}</option>)}</select>
        <button type="button" className="grid h-11 w-8 shrink-0 place-items-center rounded-xl hover:bg-surface-muted" aria-label={t("next")} onClick={() => changeMonth(new Date(year, monthIndex + 1, 1, 12))}><Icon name="next" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {(th ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]).map(day => <span key={day} className="py-1 text-xs font-medium text-muted-ink">{day}</span>)}
        {Array.from({ length: first }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: count }, (_, index) => {
          const date = new Date(year, monthIndex, index + 1, 12);
          const key = iso(date);
          return <button key={key} disabled={!allowed(key)} data-day={key} type="button" tabIndex={focused === key ? 0 : -1} aria-pressed={value === key} aria-current={today === key ? "date" : undefined} aria-label={new Intl.DateTimeFormat(language, { dateStyle: "full" }).format(date)}
            className="aspect-square min-h-9 rounded-xl border border-transparent p-0 font-medium hover:bg-primary/30 aria-pressed:bg-primary aria-pressed:text-primary-ink aria-[current=date]:border-primary-ink"
            onClick={() => choose(key)} onKeyDown={event => {
              const shifts: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -date.getDay(), End: 6 - date.getDay() };
              const shift = shifts[event.key];
              if (shift === undefined && event.key !== "PageUp" && event.key !== "PageDown") return;
              event.preventDefault();
              const next = shift !== undefined ? new Date(year, monthIndex, index + 1 + shift, 12) : new Date(year, monthIndex + (event.key === "PageUp" ? -1 : 1), 1, 12);
              keyboardFocus.current = true; setFocused(bounded(iso(next))); setMonth(parse(bounded(iso(next))));
            }}>{index + 1}</button>;
        })}
      </div>
      <div className="mt-3 flex justify-between border-t border-border pt-2 text-sm">
        <button type="button" className="min-h-10 rounded-xl px-3 hover:bg-surface-muted" onClick={() => choose("")}>{t("clear")}</button>
        <button type="button" disabled={!allowed(today)} className="min-h-10 rounded-xl bg-primary/20 px-3" onClick={() => choose(today)}>{t("today")}</button>
      </div>
    </div> : null}
  </div>;
}
