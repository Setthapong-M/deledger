import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return <AppShell><section className="page-loading" aria-busy="true"><div className="skeleton skeleton-summary" /><div className="skeleton skeleton-card" /></section></AppShell>;
}
