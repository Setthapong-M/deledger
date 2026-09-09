import type { Prisma } from "../../generated/prisma/client.js";
import type { LifecycleState, MonthView } from "../domain/contracts.js";
import { getCurrentMonthStart, getMonthView } from "../repositories/months.js";
import { getCurrentUser } from "../repositories/users.js";
import { businessDate, currentBusinessDate, dateText } from "../domain/calendar.js";

export type BootstrapState = {
  state: LifecycleState;
  month: MonthView | null;
  businessDate: string;
};

export async function readBootstrap(client: Prisma.TransactionClient, ownerId: string): Promise<BootstrapState> {
  const user = await getCurrentUser(client, ownerId);
  const today = currentBusinessDate();
  const result = (state: LifecycleState, month: MonthView | null): BootstrapState => ({ state, month, businessDate: today });
  const earliest = await client.reporting_month.findFirst({ where: { owner_id: ownerId }, orderBy: { month_start: "asc" } });
  if (!earliest) return result("onboarding_required", null);
  const currentMonthStart = await getCurrentMonthStart(client, ownerId);
  const month = currentMonthStart ? await getMonthView(client, ownerId, currentMonthStart) : null;
  const archives = await client.user_archive_period.findMany({ where: { owner_id: ownerId } });
  const outside = today < dateText(earliest.tracked_from)
    || (month !== null && today < month.trackedFrom)
    || archives.some(period => today >= businessDate(period.archived_at) && (period.restored_at === null || today < businessDate(period.restored_at)))
    || (user.resumeRequiredAt !== null && today < businessDate(new Date(user.resumeRequiredAt)));
  if (outside) return result("simulation_outside_tracking", null);
  if (user.resumeRequiredAt !== null) return result("resume_required", month);
  if (!month) return result("simulation_outside_tracking", null);
  if (month.lifecycle === "open") return result("ready", month);
  return result("closed_until_boundary", month);
}
