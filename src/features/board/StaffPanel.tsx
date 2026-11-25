"use client";

import { useDraggable } from "@dnd-kit/core";
import { memo, useId, type KeyboardEvent, type RefObject } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { StaffRow, type LicenceStatus as RowLicence } from "@/components/ui/StaffRow";
import { cn } from "@/lib/cn";
import { daysBetween } from "@/lib/time";
import type { StaffListItem } from "@/server/db/queries";
import { capitalise } from "./board-math";
import { staffDragId } from "./dnd";

/** StaffRow shows the SIA state only for people who hold or need a licence. */
export function rowLicence(item: StaffListItem, eventDate: string): RowLicence | undefined {
  const { status, expiresOn } = item.licence;
  if (status === "valid") return { status: "valid" };
  if (status === "expired") return { status: "expired" };
  if (status === "expiring" && expiresOn) return { status: "expiring", daysLeft: daysBetween(eventDate, expiresOn) };
  return undefined;
}

/** Column header over the staff list: hours are this week's, said once here instead of on every row. */
export function StaffColumns() {
  return (
    <div aria-hidden="true" className="flex items-center justify-between border-b border-hairline px-4 py-2 text-12 leading-4 text-muted">
      <span>Name and role</span>
      <span>Hours this week</span>
    </div>
  );
}

type DraggableStaffProps = {
  item: StaffListItem;
  eventDate: string;
  /** Another row is being dragged. */
  dimmed: boolean;
  /** Stops the list scrolling under a keyboard drag (see StaffPanel). */
  onKeyboardPickUp: () => void;
};

const DraggableStaff = memo(function DraggableStaff({ item, eventDate, dimmed, onKeyboardPickUp }: DraggableStaffProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: staffDragId(item.id) });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === " " || e.key === "Enter") onKeyboardPickUp();
    listeners?.onKeyDown?.(e);
  };
  // StaffRow's `role` prop is the job role, so the drag handle is a wrapper
  // that carries dnd-kit's button role and keyboard listeners.
  return (
    <li>
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onKeyDown={onKeyDown}
        aria-roledescription="draggable person"
        className={cn(
          "block outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
          "transition-opacity duration-quick ease-standard",
          (isDragging || dimmed) && "opacity-40",
        )}
      >
        <StaffRow
          tabIndex={-1}
          name={item.name}
          role={capitalise(item.roleName)}
          licence={rowLicence(item, eventDate)}
          hoursThisWeek={item.hoursThisWeek}
          maxHours={item.weeklyHourLimit}
        />
      </div>
    </li>
  );
});

type StaffPanelProps = {
  search: string;
  onSearchChange: (value: string) => void;
  items: readonly StaffListItem[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  eventDate: string;
  draggingStaffId: number | null;
  listRef: RefObject<HTMLUListElement | null>;
  onKeyboardPickUp: () => void;
};

/**
 * "Available staff": search plus a list of rows to drag onto shifts. The list
 * scrolls on its own; while a keyboard drag runs it is pinned (overflow
 * hidden), because dnd-kit would otherwise scroll it as the arrow keys move
 * the dragged person across the board.
 */
export function StaffPanel({
  search,
  onSearchChange,
  items,
  loading,
  error,
  onRetry,
  eventDate,
  draggingStaffId,
  listRef,
  onKeyboardPickUp,
}: StaffPanelProps) {
  const searchId = useId();
  const headingId = useId();
  return (
    <aside aria-labelledby={headingId} className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-hairline px-4 pt-6 pb-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={headingId} className="font-display text-20 leading-7 font-bold tracking-[-0.01em] text-ink">
            Available staff
          </h2>
          {items ? <span className="text-12 text-muted tabular">{items.length} shown</span> : null}
        </div>
        <label htmlFor={searchId} className="sr-only">
          Search staff by name
        </label>
        <Input
          id={searchId}
          type="search"
          placeholder="Search by name"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
        />
        <p className="text-12 text-muted">Drag a person onto a shift, or focus them and press Space.</p>
      </div>

      {error && !items ? (
        <ErrorState className="px-4" title="Couldn't load staff" description="The board still works. Try again to assign people." onRetry={onRetry} />
      ) : loading && !items ? (
        <ul aria-hidden="true" className="flex flex-col">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 border-b border-hairline px-3 py-2.5">
              <Skeleton className="size-7 rounded-full" />
              <span className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </span>
              <Skeleton className="h-3 w-8" />
            </li>
          ))}
        </ul>
      ) : items && items.length === 0 ? (
        <p className="px-4 py-6 text-14 text-muted">No one matches &ldquo;{search}&rdquo;.</p>
      ) : (
        <>
        <StaffColumns />
        {/* Padded so the 2px focus ring, offset 2px, isn't clipped by the scroll box. */}
        <ul ref={listRef} aria-label="Staff" className="min-h-0 flex-1 overflow-y-auto px-1 pt-1 pb-2">
          {items?.map((item) => (
            <DraggableStaff
              key={item.id}
              item={item}
              eventDate={eventDate}
              dimmed={draggingStaffId !== null && draggingStaffId !== item.id}
              onKeyboardPickUp={onKeyboardPickUp}
            />
          ))}
        </ul>
        </>
      )}
    </aside>
  );
}
