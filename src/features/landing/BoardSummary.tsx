"use client";

import { useEffect, useState } from "react";
import { EVENT_ID } from "@/features/board/api";
import type { Board } from "@/server/db/queries";

type Summary = { covered: number; shifts: number; short: number; from: string | null; to: string | null };

const hh = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;

/** "38 of 42 shifts covered. 4 short between 14:00 and 16:00." */
export function summarise(board: Pick<Board, "summary" | "coverage">): Summary {
  const shortHours = board.coverage.filter((h) => h.needed > h.assigned).map((h) => Number(h.hour.slice(0, 2)));
  return {
    covered: board.summary.covered,
    shifts: board.summary.shifts,
    short: board.summary.shifts - board.summary.covered,
    from: shortHours.length ? hh(shortHours[0]) : null,
    to: shortHours.length ? hh(shortHours[shortHours.length - 1] + 1) : null,
  };
}

/**
 * A live line from the board API, so the landing page says what the board
 * says right now. Until it answers, a blank line of the same height holds the
 * space; if it fails, the line stays out.
 */
export function BoardSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/events/${EVENT_ID}/board`, { credentials: "same-origin", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((board: Board) => setSummary(summarise(board)))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  if (failed) return null;
  return (
    <span className="block min-h-10 text-14 text-ink tabular">
      {summary ? (
        <>
          <span className="font-semibold">
            {summary.covered} of {summary.shifts} shifts covered.
          </span>{" "}
          {summary.short === 0 ? (
            "Every hour has the staff it needs."
          ) : (
            <span className="text-short">
              {summary.short} short
              {summary.from && summary.to ? ` between ${summary.from} and ${summary.to}` : null}.
            </span>
          )}
        </>
      ) : null}
    </span>
  );
}
