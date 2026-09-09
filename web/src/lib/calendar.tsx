"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Calendar } from "./api-client";

type Context = { calendar: Calendar | null; error: unknown; refresh: () => Promise<void>; accept: (value: Calendar) => void };
const CalendarContext = createContext<Context>({ calendar: null, error: null, refresh: async () => {}, accept: () => {} });

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [error, setError] = useState<unknown>(null);
  const sequence = useRef(0);
  const accept = useCallback((value: Calendar) => {
    sequence.current++;
    setCalendar(value);
    setError(null);
  }, []);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const value = await api.calendar();
      if (request === sequence.current) { setCalendar(value); setError(null); }
    } catch (reason) {
      if (request === sequence.current) setError(reason);
    }
  }, []);
  useEffect(() => {
    const reload = () => { void refresh(); };
    reload();
    window.addEventListener("focus", reload);
    window.addEventListener("deledger-calendar-refresh", reload);
    const interval = window.setInterval(reload, 30_000);
    return () => { sequence.current++; window.clearInterval(interval); window.removeEventListener("focus", reload); window.removeEventListener("deledger-calendar-refresh", reload); };
  }, [refresh]);
  return <CalendarContext.Provider value={{ calendar, error, refresh, accept }}>{children}</CalendarContext.Provider>;
}

export function useCalendar() { return useContext(CalendarContext); }

export function useFinancialClock() {
  const { calendar } = useCalendar();
  const [token] = useState(calendar?.clockRevision);
  return token;
}
