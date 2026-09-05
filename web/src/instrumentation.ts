import { loadConfig } from "./server/config";

export function register(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  loadConfig();
}
