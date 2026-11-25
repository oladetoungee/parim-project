import { ShiftCardSkeleton } from "@/components/ui/ShiftCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { HOUR_WIDTH, TIMELINE_WIDTH } from "./board-math";
import { GUTTER_WIDTH } from "./Timeline";

/** Lane layout for the placeholder rows: [start hour, length in hours]. */
const rows = [
  [[0, 6], [6, 6], [12, 4]],
  [[2, 5], [7, 2], [9, 7]],
  [[0, 8], [8, 7]],
];

const barHeights = [20, 24, 36, 44, 52, 56, 56, 56, 56, 52, 48, 44, 36, 28, 24, 16];

/** The board's footprint with no data: header, strip and three location rows. No spinner. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <p className="sr-only">Loading the board.</p>
      <div className="flex items-end justify-between gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-96 max-w-full" />
        </div>
        <Skeleton className="hidden h-8 w-32 md:block" />
      </div>
      <div className="hidden md:flex">
        <div style={{ width: GUTTER_WIDTH }}>
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex items-end gap-1" style={{ width: TIMELINE_WIDTH }}>
          {barHeights.map((h, i) => (
            <span key={i} className="block w-[52px]" style={{ height: h }}>
              <Skeleton className="size-full" />
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((lanes, r) => (
          <div key={r} className="flex flex-col gap-3 border-b border-hairline py-4 md:flex-row md:gap-0">
            <div className="flex flex-col gap-2" style={{ width: GUTTER_WIDTH }}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
            <div className="relative hidden h-[104px] md:block" style={{ width: TIMELINE_WIDTH }}>
              {lanes.map(([start, length]) => (
                <div key={start} className="absolute top-0 pr-1" style={{ left: start * HOUR_WIDTH, width: length * HOUR_WIDTH }}>
                  <ShiftCardSkeleton className="w-full" places={Math.min(4, length)} />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              <ShiftCardSkeleton className="w-full" />
              <ShiftCardSkeleton className="w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
