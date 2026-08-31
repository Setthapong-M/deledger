export function FeedbackBanner({ children, tone = "neutral", onDismiss }: { children: React.ReactNode; tone?: "neutral" | "warning"; onDismiss?: () => void }) {
  return <div className={`feedback feedback-${tone}`} role="status"><span>{children}</span>{onDismiss ? <button type="button" className="text-button" onClick={onDismiss}>ปิด</button> : null}</div>;
}
