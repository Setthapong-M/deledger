import { z } from "zod";

export const profileSchema = z.object({
  email: z.string().trim().max(320).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
}).strict().refine((value) => value.email !== undefined || value.phone !== undefined || value.dateOfBirth !== undefined, "ต้องส่งข้อมูลที่ต้องการแก้ไข");
