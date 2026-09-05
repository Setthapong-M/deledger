"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeControl } from "./theme-control";
import { api, isAuthenticationError } from "@/lib/api-client";
import { useEffect, useState } from "react";

export function Navigation() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [environment, setEnvironment] = useState<"local" | "qas" | "prod" | null>(null);
  useEffect(() => { void api.authMode().then((mode) => setEnvironment(mode.environment)).catch(() => setEnvironment(null)); }, []);
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Deledger หน้าหลัก"><span className="brand-mark" aria-hidden="true">d.</span>Deledger</Link>
      {!isLoginPage ? <nav aria-label="เมนูหลัก" className="nav-links">
        <Link href="/month" aria-current={pathname.startsWith("/month") ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-11 5h2" /></svg><span>เดือนนี้</span></Link>
        <Link href="/history" aria-current={pathname.startsWith("/history") ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7m2-4v5l3 2" /></svg><span>ประวัติ</span></Link>
        <Link href="/profile" aria-current={pathname.startsWith("/profile") ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg><span>ข้อมูลส่วนตัว</span></Link>
      </nav> : null}
      <div className="nav-actions">
      {!isLoginPage && environment === "local" ? <button className="secondary-button compact" type="button" onClick={() => { void api.logout().then(() => window.location.assign("/login")).catch((reason) => { if (isAuthenticationError(reason)) window.location.assign("/login"); }); }}>ออกจากระบบ</button> : null}
        <ThemeControl />
      </div>
    </header>
  );
}
