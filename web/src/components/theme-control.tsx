"use client";

import { useEffect, useRef, useState } from "react";

type Preference = "system" | "light" | "dark";

function systemIsDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeControl() {
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

  const resolvedDark = preference === "dark" || (preference === "system" && systemDark);
  const label = preference === "system" ? `ตามระบบ (${resolvedDark ? "มืด" : "สว่าง"})` : preference === "dark" ? "มืด" : "สว่าง";

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
    <div className="theme-control" ref={menuRef}>
      <button className="icon-button" type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`ธีม: ${label}`} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">{resolvedDark ? "☾" : "☀"}</span>
      </button>
      {open ? (
        <div className="theme-menu" role="menu" aria-label="เลือกธีม">
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
