"use client";

import { AppShell } from "@/components/app-shell";
import { HistoryExplorer } from "@/components/history-explorer";

export default function HistoryPage() {
  return <AppShell><div className="page-heading"><div><p className="eyebrow">มองย้อนกลับไป</p><h1>ประวัติรายเดือน</h1><p className="helper-text">ยอดเงินและสถานะของแต่ละเดือน อยู่ด้วยกันที่นี่</p></div></div><HistoryExplorer /></AppShell>;
}
