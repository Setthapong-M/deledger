"use client";

import { ui } from "@/components/ui-styles";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Preference = "system" | "light" | "dark";

function systemIsDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function ThemeControl() {
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
  const label = displayedPreference === "system" ? `ตามระบบ (${resolvedDark ? "มืด" : "สว่าง"})` : displayedPreference === "dark" ? "มืด" : "สว่าง";

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
      <button className={ui.iconButton} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`ธีม: ${label}`} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">{resolvedDark ? "☾" : "☀"}</span>
      </button>
      {open ? (
        <div className="absolute top-[50px] right-0 z-10 min-w-[150px] rounded-xl border border-border bg-surface p-1.5 shadow-card [&_button]:grid [&_button]:min-h-[42px] [&_button]:w-full [&_button]:grid-cols-[20px_1fr] [&_button]:items-center [&_button]:rounded-lg [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-left [&_button]:text-ink [&_button:hover]:bg-surface-muted [&_button[aria-checked=true]]:bg-surface-muted" role="menu" aria-label="เลือกธีม">
          {(["system", "light", "dark"] as const).map((value) => {
            const text = value === "system" ? "ตามระบบ" : value === "light" ? "สว่าง" : "มืด";
            return (
              <button key={value} type="button" role="menuitemradio" aria-checked={preference === value} onClick={() => choose(value)}>
                <span aria-hidden="true">{preference === value ? "✓" : ""}</span>{text}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
