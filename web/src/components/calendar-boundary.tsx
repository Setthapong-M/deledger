"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { CalendarProvider, useCalendar } from "@/lib/calendar";
import { useLocale } from "@/lib/i18n";
import { isAuthenticationError } from "@/lib/api-client";

function Ready({ children }: { children: ReactNode }) {
  const { calendar, error, refresh } = useCalendar();
  const { locale } = useLocale();
  useEffect(() => {
    if (isAuthenticationError(error)) window.location.assign("/login");
  }, [error]);
  if (calendar) return children;
  return <main className="p-8" aria-live="polite">{error ? <><p>{locale === "th" ? "โหลดวันที่ระบบไม่ได้" : "Could not load the system date."}</p><button onClick={() => void refresh()}>{locale === "th" ? "ลองใหม่" : "Try again"}</button> · <a href="/login">{locale === "th" ? "เข้าสู่ระบบ" : "Sign in"}</a></> : <p>{locale === "th" ? "กำลังโหลด…" : "Loading…"}</p>}</main>;
}

export function CalendarBoundary({ children }: { children: ReactNode }) {
  const path = usePathname();
  return path === "/login" ? children : <CalendarProvider><Ready>{children}</Ready></CalendarProvider>;
}
