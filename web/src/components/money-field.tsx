"use client";

export function MoneyField({ label, value, onChange, id, error, disabled = false }: { label: string; value: string; onChange: (value: string) => void; id: string; error?: string; disabled?: boolean }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} name={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      {error ? <small id={`${id}-error`} className="field-error">{error}</small> : null}
    </label>
  );
}
