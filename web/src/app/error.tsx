"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <AppShell><section className="card empty-state"><h1>เกิดข้อผิดพลาด</h1><p>ข้อมูลเดิมยังปลอดภัย ลองโหลดหน้านี้อีกครั้ง</p><button className="primary-button" type="button" onClick={reset}>ลองใหม่</button></section></AppShell>;
}
