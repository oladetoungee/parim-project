"use client";

import { useId, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import type { Board, BoardShift } from "@/server/db/queries";
import { capitalise, shiftSpan } from "./board-math";
import { BoardShiftCard } from "./Timeline";
import type { Person } from "./useBoardWrites";

/** Room the stub keeps for the Request shift button, and for the "Requested" note that replaces it. */
const REQUEST_WIDTH = 112;
const REQUESTED_WIDTH = 140;

/** The worker's own name comes back on their own shifts; the server strips everyone else's. */
export function workerIdentity(board: Board): Person | null {
  if (board.viewer.role !== "worker") return null;
  const staffId = board.viewer.staffId;
  const name = board.shifts.flatMap((s) => s.assigned).find((p) => p.staffId === staffId)?.name;
  return { id: staffId, name: name ?? "You" };
}

/**
 * Open shifts this worker could be put on: not full, not theirs, no overlap
 * with a shift they already have, and in their role. The role is read off a
 * shift they hold (the role rule means it must match); with none, every role
 * shows and the server's role check has the last word.
 */
export function openShiftsFor(board: Board): BoardShift[] {
  const mine = board.shifts.filter((s) => s.assignedToMe);
  const roleIds = new Set(mine.map((s) => s.roleId));
  return board.shifts.filter((s) => {
    if (s.assignedToMe || s.filled >= s.slots) return false;
    if (roleIds.size > 0 && !roleIds.has(s.roleId)) return false;
    const span = shiftSpan(s);
    return !mine.some((m) => {
      const other = shiftSpan(m);
      return span.start < other.end && other.start < span.end;
    });
  });
}

type WorkerPanelProps = {
  board: Board;
  onOpen: (shiftId: number) => void;
  onRequest: (shift: BoardShift) => void;
};

export function WorkerPanel({ board, onOpen, onRequest }: WorkerPanelProps) {
  const me = workerIdentity(board);
  const mine = useMemo(() => board.shifts.filter((s) => s.assignedToMe), [board.shifts]);
  const open = useMemo(() => openShiftsFor(board), [board]);
  const mineId = useId();
  const openId = useId();

  return (
    <div className="flex flex-col gap-8 px-4 pt-6 pb-8">
      {me ? (
        <p className="text-14 text-muted">
          Signed in as <span className="font-medium text-ink">{me.name}</span>
          {mine[0] ? `, ${mine[0].roleName}` : null}. Other people&rsquo;s names are hidden.
        </p>
      ) : null}

      <section aria-labelledby={mineId} className="flex flex-col gap-3">
        <h2 id={mineId} className="font-display text-20 leading-7 font-bold tracking-[-0.01em] text-ink">
          My shifts
        </h2>
        {mine.length === 0 ? (
          <p className="text-14 text-muted">You have no shifts on this day yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {mine.map((s) => (
              <li key={s.id}>
                <BoardShiftCard shift={s} dimmed={false} selected={false} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby={openId} className="flex flex-col gap-3">
        <h2 id={openId} className="font-display text-20 leading-7 font-bold tracking-[-0.01em] text-ink">
          Open shifts you can take
        </h2>
        {open.length === 0 ? (
          <p className="text-14 text-muted">Nothing open in your role that fits around your shifts.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {open.map((s) => {
              const requested = s.requests.some((r) => r.staffId === me?.id);
              return (
                <li key={s.id} className="relative">
                  <BoardShiftCard
                    shift={s}
                    dimmed={false}
                    selected={false}
                    onOpen={onOpen}
                    stubActionWidth={requested ? REQUESTED_WIDTH : REQUEST_WIDTH}
                  />
                  {/*
                   * Laid over the ticket's stub, right aligned. A sibling of the
                   * card's button, not a child: buttons can't nest.
                   */}
                  {requested ? (
                    <p
                      className="absolute right-[13px] bottom-[7px] flex h-8 flex-col items-end justify-center text-right text-12 leading-4 text-ink"
                      style={{ width: REQUESTED_WIDTH }}
                    >
                      <span className="font-medium">Requested.</span>
                      <span className="text-muted">Waiting for a manager.</span>
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute right-[13px] bottom-[7px] bg-canvas px-0"
                      style={{ width: REQUEST_WIDTH }}
                      onClick={() => onRequest(s)}
                      aria-label={`Request shift: ${capitalise(s.roleName)}, ${s.locationName} ${s.startTime} to ${s.endTime}`}
                    >
                      Request shift
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
