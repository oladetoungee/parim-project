"use client";

import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CoverageStrip, type HourCoverage } from "@/components/ui/CoverageStrip";
import { ShiftCard, type ShiftStatus } from "@/components/ui/ShiftCard";
import { cn } from "@/lib/cn";

/*
 * The screens inside the story's browser frame. Each is drawn at 1200 by 720
 * with the real UI kit (shift cards, coverage strip, badges, buttons), so the
 * motion you see is the product's own: a face springing onto a card, the
 * count rolling, the conflict shake. `step` is how far the reader has
 * scrolled through the chapter.
 */

const people = [
  "Kadri Tamm",
  "Mart Saar",
  "Liis Sepp",
  "Oliver Hughes",
  "Priya Shah",
  "Siim Mägi",
  "Amelia Clarke",
  "Rasmus Kask",
  "Isla Walsh",
  "Chidi Okafor",
  "Triin Kukk",
  "Jack Turner",
  "Helen Rebane",
  "Femi Adeyemi",
  "Karl Ilves",
  "Sophie Bennett",
  "Jaan Pärn",
  "Grace Murray",
  "Toomas Lepik",
  "Ella Reid",
].map((name, i) => ({ id: `p${i}`, name }));

function crew(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => people[(from + i) % people.length]);
}

function statusOf(filled: number, needed: number): ShiftStatus {
  if (filled >= needed) return "filled";
  return filled === 0 ? "open" : "partly-filled";
}

/* ---------- The product's frame: the sidebar and the page around a scene. ---------- */

const nav = ["Schedule", "People", "Requests"] as const;

