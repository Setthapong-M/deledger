"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeControl } from "./theme-control";
import { api, isAuthenticationError } from "@/lib/api-client";
import { useEffect, useState } from "react";

export function Navigation() {
  const pathname = usePathname();
  const [environment, setEnvironment] = useState<"local" | "qas" | "prod" | null>(null);
  useEffect(() => { void api.authMode().then((mode) => setEnvironment(mode.environment)).catch(() => setEnvironment(null)); }, []);
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Deledger หน้าหลัก">Deledger</Link>
      <nav aria-label="เมนูหลัก" className="nav-links">
        <Link href="/month" aria-current={pathname.startsWith("/month") ? "page" : undefined}>เดือนนี้</Link>
        <Link href="/history" aria-current={pathname.startsWith("/history") ? "page" : undefined}>ประวัติ</Link>
        <Link href="/profile" aria-current={pathname.startsWith("/profile") ? "page" : undefined}>ข้อมูลส่วนตัว</Link>
      </nav>
      {environment === "local" ? <button className="secondary-button compact" type="button" onClick={() => { void api.logout().then(() => window.location.assign("/login")).catch((reason) => { if (isAuthenticationError(reason)) window.location.assign("/login"); }); }}>ออกจากระบบ</button> : null}
      <ThemeControl />
    </header>
  );
}
