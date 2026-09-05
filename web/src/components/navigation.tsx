"use client";

import { ui } from "@/components/ui-styles";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeControl } from "./theme-control";
import { api, isAuthenticationError } from "@/lib/api-client";
import { useEffect, useState } from "react";

const navigationLink = "inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent px-[18px] py-0 text-[0.9rem] font-[650] whitespace-nowrap text-muted-ink no-underline hover:bg-surface-muted hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-primary-ink tablet:px-3 mobile:min-h-14 mobile:flex-1 mobile:flex-col mobile:justify-center mobile:gap-0.5 mobile:rounded-[14px] mobile:px-1 mobile:py-1.5 mobile:text-[0.75rem] forced-colors:aria-[current=page]:outline-2 forced-colors:aria-[current=page]:outline-[Highlight]";

export function Navigation() {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [environment, setEnvironment] = useState<"local" | "qas" | "prod" | null>(null);
  useEffect(() => { void api.authMode().then((mode) => setEnvironment(mode.environment)).catch(() => setEnvironment(null)); }, []);
  return (
    <header className="mx-auto flex w-full max-w-[1240px] items-center gap-7 border-b border-border/45 px-8 py-6 tablet:gap-3 tablet:px-6 mobile:flex-wrap mobile:px-5 mobile:py-4">
      <Link className="inline-flex items-center gap-2.5 text-[1.35rem] font-extrabold tracking-[-0.04em] text-ink no-underline mobile:text-[1.2rem]" href="/" aria-label="Deledger หน้าหลัก"><span className="grid size-9 place-items-center rounded-xl bg-primary text-[1.55rem] text-primary-ink" aria-hidden="true">d.</span>Deledger</Link>
      {!isLoginPage ? <nav aria-label="เมนูหลัก" className="mx-auto flex gap-1 rounded-full border border-border/60 bg-surface p-[5px] shadow-card mobile:fixed mobile:inset-x-0 mobile:bottom-0 mobile:z-15 mobile:m-0 mobile:rounded-none mobile:border-0 mobile:border-t mobile:border-border mobile:px-3 mobile:pt-2 mobile:pb-[calc(8px+env(safe-area-inset-bottom))] mobile:shadow-[0_-4px_20px_rgba(0,0,0,0.04)] [&_svg]:size-5 [&_svg]:shrink-0">
        <Link className={navigationLink} href="/month" aria-current={pathname.startsWith("/month") ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16m-11 5h2" /></svg><span>เดือนนี้</span></Link>
        <Link className={navigationLink} href="/history" aria-current={pathname.startsWith("/history") ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7m2-4v5l3 2" /></svg><span>ประวัติ</span></Link>
        <Link className={navigationLink} href="/profile" aria-current={pathname.startsWith("/profile") ? "page" : undefined}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg><span>ข้อมูลส่วนตัว</span></Link>
      </nav> : null}
      <div className="ml-auto flex shrink-0 items-center gap-3 [&>button]:whitespace-nowrap mobile:gap-1 mobile:[&>button]:min-h-11">
      {!isLoginPage && environment === "local" ? <button className={ui.secondaryButtonCompact} type="button" onClick={() => { void api.logout().then(() => window.location.assign("/login")).catch((reason) => { if (isAuthenticationError(reason)) window.location.assign("/login"); }); }}>ออกจากระบบ</button> : null}
        <ThemeControl />
      </div>
    </header>
  );
}
