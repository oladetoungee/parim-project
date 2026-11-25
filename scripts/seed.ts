// Seeds one race day: 6 locations, 42 shifts, 120 staff. Deterministic (seeded
// PRNG) and idempotent (truncates every table first).
//
// Usage: tsx --env-file=.env.local scripts/seed.ts [--test]
// --test seeds TEST_DATABASE_URL instead of DATABASE_URL.

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { pathToFileURL } from "node:url";
import { connectWithRetry } from "./migrate";
import { checkAssignment, type BookedShift, SIA_KIND } from "../src/lib/rules";
import { resolveShiftTimes } from "../src/lib/time";
import * as schema from "../src/server/db/schema";
import { DEMO_WORKER_EMAIL } from "../src/server/session";

export const SEED = {
  eventId: 1,
  date: "2026-12-05",
  timezone: "Europe/London",
  demoWorkerEmail: DEMO_WORKER_EMAIL,
} as const;

const TZ = SEED.timezone;

// ---------------------------------------------------------------- PRNG

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------------------------------------------------------------- reference data

const ROLES = [
  { id: 1, key: "steward", name: "steward", requiresSia: false, headcount: 40 },
  { id: 2, key: "bar", name: "bar staff", requiresSia: false, headcount: 36 },
  { id: 3, key: "security", name: "security", requiresSia: true, headcount: 21 },
  { id: 4, key: "carpark", name: "car park attendant", requiresSia: false, headcount: 14 },
  { id: 5, key: "supervisor", name: "supervisor", requiresSia: false, headcount: 9 },
] as const;

type RoleKey = (typeof ROLES)[number]["key"];
const roleId = (key: RoleKey) => ROLES.find((r) => r.key === key)!.id;

const LOCATIONS = ["Gate A", "Gate B", "Bar 1", "Bar 2", "Security", "Car park"] as const;
type LocationName = (typeof LOCATIONS)[number];

const PEAK_NOTE = "Peak cover for the feature race.";

// [start, end, role, slots, filled]. Filled below slots only on the four
// 14:00 to 16:00 peak shifts, which makes the gap on the coverage strip.
type ShiftSpec = [start: string, end: string, role: RoleKey, slots: number, filled?: number];

const RACE_DAY_SHIFTS: Record<LocationName, ShiftSpec[]> = {
  "Gate A": [
    ["07:00", "13:00", "steward", 4],
    ["09:00", "15:00", "steward", 3],
    ["12:00", "18:00", "steward", 4],
    ["15:00", "21:00", "steward", 3],
    ["18:00", "23:00", "steward", 2],
    ["10:00", "18:00", "supervisor", 1],
    ["14:00", "16:00", "steward", 3, 1],
  ],
  "Gate B": [
    ["07:00", "13:00", "steward", 3],
    ["08:00", "12:00", "steward", 2],
    ["10:00", "16:00", "steward", 3],
    ["13:00", "19:00", "steward", 3],
    ["16:00", "22:00", "steward", 3],
    ["19:00", "23:00", "steward", 2],
    ["12:00", "20:00", "supervisor", 1],
  ],
  "Bar 1": [
    ["09:00", "15:00", "bar", 3],
    ["11:00", "17:00", "bar", 4],
    ["13:00", "19:00", "bar", 3],
    ["16:00", "22:00", "bar", 4],
    ["18:00", "23:00", "bar", 3],
    ["11:00", "19:00", "supervisor", 1],
    ["14:00", "16:00", "bar", 2, 0],
  ],
  "Bar 2": [
    ["09:00", "13:00", "bar", 2],
    ["10:00", "16:00", "bar", 3],
    ["12:00", "18:00", "bar", 3],
    ["17:00", "23:00", "bar", 3],
    ["19:00", "23:00", "bar", 2],
    ["15:00", "23:00", "supervisor", 1],
    ["14:00", "16:00", "bar", 3, 1],
  ],
  Security: [
    ["07:00", "13:00", "security", 3],
    ["07:00", "15:00", "supervisor", 1],
    ["09:00", "17:00", "security", 3],
    ["11:00", "19:00", "security", 2],
    ["12:00", "20:00", "security", 3],
    ["15:00", "23:00", "security", 3],
    ["17:00", "23:00", "security", 2],
    ["14:00", "16:00", "security", 2, 1],
  ],
  "Car park": [
    ["07:00", "12:00", "carpark", 3],
    ["09:00", "14:00", "carpark", 2],
    ["10:00", "16:00", "carpark", 2],
    ["12:00", "18:00", "carpark", 2],
    ["16:00", "21:00", "carpark", 2],
    ["19:00", "23:00", "carpark", 2],
  ],
};

