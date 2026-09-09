"use client";

import { Icon } from "./icon";

import { ui } from "@/components/ui-styles";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useCopy, type Messages } from "@/lib/i18n";

const copy = {
  system: { th: "ตามระบบ", en: "System" },
  light: { th: "สว่าง", en: "Light" },
  dark: { th: "มืด", en: "Dark" },
  theme: { th: "ธีม: {name}", en: "Theme: {name}" },
  choose: { th: "เลือกธีม", en: "Choose a theme" },
} satisfies Messages;

type Preference = "system" | "light" | "dark";

function systemIsDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ThemeControl() {
  const { t } = useCopy(copy);
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const [preference, setPreference] = useState<Preference>(() => {
    if (typeof document === "undefined") return "system";
    const theme = document.documentElement.dataset.theme;
    return theme === "light" || theme === "dark" ? theme : "system";
  });
  const [systemDark, setSystemDark] = useState(systemIsDark);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const displayedPreference = hydrated ? preference : "system";
  const resolvedDark = hydrated && (preference === "dark" || (preference === "system" && systemDark));
  const label = displayedPreference === "system" ? `${t("system")} (${t(resolvedDark ? "dark" : "light")})` : t(displayedPreference);

  function choose(next: Preference) {
    setPreference(next);
    if (next === "system") {
      delete document.documentElement.dataset.theme;
      document.cookie = "deledger_theme=; Path=/; Max-Age=0; SameSite=Strict";
    } else {
      document.documentElement.dataset.theme = next;
      document.cookie = `deledger_theme=${next}; Path=/; Max-Age=31536000; SameSite=Strict`;
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button className={ui.iconButton} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={t("theme", { name: label })} title={t("theme", { name: label })} onClick={() => setOpen((value) => !value)}>
        <Icon name={resolvedDark ? "moon" : "sun"} />
      </button>
      {open ? (
        <div className="absolute top-[50px] right-0 z-10 min-w-[150px] rounded-xl border border-border bg-surface p-1.5 shadow-card [&_button]:grid [&_button]:min-h-[42px] [&_button]:w-full [&_button]:grid-cols-[20px_1fr] [&_button]:items-center [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-left [&_button]:text-ink [&_button:hover]:bg-surface-muted [&_button[aria-checked=true]]:bg-surface-muted" role="menu" aria-label={t("choose")}>
          {(["system", "light", "dark"] as const).map((value) => {
            const text = t(value);
            return (
              <button key={value} type="button" role="menuitemradio" aria-checked={preference === value} onClick={() => choose(value)}>
                <span className="inline-flex size-5">{preference === value ? <Icon name="check" /> : null}</span>{text}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
