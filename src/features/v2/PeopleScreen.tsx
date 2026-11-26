"use client";

import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Drawer, DrawerContent } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input, Select } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { capitalise, longDate } from "@/features/board/board-math";
import { useBoard, useStaff } from "@/features/board/queries";
import { rowLicence } from "@/features/board/StaffPanel";
import { cn } from "@/lib/cn";
import type { Board, BoardShift, StaffListItem } from "@/server/db/queries";
import { ManagerOnly, PageHeader } from "./PageParts";
import { useAppBase } from "./app-base";

/** Within this many hours of their weekly limit counts as close to it. */
const NEAR_LIMIT_HOURS = 8;

const views = [
  { value: "all", label: "Everyone" },
  { value: "free", label: "Not on a shift" },
  { value: "licence", label: "Licence issue" },
  { value: "hours", label: "Near hour limit" },
] as const;

type View = (typeof views)[number]["value"];

function licenceText(person: StaffListItem, eventDate: string): { text: string; problem: boolean } {
  const row = rowLicence(person, eventDate);
  if (!row) return { text: "None", problem: false };
  if (row.status === "valid") return { text: "Valid", problem: false };
  if (row.status === "expired") return { text: "Expired", problem: true };
  return { text: `Expires in ${row.daysLeft} ${row.daysLeft === 1 ? "day" : "days"}`, problem: true };
}

function nearLimit(person: StaffListItem) {
  return person.weeklyHourLimit - person.hoursThisWeek <= NEAR_LIMIT_HOURS;
}

/**
 * Everyone on the event in one table, which the drag panel never showed:
 * role, licence, hours, and what they are on today. Click a person for the detail.
 */
