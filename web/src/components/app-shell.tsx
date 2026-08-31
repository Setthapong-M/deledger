"use client";

import type { ReactNode } from "react";
import { Navigation } from "./navigation";

export function AppShell({ children, notice }: { children: ReactNode; notice?: string }) {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="app-main">
        {notice ? <p className="access-notice" role="status">{notice}</p> : null}
        {children}
      </main>
    </div>
  );
}
