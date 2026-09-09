import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { now } from "./clock.js";
import { DomainError } from "./errors.js";

const context = new AsyncLocalStorage<{ date: string; revision: string }>();
const boot = randomUUID();
let sequence = 0;
let override: string | null = null;
let lastDate: string | null = null;
let tail: Promise<void> = Promise.resolve();

function realDate() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now());
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}-${parts.find(p => p.type === "day")!.value}`;
}

function bound(date: string, delta: number) {
  const day = Number(date.slice(8));
  const target = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  target.setUTCMonth(target.getUTCMonth() + delta);
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

export function readCalendarContext(local: boolean) {
  const real = realDate();
  const date = local ? override ?? real : real;
  if (local && lastDate !== date) { lastDate = date; sequence++; }
  return { businessDate: date, realDate: real, mode: local && override !== null ? "simulated" as const : "real" as const, canSimulate: local, clockRevision: local ? `${boot}:${sequence}` : null, minDate: bound(real, -24), maxDate: bound(real, 24) };
}

export function effectiveBusinessDate(fallback: string): string {
  return context.getStore()?.date ?? fallback;
}

export function assertClockRevision(revision: string | null) {
  if (revision !== null && revision !== (context.getStore()?.revision ?? readCalendarContext(true).clockRevision)) throw new DomainError("CLOCK_CONFLICT", "วันที่ระบบเปลี่ยนแล้ว โหลดข้อมูลใหม่ก่อนบันทึก");
}

export function changeLocalDate(date: string | null, revision: string) {
  if (!context.getStore()) throw new Error("clock changes require the local calendar gate");
  const state = readCalendarContext(true);
  if (revision !== state.clockRevision) throw new DomainError("CLOCK_CONFLICT", "วันที่ระบบเปลี่ยนแล้ว โหลดข้อมูลใหม่ก่อนบันทึก");
  if (date !== null) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || date < state.minDate || date > state.maxDate) throw new DomainError("INVALID_INPUT", "เลือกวันที่ภายในช่วงที่กำหนด", "date");
  }
  if (date !== override) { override = date; lastDate = date ?? state.realDate; sequence++; }
  return readCalendarContext(true);
}

export async function withCalendarGate<T>(local: boolean, operation: () => Promise<T>): Promise<T> {
  if (!local || context.getStore()) return operation();
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const calendar = readCalendarContext(true);
    return await context.run({ date: calendar.businessDate, revision: calendar.clockRevision! }, operation);
  } finally { release(); }
}
