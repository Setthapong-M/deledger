"use client";

import { ui } from "@/components/ui-styles";

import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <AppShell><section className={`${ui.card} ${ui.emptyState}`}><h1>เกิดข้อผิดพลาด</h1><p>ข้อมูลเดิมยังปลอดภัย ลองโหลดหน้านี้อีกครั้ง</p><button className={ui.primaryButton} type="button" onClick={reset}>ลองใหม่</button></section></AppShell>;
}
