// Zod schemas for every request body and query. Shared by the API and the
// client forms so both validate the same way.

import { z } from "zod";

export const idSchema = z.coerce.number().int().positive();

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24 hour time, like 07:30.");
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-05.");
const overrideReason = z
  .string()
  .trim()
  .min(3, "Give a short reason for the override.")
  .max(500)
  .nullish();

export const roleSchema = z.enum(["manager", "worker"]);

export const sessionBodySchema = z.object({
  role: roleSchema,
  // Which worker to act as. Defaults to the demo worker.
  staffId: idSchema.optional(),
});

export const idParamsSchema = z.object({ id: idSchema });

export const boardQuerySchema = z.object({
  date: calendarDate.optional(),
});

export const staffQuerySchema = z.object({
  eventId: idSchema,
  q: z.string().trim().max(80).optional(),
  role: idSchema.optional(),
});

export const activityQuerySchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  shiftId: idSchema.optional(),
});

export const createAssignmentSchema = z.object({
  shiftId: idSchema,
  staffId: idSchema,
  // Required by the server only when the assignment has warnings.
  overrideReason,
});

export const updateShiftSchema = z
  .object({
    version: z.number().int().positive(),
    roleId: idSchema.optional(),
    // Event-local times on the shift's own day. An end at or before the start
    // means the shift ends the next day.
    startTime: time.optional(),
    endTime: time.optional(),
    slots: z.number().int().min(1).max(50).optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => (v.startTime === undefined) === (v.endTime === undefined), {
    message: "Send startTime and endTime together.",
    path: ["endTime"],
  })
  .refine((v) => v.startTime === undefined || v.startTime !== v.endTime, {
    message: "A shift can't start and end at the same time.",
    path: ["endTime"],
  });

export const createShiftRequestSchema = z.object({
  shiftId: idSchema,
});

export const approveShiftRequestSchema = z.object({
  overrideReason,
});

export type SessionBody = z.infer<typeof sessionBodySchema>;
export type StaffQuery = z.infer<typeof staffQuerySchema>;
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export type CreateAssignmentBody = z.infer<typeof createAssignmentSchema>;
export type UpdateShiftBody = z.infer<typeof updateShiftSchema>;
export type CreateShiftRequestBody = z.infer<typeof createShiftRequestSchema>;
export type ApproveShiftRequestBody = z.infer<typeof approveShiftRequestSchema>;
