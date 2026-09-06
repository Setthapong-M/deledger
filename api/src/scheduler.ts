import { identityPrisma } from "./server/db/pool.js";
import { catchUpOwner } from "./server/services/catch-up.js";

const intervalMs = 60_000;
let lastSuccess = 0;
let running: Promise<void> | undefined;

export async function runScheduledCatchUp(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const owners = await identityPrisma.app_user.findMany({ select: { id: true } });
    for (const owner of owners) {
      await identityPrisma.$transaction(client => catchUpOwner(client, owner.id), { timeout: 60_000 });
    }
    lastSuccess = Date.now();
  })();
  try { await running; } finally { running = undefined; }
}

export function schedulerReadiness(): boolean {
  return lastSuccess > 0 && Date.now() - lastSuccess < 5 * intervalMs;
}

export function startScheduler(): () => void {
  const tick = () => { void runScheduledCatchUp().catch(() => console.error("scheduled catch-up failed")); };
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