const ESTONIAN_FIRST = ["Kadri", "Mari", "Liis", "Triin", "Kertu", "Maarja", "Kristjan", "Mart", "Toomas", "Siim", "Rasmus", "Karl", "Jaan", "Priit", "Helen", "Marten", "Getter", "Annely"];
const ESTONIAN_LAST = ["Tamm", "Saar", "Sepp", "Mägi", "Kask", "Kukk", "Rebane", "Ilves", "Pärn", "Koppel", "Lepik", "Kuusk", "Oja", "Raudsepp", "Laur", "Vaher"];
const BRITISH_FIRST = ["Oliver", "Amelia", "Harry", "Isla", "Jack", "Sophie", "George", "Grace", "Charlie", "Ella", "Thomas", "Freya", "James", "Megan", "Callum", "Rhiannon", "Fraser", "Niamh"];
const BRITISH_LAST = ["Hughes", "Clarke", "Walsh", "Turner", "Bennett", "Patel", "Murray", "Evans", "Reid", "Foster", "Holland", "Price", "Doyle", "Barker", "Lloyd", "Campbell"];
const OTHER_NAMES = [
  "Priya Shah", "Tomasz Nowak", "Chidi Okafor", "Lucía Romero", "Mateus Silva", "Aylin Demir", "Yusuf Haddad",
  "Ingrid Lund", "Aleksandra Wójcik", "Kwame Mensah", "Sofia Rossi", "Dmitri Volkov", "Hana Kobayashi",
  "Nadia Benali", "Lars Eriksen", "Femi Adeyemi", "Elif Kaya", "Marco Bianchi", "Zofia Kowalska",
  "Ravi Menon", "Leila Farah", "Andrei Popescu", "Mei Lin", "Oskar Berg", "Amara Diallo",
];

function emailFor(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".");
  return `${slug}@example.com`;
}

function buildNames(random: () => number): string[] {
  const names = new Set<string>(["Ana Tamm"]);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)];
  for (const name of OTHER_NAMES) names.add(name);
  // Alternate Estonian and British names until we have 120.
  while (names.size < 120) {
    const estonian = names.size % 2 === 0;
    names.add(estonian ? `${pick(ESTONIAN_FIRST)} ${pick(ESTONIAN_LAST)}` : `${pick(BRITISH_FIRST)} ${pick(BRITISH_LAST)}`);
  }
  return [...names];
}

// ---------------------------------------------------------------- build rows

type StaffSeed = { id: number; name: string; roleKey: RoleKey; email: string };
type ShiftSeed = { id: number; eventId: number; locationId: number; roleKey: RoleKey; startsAt: Date; endsAt: Date; slots: number; filled: number; notes: string | null };

function buildStaff(random: () => number): StaffSeed[] {
  const [first, ...rest] = buildNames(random);
  const shuffled = [first, ...shuffle(rest, random)]; // Ana Tamm stays first, as a steward
  const roleKeys = ROLES.flatMap((r) => Array<RoleKey>(r.headcount).fill(r.key));
  return shuffled.map((name, i) => ({ id: i + 1, name, roleKey: roleKeys[i], email: emailFor(name) }));
}

function buildRaceDayShifts(): ShiftSeed[] {
  const shifts: ShiftSeed[] = [];
  LOCATIONS.forEach((locationName, index) => {
    for (const [start, end, roleKey, slots, filled = slots] of RACE_DAY_SHIFTS[locationName]) {
      shifts.push({
        id: shifts.length + 1,
        eventId: SEED.eventId,
        locationId: index + 1,
        roleKey,
        ...resolveShiftTimes(SEED.date, start, end, TZ),
        slots,
        filled,
        notes: filled < slots ? PEAK_NOTE : null,
      });
    }
  });
  return shifts;
}

/**
 * The week before race day, at a second event. These shifts exist so the rules
 * have something to say: late finishes the night before (rest under 11 hours)
 * and long weeks (close to 48 hours).
 */
