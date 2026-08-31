"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Dialog({ title, description, children, onClose, labelledBy = "dialog-title" }: { title: string; description?: string; children: ReactNode; onClose: () => void; labelledBy?: string }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])");
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="dialog-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={description ? `${labelledBy}-description` : undefined}>
        <div className="dialog-heading">
          <div><h2 id={labelledBy}>{title}</h2>{description ? <p id={`${labelledBy}-description`}>{description}</p> : null}</div>
          <button type="button" className="icon-button" aria-label="ปิดหน้าต่าง" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