export function PeopleScreen() {
  const boardQuery = useBoard();
  const board = boardQuery.data;
  const manager = board?.viewer.role === "manager";
  const staff = useStaff("", manager);

  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState<number | null>(null);
  const [view, setView] = useState<View>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const searchId = useId();
  const roleSelectId = useId();

  const dayShifts = useMemo(() => {
    const map = new Map<number, BoardShift[]>();
    for (const s of board?.shifts ?? []) {
      for (const p of s.assigned) map.set(p.staffId, [...(map.get(p.staffId) ?? []), s]);
    }
    return map;
  }, [board]);

  const rows = useMemo(() => {
    if (!board) return [];
    const q = search.trim().toLowerCase();
    return (staff.data ?? []).filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (roleId !== null && p.roleId !== roleId) return false;
      if (view === "free" && dayShifts.has(p.id)) return false;
      if (view === "licence" && !licenceText(p, board.date).problem) return false;
      if (view === "hours" && !nearLimit(p)) return false;
      return true;
    });
  }, [board, staff.data, search, roleId, view, dayShifts]);

  if (!board || (manager && staff.isPending)) {
    if (boardQuery.isError || staff.isError) {
      return (
        <Page>
          <ErrorState
            title="Couldn't load the people"
            description={(boardQuery.error ?? staff.error)?.message}
            onRetry={() => {
              void boardQuery.refetch();
              void staff.refetch();
            }}
          />
        </Page>
      );
    }
    return (
      <Page>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </Page>
    );
  }

  if (!manager) return <ManagerOnly page="People" />;

  const everyone = staff.data ?? [];
  const onShift = everyone.filter((p) => dayShifts.has(p.id)).length;
  const open = openId === null ? null : (everyone.find((p) => p.id === openId) ?? null);

  return (
    <Page>
      <PageHeader title="People" line={`${everyone.length} people, ${onShift} on a shift on ${longDate(board.date)}.`} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <label htmlFor={searchId} className="sr-only">
          Search people
        </label>
        <Input
          id={searchId}
          type="search"
          placeholder="Search by name"
          className="h-8 w-full sm:w-56"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label htmlFor={roleSelectId} className="sr-only">
          Role
        </label>
        <Select
          id={roleSelectId}
          className="h-8 w-40"
          value={roleId ?? ""}
          onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All roles</option>
          {board.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {capitalise(r.name)}
            </option>
          ))}
        </Select>
        <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <SegmentedControl aria-label="Show" size="sm" options={views} value={view} onValueChange={setView} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nobody matches" description="Try another name, role or view." />
      ) : (
        <>
          {/* On a phone each person is two lines instead of a five-column table. */}
          <ul className="flex flex-col border-t border-hairline sm:hidden">
            {rows.map((p) => {
              const licence = licenceText(p, board.date);
              const shifts = dayShifts.get(p.id) ?? [];
              return (
                <li key={p.id} className="border-b border-hairline">
                  <button
                    type="button"
                    onClick={() => setOpenId(p.id)}
                    className="flex w-full items-center gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Avatar name={p.name} decorative />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-14 font-medium text-ink">
                        {p.name} <span className="font-normal text-muted">{capitalise(p.roleName)}</span>
                      </span>
                      <span className="text-12 text-muted tabular">
                        {p.hoursThisWeek} of {p.weeklyHourLimit} h,{" "}
                        {shifts.length === 0 ? "free" : shifts.map((s) => `${s.locationName} ${s.startTime}`).join(", ")}
                        {licence.problem ? <span className="text-conflict">, SIA {licence.text.toLowerCase()}</span> : null}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline text-12 text-muted">
                  <th scope="col" className="py-2 pr-4 font-normal">
                    Name
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    Role
                  </th>
                  <th scope="col" className="py-2 pr-4 font-normal">
                    SIA licence
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-normal">
                    Hours this week
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    On the day
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const licence = licenceText(p, board.date);
                  const shifts = dayShifts.get(p.id) ?? [];
                  return (
                    <tr key={p.id} className="border-b border-hairline hover:bg-hover">
                      <th scope="row" className="py-2 pr-4 font-normal">
                        <button
                          type="button"
                          onClick={() => setOpenId(p.id)}
                          className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          <Avatar name={p.name} decorative />
                          <span className="text-14 font-medium text-ink">{p.name}</span>
                        </button>
                      </th>
                      <td className="py-2 pr-4 text-14 text-ink">{capitalise(p.roleName)}</td>
                      <td className={cn("py-2 pr-4 text-14", licence.problem ? "text-conflict" : "text-muted")}>
                        {licence.text}
                      </td>
                      <td
                        className={cn(
                          "py-2 pr-4 text-right text-14 tabular",
                          nearLimit(p) ? "font-medium text-ink" : "text-muted",
                        )}
                      >
                        {p.hoursThisWeek} of {p.weeklyHourLimit}
                      </td>
                      <td className="py-2 text-14 text-ink tabular">
                        {shifts.length === 0 ? (
                          <span className="text-muted">Free</span>
                        ) : (
                          shifts.map((s) => `${s.locationName} ${s.startTime}`).join(", ")
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PersonDrawer
        board={board}
        person={open}
        shifts={open ? (dayShifts.get(open.id) ?? []) : []}
        onClose={() => setOpenId(null)}
      />
    </Page>
  );
}

function PersonDrawer({
  board,
  person,
  shifts,
  onClose,
}: {
  board: Board;
  person: StaffListItem | null;
  shifts: BoardShift[];
  onClose: () => void;
}) {
  const base = useAppBase();
  return (
    <Drawer open={person !== null} onOpenChange={(o) => !o && onClose()}>
      {person ? (
        <DrawerContent title={person.name} description={`${capitalise(person.roleName)}, ${person.email}`}>
          <div className="flex flex-col gap-8">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Fact label="Hours this week">
                {person.hoursThisWeek} of {person.weeklyHourLimit}
              </Fact>
              <Fact label="SIA licence">
                {licenceText(person, board.date).text}
                {person.licence.expiresOn ? (
                  <span className="block text-12 text-muted">Until {longDate(person.licence.expiresOn)}</span>
                ) : null}
              </Fact>
            </dl>
            <section className="flex flex-col gap-3">
              <h3 className="text-16 leading-6 font-semibold text-ink">On {longDate(board.date)}</h3>
              {shifts.length === 0 ? (
                <p className="text-14 text-muted">Not on a shift yet. Drag them onto one from the schedule.</p>
              ) : (
                <ul className="flex flex-col border-t border-hairline">
                  {shifts.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 border-b border-hairline py-2.5">
                      <span className="text-14 text-ink tabular">
                        {capitalise(s.roleName)} at {s.locationName}, {s.startTime} to {s.endTime}
                      </span>
                      <Link
                        href={`${base}/schedule?shift=${s.id}`}
                        className="shrink-0 text-14 text-muted underline-offset-4 hover:text-ink hover:underline"
                      >
                        View shift
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <Link href={`${base}/schedule`} className="self-start text-14 font-medium text-ink underline underline-offset-4">
              Open the schedule
            </Link>
          </div>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-12 text-muted">{label}</dt>
      <dd className="text-14 font-medium text-ink tabular">{children}</dd>
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <main className="flex w-full max-w-[1080px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">{children}</main>;
}
