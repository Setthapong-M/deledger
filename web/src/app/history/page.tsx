"use client";

import { ui } from "@/components/ui-styles";

import { AppShell } from "@/components/app-shell";
import { HistoryExplorer } from "@/components/history-explorer";

export default function HistoryPage() {
  return <AppShell><div className={ui.pageHeading}><div><p className={ui.eyebrow}>มองย้อนกลับไป</p><h1>ประวัติรายเดือน</h1><p className={`${ui.helperText} mb-0`}>ยอดเงินและสถานะของแต่ละเดือน อยู่ด้วยกันที่นี่</p></div></div><HistoryExplorer /></AppShell>;
}
