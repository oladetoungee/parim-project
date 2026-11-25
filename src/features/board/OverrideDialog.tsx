"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { MIN_REST_HOURS, type RuleBreak, type RuleCode } from "@/lib/rules";
import { shiftPlace } from "./board-math";
import type { OverrideRequest } from "./useBoardWrites";

const titles: Partial<Record<RuleCode, string>> = {
  rest_too_short: `Less than ${MIN_REST_HOURS} hours rest`,
  weekly_hours: "Over the weekly hour limit",
};

/** The dialog title: the warning's own name, or a count when there are several kinds. */
export function overrideTitle(breaks: readonly RuleBreak[]) {
  const kinds = [...new Set(breaks.map((b) => b.code))];
  if (kinds.length === 1) return titles[kinds[0]] ?? "This assignment has a warning";
  return `This assignment has ${breaks.length} warnings`;
}

type OverrideDialogProps = {
  request: OverrideRequest | null;
  onClose: () => void;
};

/**
 * Asked when the server answers needs_override. The reason goes into the
 * audit log with the assignment. Radix traps focus and returns it on close.
 */
export function OverrideDialog({ request, onClose }: OverrideDialogProps) {
  return (
    <Dialog.Root open={request !== null} onOpenChange={(open) => !open && onClose()}>
      {request ? <OverrideForm key={`${request.shift.id}-${request.personName}`} request={request} onClose={onClose} /> : null}
    </Dialog.Root>
  );
}

function OverrideForm({ request, onClose }: { request: OverrideRequest; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Give a short reason for the override.");
      return;
    }
    request.confirm(reason.trim());
    onClose();
  }

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="motion-overlay fixed inset-0 z-40 bg-scrim" />
      <Dialog.Content className="motion-popover fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-8 border border-hairline bg-raised shadow-lifted outline-hidden">
        <form onSubmit={submit} noValidate>
          <div className="flex flex-col gap-4 px-6 pt-6 pb-4">
            <Dialog.Title className="font-display text-20 leading-7 font-bold tracking-[-0.01em] text-ink">
              {overrideTitle(request.breaks)}
            </Dialog.Title>
            <Dialog.Description className="text-14 text-muted">
              Assigning {request.personName} to {shiftPlace(request.shift)}.
            </Dialog.Description>
            <ul className="flex flex-col gap-2">
              {request.breaks.map((b, i) => (
                <li key={`${b.code}-${i}`} className="text-14 text-ink">
                  {b.message}
                </li>
              ))}
            </ul>
            <Field label="Reason" hint="Saved in the shift's activity." error={error ?? undefined} required>
              <Input
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Agreed with them on the phone"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-hairline px-6 py-4">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" variant="primary">
              Assign anyway
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
