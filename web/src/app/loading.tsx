import { ui } from "@/components/ui-styles";
import { AppShell } from "@/components/app-shell";

export default function Loading() {
  return <AppShell><section className="grid gap-[18px]" aria-busy="true"><div className={`${ui.skeleton} h-[220px]`} /><div className={`${ui.skeleton} h-80`} /></section></AppShell>;
}