export function AppChrome({
  page = "Schedule",
  requests = 1,
  bare = false,
  children,
}: {
  page?: (typeof nav)[number];
  requests?: number;
  /** No sidebar: the chapters zoom in on one part of the page so it reads at full size. */
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full bg-canvas text-ink">
      <aside hidden={bare} className="flex w-[208px] shrink-0 flex-col border-r border-hairline px-4 py-5">
        <span className="px-2 font-display text-20 leading-7 tracking-[-0.02em]">
          <span className="font-bold">Parim</span>
          <span className="font-light">Shift</span>
        </span>
        <ul className="mt-8 flex flex-col gap-1">
          {nav.map((item) => (
            <li
              key={item}
              className={cn(
                "flex h-9 items-center justify-between rounded-4 px-2 text-14",
                item === page ? "bg-hover font-semibold text-ink" : "font-medium text-muted",
              )}
            >
              {item}
              {item === "Requests" && requests > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-short-tint px-1.5 text-12 font-semibold tabular">
                  {requests}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-hairline px-2 pt-4">
          <p className="text-14 font-semibold">Autumn race day</p>
          <p className="text-12 text-muted">Sat 5 Dec, Riverbank</p>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col px-8 pt-6">{children}</main>
    </div>
  );
}

function Toolbar({ covered = 38 }: { covered?: number }) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <h3 className="font-display text-24 leading-8 tracking-[-0.02em]">
          <span className="font-bold">Autumn</span> <span className="font-light">race day</span>
        </h3>
        <p className="text-12 text-muted">Saturday 5 December, Riverbank Racecourse</p>
      </div>
      <p className="text-14 text-muted">
        <span className="font-display text-24 leading-8 font-bold tracking-[-0.02em] text-ink tabular">{covered} of 42</span>{" "}
        shifts covered
      </p>
    </div>
  );
}

/* ---------- The board, as the hero shows it. ---------- */

const FIRST_HOUR = 7;
const HOURS = 12;
const GUTTER = 88;
const HOUR_W = 70;

type Spec = [start: number, end: number, role: string, filled: number, needed: number];

const rows: { location: string; shifts: Spec[] }[] = [
  {
    location: "Gate A",
    shifts: [
      [7, 13, "Steward", 4, 4],
      [14, 16, "Steward", 1, 3],
      [16, 19, "Steward", 3, 3],
    ],
  },
  {
    location: "Gate B",
    shifts: [
      [7, 13, "Steward", 3, 3],
      [13, 19, "Steward", 3, 3],
    ],
  },
  {
    location: "Bar 1",
    shifts: [
      [8, 14, "Bar staff", 3, 3],
      [14, 16, "Bar staff", 0, 2],
      [16, 19, "Bar staff", 4, 4],
    ],
  },
  {
    location: "Bar 2",
    shifts: [
      [9, 13, "Bar staff", 2, 2],
      [14, 16, "Bar staff", 1, 3],
      [16, 19, "Bar staff", 3, 3],
    ],
  },
  {
    location: "Security",
    shifts: [
      [7, 13, "Security", 3, 3],
      [14, 16, "Security", 1, 2],
      [16, 19, "Security", 3, 3],
    ],
  },
];

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Hours 07:00 to 18:00, with the gap at the feature race. */
const dayHours: HourCoverage[] = [
  [7, 22, 22],
  [8, 28, 28],
  [9, 36, 36],
  [10, 42, 42],
  [11, 48, 48],
  [12, 52, 52],
  [13, 52, 52],
  [14, 55, 48],
  [15, 55, 48],
  [16, 50, 50],
  [17, 46, 46],
  [18, 40, 40],
].map(([hour, needed, assigned]) => ({ hour, needed, assigned }));

const filledHours = dayHours.map((h) => ({ ...h, assigned: h.needed }));

export function BoardScene() {
  let n = 0;
  return (
    <AppChrome>
      <Toolbar />
      <div className="mt-5 flex">
        <span className="shrink-0 pt-6 text-12 text-muted" style={{ width: GUTTER }}>
          By hour
        </span>
        <div style={{ width: HOURS * HOUR_W - 4 }}>
          <StripOnly hours={dayHours} barHeight={28} />
        </div>
      </div>
      <div className="mt-2 border-b border-hairline" />
      {rows.map((row, r) => (
        <div key={row.location} className="relative flex h-[92px] items-center border-b border-hairline">
          <span className="shrink-0 text-14 font-semibold" style={{ width: GUTTER }}>
            {row.location}
          </span>
          {row.shifts.map(([start, end, role, filled, needed]) => {
            const delay = 900 + (n++ % 14) * 60;
            return (
              <div
                key={start}
                className="story-pop absolute"
                style={
                  {
                    left: GUTTER + (start - FIRST_HOUR) * HOUR_W,
                    width: (end - start) * HOUR_W - 4,
                    animationDelay: `${delay}ms`,
                  } as CSSProperties
                }
              >
                <ShiftCard
                  className="w-full"
                  role={role}
                  start={hh(start)}
                  end={hh(end)}
                  filled={filled}
                  needed={needed}
                  status={statusOf(filled, needed)}
                  people={crew(r * 3 + start, filled)}
                  tabIndex={-1}
                />
              </div>
            );
          })}
        </div>
      ))}
    </AppChrome>
  );
}

/** The strip without its legend, for small placements. */
function StripOnly({ hours, barHeight, activeHour }: { hours: HourCoverage[]; barHeight: number; activeHour?: number | null }) {
  return <CoverageStrip hours={hours} barHeight={barHeight} activeHour={activeHour ?? null} className="[&>ul]:hidden" />;
}

/* ---------- Chapter: every gap, by the hour. ---------- */

const peak: Spec[] = [
  [14, 16, "Steward", 1, 3],
  [14, 16, "Bar staff", 0, 2],
  [14, 16, "Bar staff", 1, 3],
  [14, 16, "Security", 1, 2],
];
const peakPlaces = ["Gate A", "Bar 1", "Bar 2", "Security"];

export function GapsScene({ step }: { step: number }) {
  const fixed = step >= 2;
  return (
    <AppChrome bare>
      <Toolbar covered={fixed ? 42 : 38} />
      <div className="mt-16">
        <CoverageStrip hours={fixed ? filledHours : dayHours} barHeight={210} activeHour={step === 1 ? 14 : null} />
      </div>
      <div
        className={cn(
          "mt-6 grid grid-cols-4 gap-3 transition-[opacity,translate] duration-slow ease-standard",
          step >= 1 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        {peak.map(([start, end, role, filled, needed], i) => {
          const f = fixed ? needed : filled;
          return (
            <ShiftCard
              key={peakPlaces[i]}
              className="w-full"
              role={role}
              location={peakPlaces[i]}
              start={hh(start)}
              end={hh(end)}
              filled={f}
              needed={needed}
              status={statusOf(f, needed)}
              people={crew(i * 4, f)}
              selected={step === 1}
              tabIndex={-1}
            />
          );
        })}
      </div>
    </AppChrome>
  );
}

/* ---------- Chapter: drag a person in. ---------- */

const bench = [
  { name: "Mart Saar", role: "Steward", hours: 18 },
  { name: "Priya Shah", role: "Steward", hours: 24 },
  { name: "Oliver Hughes", role: "Steward", hours: 12 },
  { name: "Isla Walsh", role: "Steward", hours: 30 },
  { name: "Rasmus Kask", role: "Steward", hours: 8 },
];

function StaffPanel({ lifted, dimmed }: { lifted?: string; dimmed?: string }) {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-l border-hairline pl-6">
      <p className="text-16 font-semibold">Staff</p>
      <p className="text-12 text-muted">Drag a person onto a shift</p>
      <div className="mt-4 h-8 rounded-4 border border-strong px-3 text-14 leading-8 text-subtle">Search by name</div>
      <ul className="mt-3 flex flex-col">
        {bench.map((p) => (
          <li
            key={p.name}
            className={cn(
              "flex h-14 items-center gap-3 border-b border-hairline px-1 transition-opacity duration-base",
              (p.name === lifted || p.name === dimmed) && "opacity-30",
            )}
          >
            <Avatar name={p.name} decorative />
            <span className="flex flex-1 flex-col">
              <span className="text-14 font-semibold">{p.name}</span>
              <span className="text-12 text-muted">{p.role}, SIA valid</span>
            </span>
            <span className="text-14 font-medium tabular">{p.hours} h</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** The person being dragged, as the pointer carries them. */
function Ghost({ name, style, className }: { name: string; style: CSSProperties; className?: string }) {
  return (
    <div
      className={cn(
        "absolute z-10 flex h-12 w-[210px] items-center gap-3 rounded-4 border border-hairline bg-raised px-3 shadow-lifted",
        "transition-[translate,opacity,rotate] duration-[700ms] ease-standard",
        className,
      )}
      style={style}
    >
      <Avatar name={name} decorative />
      <span className="text-14 font-semibold">{name}</span>
    </div>
  );
}

/** Hour width in the zoomed chapter scenes, 10:00 to 17:00. */
const HW = 68;

function ScheduleRows({ covered, children }: { covered?: number; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Toolbar covered={covered} />
      <div className="mt-8 flex border-b border-hairline pb-1 text-12 text-muted tabular" style={{ paddingLeft: 88 }}>
        {[10, 11, 12, 13, 14, 15, 16].map((h) => (
          <span key={h} style={{ width: HW }}>
            {hh(h)}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

export function DragScene({ step }: { step: number }) {
  const dropped = step >= 2;
  return (
    <AppChrome bare>
      <div className="relative flex flex-1 gap-8">
        <ScheduleRows covered={dropped ? 39 : 38}>
          {["Gate B", "Gate A", "Car park"].map((loc) => (
            <div key={loc} className="relative flex h-[150px] items-center border-b border-hairline">
              <span className="w-[88px] shrink-0 text-14 font-semibold">{loc}</span>
              {loc === "Gate A" ? (
                <div className="absolute" style={{ left: 88 + 4 * HW, width: 2 * HW - 4 }}>
                  <ShiftCard
                    className="w-full"
                    role="Steward"
                    start="14:00"
                    end="16:00"
                    filled={dropped ? 3 : 2}
                    needed={3}
                    status={dropped ? "filled" : "partly-filled"}
                    people={dropped ? [...crew(2, 2), { id: "mart", name: "Mart Saar" }] : crew(2, 2)}
                    drop={step === 1 ? "valid" : undefined}
                    tabIndex={-1}
                  />
                </div>
              ) : (
                <div
                  className="absolute"
                  style={{
                    left: 88 + (loc === "Gate B" ? 0 : 2 * HW),
                    width: 4 * HW - 4,
                  }}
                >
                  <ShiftCard
                    className="w-full"
                    role={loc === "Car park" ? "Car park attendant" : "Steward"}
                    start={loc === "Gate B" ? "10:00" : "12:00"}
                    end={loc === "Gate B" ? "14:00" : "16:00"}
                    filled={2}
                    needed={2}
                    status="filled"
                    people={crew(loc === "Gate B" ? 6 : 11, 2)}
                    tabIndex={-1}
                  />
                </div>
              )}
            </div>
          ))}
        </ScheduleRows>
        <StaffPanel lifted={step === 1 ? "Mart Saar" : undefined} dimmed={dropped ? "Mart Saar" : undefined} />
        <Ghost
          name="Mart Saar"
          className={cn(dropped && "opacity-0")}
          style={{
            left: 0,
            top: 0,
            translate: step === 0 ? "560px 140px" : "400px 300px",
            rotate: step === 1 ? "-3deg" : "0deg",
          }}
        />
      </div>
    </AppChrome>
  );
}

/* ---------- Chapter: the rules say no. ---------- */

export function RulesScene({ step }: { step: number }) {
  return (
    <div className="relative h-full">
      <AppChrome bare>
        <div className="relative flex flex-1 gap-8">
          <ScheduleRows>
            {["Security", "Bar 1"].map((loc) => (
              <div key={loc} className="relative flex h-[170px] items-center border-b border-hairline">
                <span className="w-[88px] shrink-0 text-14 font-semibold">{loc}</span>
                <div
                  className="absolute"
                  style={{
                    left: 88 + (loc === "Security" ? 2 : 0) * 80,
                    width: 4 * 80 - 4,
                  }}
                >
                  {loc === "Security" ? (
                    <ShiftCard
                      key={step}
                      className="w-full"
                      role="Security"
                      start="12:00"
                      end="16:00"
                      filled={1}
                      needed={2}
                      status="partly-filled"
                      people={crew(9, 1)}
                      drop={step === 0 ? "invalid" : undefined}
                      dropReason="Can't assign: Siim Mägi's SIA licence expired on 20 Nov."
                      shake={step === 1}
                      tabIndex={-1}
                    />
                  ) : (
                    <ShiftCard
                      className="w-full"
                      role="Bar staff"
                      start="10:00"
                      end="14:00"
                      filled={3}
                      needed={3}
                      status="filled"
                      people={crew(13, 3)}
                      tabIndex={-1}
                    />
                  )}
                </div>
              </div>
            ))}
          </ScheduleRows>
          <aside className="flex w-[260px] shrink-0 flex-col border-l border-hairline pl-6">
            <p className="text-16 font-semibold">Staff</p>
            <ul className="mt-4 flex flex-col">
              {["Siim Mägi", "Ella Reid", "Kwame Mensah"].map((name, i) => (
                <li key={name} className="flex h-14 items-center gap-3 border-b border-hairline px-1">
                  <Avatar name={name} decorative />
                  <span className="flex flex-1 flex-col">
                    <span className="text-14 font-semibold">{name}</span>
                    {i === 0 ? (
                      <span className="flex items-center gap-1 text-12 font-medium text-conflict">
                        <StatusDot status="conflict" className="size-1.5" /> SIA expired
                      </span>
                    ) : (
                      <span className="text-12 text-muted">Security, SIA valid</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
          <Ghost
            name="Siim Mägi"
            className={cn(step === 2 && "opacity-0")}
            style={{
              left: 0,
              top: 0,
              translate: step === 0 ? "300px 236px" : "596px 100px",
              rotate: step === 0 ? "-2deg" : "0deg",
            }}
          />
        </div>
      </AppChrome>
      {/* A rest warning can be overridden with a reason; a licence can't. */}
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-scrim transition-opacity duration-slow",
          step === 2 ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          className={cn(
            "w-[440px] rounded-8 border border-hairline bg-raised p-6 shadow-lifted transition-[translate] duration-slow ease-enter",
            step === 2 ? "translate-y-0" : "translate-y-4",
          )}
        >
          <p className="text-20 leading-7 font-semibold">Assign with a short rest?</p>
          <p className="mt-2 text-14 text-muted">
            Ella Reid finished at 02:00 and would start at 12:00, leaving 10 hours of rest. The minimum is 11.
          </p>
          <p className="mt-5 text-12 font-medium">Reason</p>
          <div className="mt-1 h-10 rounded-4 border border-strong px-3 text-14 leading-10">Security is one short from 12:00</div>
          <div className="mt-6 flex justify-end gap-2">
            <Button tabIndex={-1}>Cancel</Button>
            <Button tabIndex={-1} variant="primary">
              Assign anyway
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Chapter: workers ask, you approve. ---------- */

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[600px] w-[300px] shrink-0 flex-col overflow-hidden rounded-[40px] border-[8px] border-[var(--ink)] bg-canvas">
      <div className="flex h-8 items-center justify-between px-6 text-12 font-semibold">
        <span>09:41</span>
        <span className="h-4 w-16 rounded-full bg-ink" />
        <span>5G</span>
      </div>
      {children}
    </div>
  );
}

/** The worker's phone. Sits outside the browser, over its left edge. */
export function RequestsPhone({ step }: { step: number }) {
  const asked = step >= 1;
  const approved = step >= 2;
  return (
    <Phone>
      <div className="flex flex-1 flex-col gap-4 px-4 pt-3">
        <p className="font-display text-20 leading-7 tracking-[-0.02em]">
          <span className="font-bold">My</span> <span className="font-light">shifts</span>
        </p>
        <ShiftCard
          className="w-full"
          role="Steward"
          location="Gate B"
          start="07:00"
          end="13:00"
          filled={3}
          needed={3}
          status="filled"
          people={[{ id: "me" }, { id: "x1" }, { id: "x2" }]}
          tabIndex={-1}
        />
        <p className="mt-2 text-14 font-semibold">Open shifts you can take</p>
        <div className="flex flex-col gap-3 rounded-4 border border-hairline p-3">
          <div className="flex items-center justify-between">
            <span className="text-14 font-semibold">Bar staff, Bar 2</span>
            <Badge status="short" />
          </div>
          <span className="text-14 text-muted tabular">14:00 to 16:00, {approved ? 2 : 1} of 3 filled</span>
          <Button tabIndex={-1} variant={asked ? "secondary" : "primary"} size="sm" className="w-full">
            {approved ? "You're on this shift" : asked ? "Requested" : "Request shift"}
          </Button>
        </div>
      </div>
    </Phone>
  );
}

/** The manager's request list, in the browser. */
export function RequestsScene({ step }: { step: number }) {
  const asked = step >= 1;
  const approved = step >= 2;
  return (
    <AppChrome bare>
      <div className="flex flex-1 flex-col pl-28">
        <h3 className="font-display text-32 leading-9 font-bold tracking-[-0.02em]">Requests</h3>
        <p className="text-14 text-muted">Approve a request to put that person on the shift.</p>
        <ul className="mt-6 flex flex-col border-t border-hairline">
          <RequestRow
            name="Mari Kask"
            what="Bar staff at Bar 2, 14:00 to 16:00"
            state={approved ? "approved" : "waiting"}
            className={cn(
              "transition-[opacity,translate] duration-slow ease-enter",
              asked ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
            )}
          />
          <RequestRow name="Jack Turner" what="Steward at Gate A, 14:00 to 16:00" state="warn" />
        </ul>
        <div
          className={cn(
            "mt-auto mb-6 flex items-center gap-3 self-start rounded-8 bg-ink px-4 py-3 text-14 text-canvas shadow-lifted transition-[opacity,translate] duration-slow ease-enter",
            approved ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          Mari Kask is on Bar 2, 14:00 to 16:00.
          <span className="font-semibold underline underline-offset-4">Undo</span>
        </div>
      </div>
    </AppChrome>
  );
}

function RequestRow({
  name,
  what,
  state,
  className,
}: {
  name: string;
  what: string;
  state: "waiting" | "approved" | "warn";
  className?: string;
}) {
  return (
    <li className={cn("flex items-center gap-4 border-b border-hairline py-3", className)}>
      <Avatar name={name} decorative />
      <span className="flex flex-1 flex-col">
        <span className="text-14 font-semibold">{name}</span>
        <span className="text-14 text-muted tabular">{what}</span>
        {state === "warn" ? <span className="text-12">Needs a reason: 9 hours of rest after his last shift.</span> : null}
      </span>
      {state === "approved" ? (
        <Badge status="covered" />
      ) : (
        <Button tabIndex={-1} size="sm" variant="primary">
          Approve
        </Button>
      )}
    </li>
  );
}

/* ---------- Chapter: one system. Cards fan out as you scroll. ---------- */

const fan: {
  status: ShiftStatus;
  role: string;
  filled: number;
  needed: number;
  location: string;
}[] = [
  {
    status: "draft",
    role: "Supervisor",
    filled: 0,
    needed: 1,
    location: "Gate B",
  },
  {
    status: "open",
    role: "Bar staff",
    filled: 0,
    needed: 2,
    location: "Bar 1",
  },
  {
    status: "partly-filled",
    role: "Steward",
    filled: 1,
    needed: 3,
    location: "Gate A",
  },
  {
    status: "conflict",
    role: "Security",
    filled: 2,
    needed: 2,
    location: "Security",
  },
  {
    status: "filled",
    role: "Car park attendant",
    filled: 2,
    needed: 2,
    location: "Car park",
  },
];

/** Reads --p, the chapter's scroll progress from 0 to 1, so the fan moves with the page and nothing re-renders. */
export function SystemScene() {
  return (
    <div
      aria-hidden="true"
      inert
      className="relative flex h-full w-full items-center justify-center"
      data-theme="light"
      data-quiet-covered
    >
      {fan.map((card, i) => {
        const offset = i - (fan.length - 1) / 2;
        return (
          <div
            key={card.status}
            className="absolute w-[230px]"
            style={{
              transform: `translate(calc(min(var(--p, 0) * 1.6, 1) * ${offset * 118}px), calc(min(var(--p, 0) * 1.6, 1) * ${Math.abs(offset) * 26}px)) rotate(calc(min(var(--p, 0) * 1.6, 1) * ${offset * 9}deg + ${offset * 3}deg))`,
              zIndex: 10 - Math.abs(offset),
            }}
          >
            <ShiftCard
              className="w-full shadow-lifted"
              role={card.role}
              location={card.location}
              start="14:00"
              end="18:00"
              filled={card.filled}
              needed={card.needed}
              status={card.status}
              people={crew(i * 2, card.filled)}
              clashStaffIds={card.status === "conflict" ? [crew(i * 2, 1)[0].id] : undefined}
              tabIndex={-1}
            />
          </div>
        );
      })}
    </div>
  );
}

const swatches = [
  { name: "status/covered", className: "bg-covered" },
  { name: "status/short", className: "bg-short" },
  { name: "status/conflict", className: "bg-conflict" },
  { name: "accent/default", className: "bg-accent" },
  { name: "text/primary", className: "bg-ink" },
];

/** The token names under the fan. White on the blue chapter. */
export function TokenRow() {
  return (
    <ul aria-label="Some of the tokens" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
      {swatches.map((s) => (
        <li
          key={s.name}
          data-theme="light"
          className="flex h-8 items-center gap-2 rounded-full bg-canvas pr-3 pl-2 text-12 font-medium text-ink"
        >
          <span className={cn("size-3 rounded-full", s.className)} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}