function buildEarlierWeek(staffRows: StaffSeed[], firstShiftId: number) {
  const byRole = (key: RoleKey) => staffRows.filter((s) => s.roleKey === key && s.name !== "Ana Tamm");
  const stewards = byRole("steward");
  const bar = byRole("bar");
  const carpark = byRole("carpark");

  const lateFinish = [stewards[0], stewards[1], bar[0]]; // Fri 17:00 to 23:30
  const overnight = [stewards[2], bar[1]]; // Fri 21:00 to 04:00 Sat, 10 hours before a 14:00 start
  const longWeek = [stewards[3], bar[2], carpark[0]]; // Mon to Thu 07:00 to 18:45, 47 hours

  const shifts: ShiftSeed[] = [];
  const assignments: { shiftId: number; staffId: number }[] = [];
  const add = (date: string, start: string, end: string, roleKey: RoleKey, people: StaffSeed[]) => {
    const id = firstShiftId + shifts.length;
    shifts.push({
      id,
      eventId: 2,
      locationId: 7,
      roleKey,
      ...resolveShiftTimes(date, start, end, TZ),
      slots: people.length,
      filled: people.length,
      notes: null,
    });
    for (const person of people) assignments.push({ shiftId: id, staffId: person.id });
  };

  add("2026-12-04", "17:00", "23:30", "steward", lateFinish.slice(0, 2));
  add("2026-12-04", "17:00", "23:30", "bar", lateFinish.slice(2));
  add("2026-12-04", "21:00", "04:00", "steward", overnight.slice(0, 1));
  add("2026-12-04", "21:00", "04:00", "bar", overnight.slice(1));
  for (const date of ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03"]) {
    for (const person of longWeek) add(date, "07:00", "18:45", person.roleKey, [person]);
  }

  const busyIds = new Set([...lateFinish, ...overnight, ...longWeek].map((p) => p.id));
  return { shifts, assignments, busyIds };
}

function buildLicences(staffRows: StaffSeed[]) {
  const guards = staffRows.filter((s) => s.roleKey === "security");
  // Fixed expiry dates, relative to race day on 5 Dec 2026.
  const special: Record<number, string> = {
    0: "2026-11-20", // expired
    1: "2026-12-01", // expired
    2: "2026-12-05", // expires on race day
    3: "2026-12-09",
    4: "2026-12-16",
  };
  const expiredIds = new Set([guards[0].id, guards[1].id]);
  const rows = guards.map((guard, i) => ({
    id: i + 1,
    staffId: guard.id,
    kind: SIA_KIND,
    number: `SIA-${String(1_0134_4000 + guard.id * 7919).padStart(16, "0")}`,
    expiresOn: special[i] ?? `${2027 + (i % 3)}-${String((i % 12) + 1).padStart(2, "0")}-28`,
  }));
  return { rows, expiredIds };
}

/** Fills each race-day shift from its role's pool, one shift per person. */
function fillRaceDay(shifts: ShiftSeed[], staffRows: StaffSeed[], unavailable: Set<number>, random: () => number) {
  const pools = new Map<RoleKey, StaffSeed[]>();
  for (const role of ROLES) {
    const people = staffRows.filter((s) => s.roleKey === role.key && !unavailable.has(s.id) && s.name !== "Ana Tamm");
    pools.set(role.key, shuffle(people, random));
  }
  const ana = staffRows.find((s) => s.name === "Ana Tamm")!;
  pools.get("steward")!.unshift(ana); // the demo worker gets the first Gate A shift

  return shifts.flatMap((s) =>
    Array.from({ length: s.filled }, () => {
      const person = pools.get(s.roleKey)!.shift();
      if (!person) throw new Error(`Not enough ${s.roleKey} staff to fill shift ${s.id}`);
      return { shiftId: s.id, staffId: person.id };
    }),
  );
}

export function buildSeed() {
  const random = mulberry32(20261205);
  const staffRows = buildStaff(random);
  const raceDay = buildRaceDayShifts();
  const earlier = buildEarlierWeek(staffRows, raceDay.length + 1);
  const licences = buildLicences(staffRows);
  const unavailable = new Set([...earlier.busyIds, ...licences.expiredIds]);
  const raceDayAssignments = fillRaceDay(raceDay, staffRows, unavailable, random);

  return {
    staffRows,
    shifts: [...raceDay, ...earlier.shifts],
    licences: licences.rows,
    assignments: [...raceDayAssignments, ...earlier.assignments],
  };
}

type Seed = ReturnType<typeof buildSeed>;

