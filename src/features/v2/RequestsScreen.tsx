"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { blocks, checkAssignment, warnings, type RuleBreak } from "@/lib/rules";
import { capitalise } from "@/features/board/board-math";
import { OverrideDialog } from "@/features/board/OverrideDialog";
import { useBoard, useStaff } from "@/features/board/queries";
import { useBoardWrites, type OverrideRequest } from "@/features/board/useBoardWrites";
import type { BoardShift, StaffListItem } from "@/server/db/queries";
import { ManagerOnly, PageHeader } from "./PageParts";
import { useAppBase } from "./app-base";

type Row = { shift: BoardShift; request: BoardShift["requests"][number]; breaks: RuleBreak[] };

/**
 * Every request waiting, in one list, instead of inside each shift's drawer.
 * The rules run before the click, so a request that would be blocked or need
 * a reason says so on the row.
 */
export function RequestsScreen() {
  const boardQuery = useBoard();
  const board = boardQuery.data;
  const manager = board?.viewer.role === "manager";
  const staff = useStaff("", manager);
  const [override, setOverride] = useState<OverrideRequest | null>(null);
  const base = useAppBase();

  const writes = useBoardWrites({
    onNeedsOverride: setOverride,
    onBlocked: () => {},
  });

  const rows = useMemo<Row[]>(() => {
    if (!board) return [];
    const byId = new Map<number, StaffListItem>((staff.data ?? []).map((p) => [p.id, p]));
    return board.shifts
      .flatMap((shift) =>
        shift.requests.map((request) => {
          const person = byId.get(request.staffId);
          const breaks = person
            ? checkAssignment({ shift, staff: person, booked: person.booked, timezone: board.event.timezone })
            : [];
          return { shift, request, breaks };
        }),
      )
      .sort((a, b) => a.shift.startTime.localeCompare(b.shift.startTime));
  }, [board, staff.data]);

  if (!board) {
    if (boardQuery.isError) {
      return (
        <Page>
          <ErrorState
            title="Couldn't load the requests"
            description={boardQuery.error?.message}
            onRetry={() => void boardQuery.refetch()}
          />
        </Page>
      );
    }
    return (
      <Page>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </Page>
    );
  }

  if (!manager) return <ManagerOnly page="Requests" />;

  return (
    <Page>
      <PageHeader
        title="Requests"
        line={
          rows.length === 0
            ? "Nothing waiting."
            : `${rows.length} ${rows.length === 1 ? "worker wants" : "workers want"} an open shift. Approving puts them on it.`
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No requests waiting"
          description="When a worker asks for an open shift it shows up here. Switch to Worker in the app bar to send one."
          actions={
            <Link href={`${base}/schedule`} className="text-14 font-medium text-ink underline underline-offset-4">
              Back to the schedule
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col border-t border-hairline">
          {rows.map(({ shift, request, breaks }) => {
            const blocked = blocks(breaks);
            const warned = warnings(breaks);
            const full = shift.filled >= shift.slots;
            const note = full
              ? "The shift filled up since they asked."
              : blocked[0]
                ? `Can't approve: ${blocked[0].message}`
                : warned[0]
                  ? `Needs a reason: ${warned[0].message}`
                  : null;
            return (
              <li key={request.requestId} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline py-3">
                <Avatar name={request.name} />
                <div className="flex min-w-0 flex-1 basis-[calc(100%-3rem)] flex-col sm:basis-0">
                  <span className="text-14 font-medium text-ink">{request.name}</span>
                  <span className="text-14 text-muted tabular">
                    {capitalise(shift.roleName)} at {shift.locationName}, {shift.startTime} to {shift.endTime}
                  </span>
                  {note ? (
                    <span className={blocked[0] || full ? "text-14 text-conflict" : "text-14 text-muted"}>{note}</span>
                  ) : null}
                </div>
                <span className="flex items-center gap-2 pl-11 text-14 text-muted tabular sm:pl-0">
                  {shift.filled} of {shift.slots}
                  <Badge status={shift.status} />
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Link
                    href={`${base}/schedule?shift=${shift.id}`}
                    className="inline-flex h-8 items-center px-2 text-14 text-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    View shift
                  </Link>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={request.requestId < 0 || full || blocked.length > 0}
                    onClick={() => writes.approve(shift, request)}
                  >
                    Approve
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <OverrideDialog request={override} onClose={() => setOverride(null)} />
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <main className="flex w-full max-w-[1080px] flex-col gap-6 px-4 py-6 md:px-8 md:py-8">{children}</main>;
}
