"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { CloseIcon } from "@/components/ui/icons";
import { StaffRow } from "@/components/ui/StaffRow";
import { cn } from "@/lib/cn";
import type { BoardShift, StaffListItem } from "@/server/db/queries";
import { capitalise, shiftPlace } from "./board-math";
import type { DropCheck } from "./dnd";
import { rowLicence, StaffColumns } from "./StaffPanel";

type StaffSheetProps = {
  shift: BoardShift | null;
  onClose: () => void;
  items: readonly StaffListItem[] | undefined;
  search: string;
  onSearchChange: (value: string) => void;
  eventDate: string;
  check: (staffId: number, shiftId: number) => DropCheck;
  onPick: (shift: BoardShift, person: StaffListItem) => void;
  onOpenDetails: (shiftId: number) => void;
};

/**
 * Mobile assigning: tap a shift, then a person here. No dragging on touch.
 * People who can't go on the shift stay in the list, greyed, with the reason.
 */
export function StaffSheet({ shift, onClose, items, search, onSearchChange, eventDate, check, onPick, onOpenDetails }: StaffSheetProps) {
  const searchId = useId();
  return (
    <Dialog.Root open={shift !== null} onOpenChange={(open) => !open && onClose()}>
      {shift ? (
        <Dialog.Portal>
          <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-scrim" />
          <Dialog.Content
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-8 border-t border-hairline bg-raised shadow-lifted outline-hidden",
              "motion-safe:data-[state=open]:animate-[toast-in_var(--duration-base)_var(--easing-enter)_both]",
              "motion-reduce:data-[state=open]:animate-fade-in",
            )}
          >
            <header className="flex items-start gap-3 border-b border-hairline px-4 pt-4 pb-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Dialog.Title className="font-display text-20 leading-7 font-bold tracking-[-0.01em] text-ink">
                  Assign to {capitalise(shift.roleName)}
                </Dialog.Title>
                <Dialog.Description className="text-14 text-muted tabular">
                  {shiftPlace(shift)}, {shift.filled} of {shift.slots} filled
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-4 text-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <CloseIcon />
              </Dialog.Close>
            </header>
            <div className="flex flex-col gap-3 px-4 py-3">
              <label htmlFor={searchId} className="sr-only">
                Search staff by name
              </label>
              <Input id={searchId} type="search" placeholder="Search by name" value={search} onChange={(e) => onSearchChange(e.target.value)} />
              <Button size="sm" variant="secondary" className="self-start" onClick={() => onOpenDetails(shift.id)}>
                Edit shift
              </Button>
            </div>
            <div className="border-t border-hairline">
              <StaffColumns />
            </div>
            <ul aria-label="Staff" className="min-h-0 flex-1 overflow-y-auto px-1 pt-1 pb-2">
              {items?.map((item) => {
                const result = check(item.id, shift.id);
                const reasonId = `${searchId}-reason-${item.id}`;
                return (
                  <li key={item.id}>
                    {/* StaffRow's `role` prop is the job role, so the button is a wrapper. */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-disabled={result.valid ? undefined : true}
                                    aria-describedby={result.valid ? undefined : reasonId}
                      onClick={() => result.valid && onPick(shift, item)}
                      onKeyDown={(e) => {
                        if (result.valid && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          onPick(shift, item);
                        }
                      }}
                      className="block outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
                    >
                      <StaffRow
                        tabIndex={-1}
                        role={capitalise(item.roleName)}
                        name={item.name}
                        licence={rowLicence(item, eventDate)}
                        hoursThisWeek={item.hoursThisWeek}
                        maxHours={item.weeklyHourLimit}
                        state={result.valid ? "default" : "disabled"}
                        className={cn("cursor-pointer", !result.valid && "cursor-not-allowed border-b-0")}
                      />
                    </div>
                    {result.valid ? null : (
                      <p id={reasonId} className="border-b border-hairline px-3 pb-2.5 pl-[52px] text-12 text-muted">
                        {result.reason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