/** Runs every seeded assignment through the rules, so the seed can't contradict them. */
function assertSeedFollowsRules(seed: Seed) {
  const shiftById = new Map(seed.shifts.map((s) => [s.id, s]));
  const locationName = (s: ShiftSeed) => (s.locationId <= LOCATIONS.length ? LOCATIONS[s.locationId - 1] : "Main stand");
  const bookedFor = (staffId: number): BookedShift[] =>
    seed.assignments
      .filter((a) => a.staffId === staffId)
      .map((a) => shiftById.get(a.shiftId)!)
      .map((s) => ({ shiftId: s.id, startsAt: s.startsAt, endsAt: s.endsAt, locationName: locationName(s) }));

  for (const a of seed.assignments) {
    const s = shiftById.get(a.shiftId)!;
    const person = seed.staffRows.find((p) => p.id === a.staffId)!;
    const role = ROLES.find((r) => r.key === s.roleKey)!;
    const breaks = checkAssignment({
      shift: { id: s.id, startsAt: s.startsAt, endsAt: s.endsAt, locationName: locationName(s), roleId: role.id, roleName: role.name, requiresSia: role.requiresSia, slots: s.slots, filled: 0 },
      staff: {
        id: person.id,
        name: person.name,
        roleId: roleId(person.roleKey),
        roleName: ROLES.find((r) => r.key === person.roleKey)!.name,
        weeklyHourLimit: 48,
        licences: seed.licences.filter((l) => l.staffId === person.id),
      },
      booked: bookedFor(person.id),
      timezone: TZ,
    });
    const problems = breaks.filter((b) => b.severity !== "info");
    if (problems.length > 0) {
      throw new Error(`Seed breaks a rule: ${problems.map((b) => b.message).join(" ")}`);
    }
  }
}

// ---------------------------------------------------------------- write

const TABLES = ["audit_log", "shift_request", "assignment", "shift", "licence", "staff", "role", "location", "event"];

export async function seedDatabase(url: string) {
  const seed = buildSeed();
  assertSeedFollowsRules(seed);

  const connection = await connectWithRetry(url);
  const db = drizzle({ client: connection, schema, mode: "default" });
  try {
    // TRUNCATE needs foreign key checks off, and the setting is per connection,
    // which is why this uses one connection rather than a pool.
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of TABLES) await db.execute(sql.raw(`TRUNCATE TABLE \`${table}\``));
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);

    await db.insert(schema.event).values([
      { id: 1, name: "Autumn race day", venue: "Riverbank Racecourse", startsOn: SEED.date, endsOn: SEED.date, timezone: TZ },
      { id: 2, name: "Midweek fixtures", venue: "Riverbank Racecourse", startsOn: "2026-11-30", endsOn: "2026-12-04", timezone: TZ },
    ]);
    await db.insert(schema.location).values([
      ...LOCATIONS.map((name, i) => ({ id: i + 1, eventId: 1, name, sortOrder: i })),
      { id: LOCATIONS.length + 1, eventId: 2, name: "Main stand", sortOrder: 0 },
    ]);
    await db.insert(schema.role).values(ROLES.map(({ id, name, requiresSia }) => ({ id, name, requiresSia })));
    await db.insert(schema.staff).values(
      seed.staffRows.map((s) => ({ id: s.id, name: s.name, roleId: roleId(s.roleKey), email: s.email, weeklyHourLimit: 48 })),
    );
    await db.insert(schema.licence).values(seed.licences);
    await db.insert(schema.shift).values(
      seed.shifts.map((s) => ({
        id: s.id,
        eventId: s.eventId,
        locationId: s.locationId,
        roleId: roleId(s.roleKey),
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        slots: s.slots,
        notes: s.notes,
      })),
    );

    const createdAt = (i: number) => new Date(Date.UTC(2026, 10, 20, 9, 0) + i * 60_000);
    await db.insert(schema.assignment).values(
      seed.assignments.map((a, i) => ({ id: i + 1, ...a, createdBy: "manager", createdAt: createdAt(i) })),
    );
    await db.insert(schema.auditLog).values(
      seed.assignments.map((a, i) => {
        const s = seed.shifts.find((x) => x.id === a.shiftId)!;
        return {
          eventId: s.eventId,
          shiftId: a.shiftId,
          actor: "manager",
          action: "assignment.created",
          payload: { assignmentId: i + 1, shiftId: a.shiftId, staffId: a.staffId, staffName: seed.staffRows[a.staffId - 1].name },
          createdAt: createdAt(i),
        };
      }),
    );
  } finally {
    await connection.end();
  }

  const raceDay = seed.shifts.filter((s) => s.eventId === SEED.eventId);
  return {
    staff: seed.staffRows.length,
    shifts: raceDay.length,
    covered: raceDay.filter((s) => s.filled >= s.slots).length,
    assignments: seed.assignments.length,
  };
}

async function main() {
  const useTest = process.argv.includes("--test");
  const name = useTest ? "TEST_DATABASE_URL" : "DATABASE_URL";
  const url = process.env[name];
  if (!url) throw new Error(`${name} is not set`);
  const result = await seedDatabase(url);
  console.log(
    `Seeded ${name}: ${result.staff} staff, ${result.shifts} race-day shifts (${result.covered} covered), ${result.assignments} assignments.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
