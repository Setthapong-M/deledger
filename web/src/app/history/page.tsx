"use client";

import { AppShell } from "@/components/app-shell";
import { HistoryExplorer } from "@/components/history-explorer";

export default function HistoryPage() {
  return <AppShell><div className="page-heading"><div><p className="eyebrow">ARCHIVE VIEW</p><h1>ประวัติรายเดือน</h1><p className="helper-text">กวาดตาดูเดือนที่ข้อมูลยังไม่ครบได้จากแถบด้านบน</p></div></div><HistoryExplorer /></AppShell>;
}
