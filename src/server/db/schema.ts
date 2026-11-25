import {
  bigint,
  boolean,
  date,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// All datetime columns hold UTC. Drizzle's "date" mode writes Date.toISOString()
// without the Z and reads it back as UTC, so the server timezone never leaks in.
// Plain `date` columns (event days, licence expiry) are calendar dates kept as
// "YYYY-MM-DD" strings, read in the event's timezone.

const createdAt = () =>
  datetime("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date());

export const event = mysqlTable("event", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  venue: varchar("venue", { length: 120 }).notNull(),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  endsOn: date("ends_on", { mode: "string" }).notNull(),
  timezone: varchar("timezone", { length: 64 }).notNull(),
});

export const location = mysqlTable(
  "location",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: int("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("location_event_idx").on(t.eventId, t.sortOrder)],
);

export const role = mysqlTable("role", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 60 }).notNull().unique(),
  requiresSia: boolean("requires_sia").notNull().default(false),
});

export const staff = mysqlTable(
  "staff",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    roleId: int("role_id")
      .notNull()
      .references(() => role.id),
    email: varchar("email", { length: 160 }).notNull().unique(),
    weeklyHourLimit: int("weekly_hour_limit").notNull().default(48),
  },
  (t) => [index("staff_role_idx").on(t.roleId), index("staff_name_idx").on(t.name)],
);

export const licence = mysqlTable(
  "licence",
  {
    id: int("id").autoincrement().primaryKey(),
    staffId: int("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).notNull(),
    number: varchar("number", { length: 40 }).notNull(),
    expiresOn: date("expires_on", { mode: "string" }).notNull(),
  },
  (t) => [index("licence_staff_idx").on(t.staffId)],
);

export const shift = mysqlTable(
  "shift",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: int("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    locationId: int("location_id")
      .notNull()
      .references(() => location.id),
    roleId: int("role_id")
      .notNull()
      .references(() => role.id),
    startsAt: datetime("starts_at", { mode: "date" }).notNull(),
    endsAt: datetime("ends_at", { mode: "date" }).notNull(),
    slots: int("slots").notNull(),
    notes: text("notes"),
    // Bumped on every edit. PATCH sends the version it read and gets 409 if it is stale.
    version: int("version").notNull().default(1),
  },
  (t) => [index("shift_event_starts_idx").on(t.eventId, t.startsAt)],
);

export const assignment = mysqlTable(
  "assignment",
  {
    id: int("id").autoincrement().primaryKey(),
    shiftId: int("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    staffId: int("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    overrideReason: varchar("override_reason", { length: 500 }),
    createdBy: varchar("created_by", { length: 64 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("assignment_shift_staff_uq").on(t.shiftId, t.staffId),
    // Overlap, rest and weekly-hours checks all start from "this person's assignments".
    index("assignment_staff_idx").on(t.staffId),
  ],
);

export const shiftRequestStatus = ["pending", "approved", "declined"] as const;

export const shiftRequest = mysqlTable(
  "shift_request",
  {
    id: int("id").autoincrement().primaryKey(),
    shiftId: int("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "cascade" }),
    staffId: int("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", shiftRequestStatus).notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("shift_request_shift_staff_uq").on(t.shiftId, t.staffId),
    index("shift_request_staff_idx").on(t.staffId),
  ],
);

export const auditLog = mysqlTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    eventId: int("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    // Not a foreign key on purpose: the history of a deleted shift should survive.
    shiftId: int("shift_id"),
    actor: varchar("actor", { length: 64 }).notNull(),
    action: varchar("action", { length: 60 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // Activity is read newest first by id, per event and optionally per shift.
    index("audit_event_id_idx").on(t.eventId, t.id),
    index("audit_shift_id_idx").on(t.shiftId, t.id),
  ],
);

export type EventRow = typeof event.$inferSelect;
export type LocationRow = typeof location.$inferSelect;
export type RoleRow = typeof role.$inferSelect;
export type StaffRow = typeof staff.$inferSelect;
export type LicenceRow = typeof licence.$inferSelect;
export type ShiftRow = typeof shift.$inferSelect;
export type AssignmentRow = typeof assignment.$inferSelect;
export type ShiftRequestRow = typeof shiftRequest.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;
