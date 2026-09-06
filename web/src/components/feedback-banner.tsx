import { ui } from "@/components/ui-styles";
export function FeedbackBanner({ children, tone = "neutral", onDismiss }: { children: React.ReactNode; tone?: "neutral" | "warning"; onDismiss?: () => void }) {
  return <div className="my-3 flex items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-muted px-3.5 py-3 data-warning:border-2 data-warning:border-double data-warning:border-state-strong" data-warning={tone === "warning" ? "" : undefined} role="status"><span>{children}</span>{onDismiss ? <button type="button" className={ui.textButton} onClick={onDismiss}>ปิด</button> : null}</div>;
}
