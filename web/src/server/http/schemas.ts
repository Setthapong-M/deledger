import { z } from "zod";

const decimal = z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/, "ยอดเงินต้องเป็นทศนิยมไม่ติดลบ");
const revision = z.string().regex(/^\d+$/, "revision ไม่ถูกต้อง");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ต้องเป็น YYYY-MM-DD");
const monthKey = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "เดือนต้องเป็น YYYY-MM");
const uuid = z.string().uuid();

export const lifecycleSchema = z.object({ openingBalance: decimal, income: decimal }).strict();
export const incomeSchema = z.object({ amount: decimal, expectedRevision: revision }).strict();
export const endingBalanceSchema = z.object({ amount: decimal, expectedRevision: revision }).strict();
export const snapshotSchema = z.object({ observedOn: isoDate, amount: decimal, expectedRevision: revision }).strict();
export const addRecurringSchema = z.object({ name: z.string().trim().min(1).max(200), kind: z.enum(["fixed", "variable"]), fixedAmount: decimal.nullish(), expectedRevision: revision }).strict();
export const updateRecurringSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), kind: z.enum(["fixed", "variable"]).optional(), fixedAmount: decimal.nullish(), isPaused: z.boolean().optional(), expectedRevision: revision }).strict().refine((value) => value.name !== undefined || value.kind !== undefined || value.fixedAmount !== undefined || value.isPaused !== undefined, "ต้องส่งข้อมูลที่ต้องการแก้ไข");
export const reorderSchema = z.object({ orderedIds: z.array(uuid).min(0), expectedRevision: revision }).strict();
export const detailSchema = z.object({ amount: decimal.optional(), expectedRevision: revision }).strict();
export const closeSchema = z.object({ expectedRevision: revision }).strict();
export const localLoginSchema = z.object({ identifier: z.string().trim().min(1).max(320) }).strict();
export const monthQuerySchema = z.object({ before: monthKey.optional(), limit: z.coerce.number().int().min(1).max(24).default(24) }).strict();

export function monthStart(key: string): string {
  return monthKey.parse(key) + "-01";
}

export { decimal, revision, isoDate, monthKey, uuid };
