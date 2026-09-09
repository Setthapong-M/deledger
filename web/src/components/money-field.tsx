"use client";

import { ui } from "@/components/ui-styles";

export function MoneyField({ label, value, onChange, id, error, disabled = false }: { label: string; value: string; onChange: (value: string) => void; id: string; error?: string; disabled?: boolean }) {
  return (
    <label className={ui.field} htmlFor={id}>
      <span>{label}</span>
      <input id={id} name={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(event) => {
        const next = event.target.value;
        if (/^\d*(?:\.\d{0,2})?$/.test(next)) onChange(next);
      }} onPaste={(event) => {
        event.preventDefault();
        if (disabled) return;
        const pasted = event.clipboardData.getData("text").trim()
          .replace(/^(?:฿|THB)\s*/i, "").replace(/\s*(?:บาท|THB)$/i, "");
        if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(pasted)) return;
        const input = event.currentTarget;
        const start = input.selectionStart ?? value.length;
        const end = input.selectionEnd ?? start;
        const digits = pasted.replaceAll(",", "");
        const next = value.slice(0, start) + digits + value.slice(end);
        if (!/^\d*(?:\.\d{0,2})?$/.test(next)) return;
        onChange(next);
        requestAnimationFrame(() => {
          if (input.isConnected && document.activeElement === input) input.setSelectionRange(start + digits.length, start + digits.length);
        });
      }} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      {error ? <small id={`${id}-error`} className={ui.fieldError}>{error}</small> : null}
    </label>
  );
}
