"use client";

import { Icon } from "./icon";

import { ui } from "@/components/ui-styles";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeControl } from "./theme-control";
import { LanguageControl } from "./language-control";
import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  home: { th: "Deledger หน้าหลัก", en: "Deledger home" },
  menu: { th: "เมนูหลัก", en: "Main navigation" },
  month: { th: "เดือนนี้", en: "This month" },
  history: { th: "ย้อนหลัง", en: "History" },
  profile: { th: "บัญชี", en: "Account" },
  logout: { th: "ออกจากระบบ", en: "Sign out" },
} satisfies Messages;
import { api, isAuthenticationError } from "@/lib/api-client";
import { useEffect, useState } from "react";

const navigationLink = "inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent px-[18px] py-0 text-[0.9rem] font-[650] whitespace-nowrap text-muted-ink no-underline hover:bg-surface-muted hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-primary-ink tablet:px-3 mobile:min-h-14 mobile:flex-1 mobile:flex-col mobile:justify-center mobile:gap-0.5 mobile:rounded-[14px] mobile:px-1 mobile:py-1.5 mobile:text-[0.75rem] forced-colors:aria-[current=page]:outline-2 forced-colors:aria-[current=page]:outline-[Highlight]";

export function Navigation() {
  const { t, errorMessage } = useCopy(copy);
  const [logoutError, setLogoutError] = useState<unknown>(null);
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [environment, setEnvironment] = useState<"local" | "qas" | "prod" | null>(null);
  useEffect(() => { void api.authMode().then((mode) => setEnvironment(mode.environment)).catch(() => setEnvironment(null)); }, []);
  return (
    <header className="mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-5 border-b border-border/45 px-8 py-6 tablet:gap-3 tablet:px-6 mobile:flex-wrap mobile:gap-1 mobile:px-5 mobile:py-4">
      <Link className="inline-flex items-center gap-2 text-[1.35rem] font-extrabold tracking-[-0.04em] text-ink no-underline mobile:text-[1.05rem]" href="/" aria-label={t("home")}><span className="grid size-9 mobile:size-8 place-items-center rounded-xl bg-primary text-[1.55rem] text-primary-ink" aria-hidden="true">d.</span>Deledger</Link>
      {!isLoginPage ? <nav aria-label={t("menu")} className="mx-auto flex gap-1 rounded-full border border-border/60 bg-surface p-[5px] shadow-card mobile:fixed mobile:inset-x-0 mobile:bottom-0 mobile:z-15 mobile:m-0 mobile:rounded-none mobile:border-0 mobile:border-t mobile:border-border mobile:px-3 mobile:pt-2 mobile:pb-[calc(8px+env(safe-area-inset-bottom))] mobile:shadow-[0_-4px_20px_rgba(0,0,0,0.04)] [&_svg]:size-5 [&_svg]:shrink-0">
        <Link className={navigationLink} href="/month" aria-current={pathname.startsWith("/month") ? "page" : undefined}><Icon name="calendar" /><span>{t("month")}</span></Link>
        <Link className={navigationLink} href="/history" aria-current={pathname.startsWith("/history") ? "page" : undefined}><Icon name="history" /><span>{t("history")}</span></Link>
        <Link className={navigationLink} href="/profile" aria-current={pathname.startsWith("/profile") ? "page" : undefined}><Icon name="account" /><span>{t("profile")}</span></Link>
      </nav> : null}
      <div className="ml-auto flex shrink-0 items-center gap-1 [&>button]:whitespace-nowrap mobile:gap-1 mobile:[&>button]:min-h-11">
      <LanguageControl />
      {!isLoginPage && environment === "local" ? <button aria-label={t("logout")} title={t("logout")} className={ui.iconButton} type="button" onClick={() => { setLogoutError(null); void api.logout().then(() => window.location.assign("/login")).catch((reason) => { if (isAuthenticationError(reason)) window.location.assign("/login"); else setLogoutError(reason); }); }}><Icon name="logout" /></button> : null}
        <ThemeControl />
      </div>
    {logoutError ? <p role="alert" className="m-0 w-full text-sm">{errorMessage(logoutError)}</p> : null}
    </header>
  );
}
