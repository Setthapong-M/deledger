import type { PoolClient } from "pg";
import type { LifecycleState, MonthView } from "../domain/contracts";
import { getCurrentMonthStart, getMonthView } from "../repositories/months";
import { getCurrentUser } from "../repositories/users";

export type BootstrapState = {
  state: LifecycleState;
  month: MonthView | null;
};

export async function readBootstrap(client: PoolClient, ownerId: string): Promise<BootstrapState> {
  const user = await getCurrentUser(client, ownerId);
  const currentMonthStart = await getCurrentMonthStart(client, ownerId);
  if (currentMonthStart === null) return { state: "onboarding_required", month: null };
  const month = await getMonthView(client, ownerId, currentMonthStart);
  if (!month) return { state: "onboarding_required", month: null };
  if (user.resumeRequiredAt !== null) return { state: "resume_required", month };
  if (month.lifecycle === "open") return { state: "ready", month };
  return { state: "closed_until_boundary", month };
}
