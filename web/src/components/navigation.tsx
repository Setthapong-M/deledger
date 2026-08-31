"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeControl } from "./theme-control";

export function Navigation() {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="Deledger หน้าหลัก">Deledger</Link>
      <nav aria-label="เมนูหลัก" className="nav-links">
        <Link href="/month" aria-current={pathname.startsWith("/month") ? "page" : undefined}>เดือนนี้</Link>
        <Link href="/history" aria-current={pathname.startsWith("/history") ? "page" : undefined}>ประวัติ</Link>
      </nav>
      <ThemeControl />
    </header>
  );
}
