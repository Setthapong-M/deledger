"use client";

import type { ReactNode } from "react";
import { Navigation } from "./navigation";

export function AppShell({ children, notice }: { children: ReactNode; notice?: string }) {
  return (
    <div className="min-h-screen">
      <a className="fixed top-2 left-4 z-30 -translate-y-[150%] rounded-xl bg-surface px-[18px] py-3 text-ink underline not-focus:size-px not-focus:overflow-hidden not-focus:p-0 not-focus:whitespace-nowrap not-focus:[clip-path:inset(50%)] focus:translate-y-0" href="#main-content">ข้ามไปเนื้อหา</a>
      <Navigation />
      <main id="main-content" className="mx-auto w-full max-w-[1180px] px-8 pt-5 pb-20 mobile:px-5 mobile:pt-2 mobile:pb-[calc(110px+env(safe-area-inset-bottom))]" tabIndex={-1}>
        {notice ? <p className="border border-dashed border-border px-4 py-3 text-muted-ink" role="status">{notice}</p> : null}
        {children}
      </main>
    </div>
  );
}
