"use client";

import type { ReactNode } from "react";
import { Navigation } from "./navigation";

export function AppShell({ children, notice }: { children: ReactNode; notice?: string }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">ข้ามไปเนื้อหา</a>
      <Navigation />
      <main id="main-content" className="app-main" tabIndex={-1}>
        {notice ? <p className="access-notice" role="status">{notice}</p> : null}
        {children}
      </main>
    </div>
  );
}
