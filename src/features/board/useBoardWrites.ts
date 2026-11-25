"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { warnings, type RuleBreak } from "@/lib/rules";
import type { Board, BoardPerson, BoardShift } from "@/server/db/queries";
import {
  ApiError,
  approveShiftRequest,
  boardKey,
  deleteAssignment,
  newIdempotencyKey,
  postAssignment,
  postShiftRequest,
} from "./api";
import { addPerson, confirmPerson, removePerson, shiftPlace } from "./board-math";
import { useDemoState } from "./demo-state";

/** Every write shares this key, so a refetch waits until the last one settles. */
const WRITE_KEY = ["write"] as const;

export type Person = { id: number; name: string };

/** What the override dialog needs to ask for a reason and try again. */
export type OverrideRequest = {
  breaks: RuleBreak[];
  personName: string;
  shift: BoardShift;
  confirm: (reason: string) => void;
};

type Handlers = {
  /** The server wants a written reason before it goes ahead. */
  onNeedsOverride: (request: OverrideRequest) => void;
  /** A rule blocked it: shake the card and outline the person. */
  onBlocked: (shiftId: number, staffId: number) => void;
};

type AssignVars = {
  shift: BoardShift;
  person: Person;
  overrideReason?: string | null;
  /** Reused on Retry, so a request that timed out is never applied twice. */
  key: string;
  /** "assign" offers Undo; "restore" is the Undo of a remove and doesn't. */
  mode: "assign" | "restore";
};

type RemoveVars = {
  shift: BoardShift;
  person: BoardPerson;
  key: string;
  mode: "remove" | "undo";
};

type ApproveVars = {
  shift: BoardShift;
  request: BoardShift["requests"][number];
  overrideReason?: string | null;
  key: string;
};

const OPTIMISTIC_ID = -1;

/**
 * Refetch only when no other write is still in flight, otherwise the refetch
 * would land on top of another card's optimistic state and flicker it back.
 */
function refreshWhenIdle(qc: QueryClient) {
  if (qc.isMutating({ mutationKey: WRITE_KEY }) === 1) {
    void qc.invalidateQueries({ queryKey: boardKey });
    void qc.invalidateQueries({ queryKey: ["staff"] });
    void qc.invalidateQueries({ queryKey: ["activity"] });
  }
}

function patchBoard(qc: QueryClient, update: (board: Board) => Board) {
  qc.setQueryData<Board>(boardKey, (board) => (board ? update(board) : board));
}

function errorDetails(error: unknown) {
  return error instanceof ApiError ? error : new ApiError(0, "unknown", "Something went wrong. Try again.");
}

export function useBoardWrites({ onNeedsOverride, onBlocked }: Handlers) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { flags } = useDemoState();

  const remove = useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: (v: RemoveVars) => deleteAssignment(v.person.assignmentId, { flags, idempotencyKey: v.key }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: boardKey });
      patchBoard(qc, (b) => removePerson(b, v.shift.id, v.person.staffId));
    },
    onSuccess: (result, v) => {
      if (v.mode === "undo") {
        toast({ variant: "success", title: "Undone", description: `${v.person.name} is off ${shiftPlace(v.shift)}.` });
        return;
      }
      toast({
        variant: "undo",
        title: `${v.person.name} removed`,
        description: `From ${shiftPlace(v.shift)}.`,
        onAction: () =>
          assign.mutate({
            shift: v.shift,
            person: { id: v.person.staffId, name: v.person.name },
            // Put back the override reason too, so the same warning doesn't ask again.
            overrideReason: result.assignment.overrideReason,
            key: newIdempotencyKey(),
            mode: "restore",
          }),
      });
    },
    onError: (raw, v) => {
      patchBoard(qc, (b) => addPerson(b, v.shift.id, v.person));
      const error = errorDetails(raw);
      if (error.code === "assignment_not_found") {
        toast({ variant: "error", title: `${v.person.name} was already removed`, description: error.message });
        return;
      }
      toast({
        variant: "error",
        title: `Couldn't remove ${v.person.name}`,
        description: error.message,
        onAction: error.retryable ? () => remove.mutate(v) : undefined,
      });
    },
    onSettled: () => refreshWhenIdle(qc),
  });

  const assign = useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: (v: AssignVars) =>
      postAssignment(
        { shiftId: v.shift.id, staffId: v.person.id, overrideReason: v.overrideReason ?? undefined },
        { flags, idempotencyKey: v.key },
      ),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: boardKey });
      patchBoard(qc, (b) => addPerson(b, v.shift.id, { assignmentId: OPTIMISTIC_ID, staffId: v.person.id, name: v.person.name }));
    },
    onSuccess: (result, v) => {
      patchBoard(qc, (b) => confirmPerson(b, v.shift.id, v.person.id, result.assignment.id));
      if (v.mode === "restore") {
        toast({ variant: "success", title: "Undone", description: `${v.person.name} is back on ${shiftPlace(v.shift)}.` });
        return;
      }
      const filled = Math.min(v.shift.filled + 1, v.shift.slots);
      toast({
        variant: "undo",
        title: `${v.person.name} assigned`,
        description: `${shiftPlace(v.shift)}, ${filled} of ${v.shift.slots} filled.`,
        onAction: () =>
          remove.mutate({
            shift: v.shift,
            person: { assignmentId: result.assignment.id, staffId: v.person.id, name: v.person.name },
            key: newIdempotencyKey(),
            mode: "undo",
          }),
      });
    },
    onError: (raw, v) => {
      patchBoard(qc, (b) => removePerson(b, v.shift.id, v.person.id));
      const error = errorDetails(raw);
      const breaks = error.details?.breaks ?? [];

      if (error.code === "needs_override") {
        onNeedsOverride({
          breaks: warnings(breaks),
          personName: v.person.name,
          shift: v.shift,
          confirm: (reason) => assign.mutate({ ...v, overrideReason: reason, key: newIdempotencyKey() }),
        });
        return;
      }
      if (error.code === "shift_full") {
        const who = error.details?.takenBy?.name;
        toast({
          variant: "error",
          title: who ? `${who} took the last place` : "Someone else took the last place",
          description: `${shiftPlace(v.shift)} is full. The board has been refreshed.`,
        });
        return;
      }
      if (error.retryable) {
        toast({
          variant: "error",
          title: `Couldn't assign ${v.person.name}`,
          description: error.message,
          onAction: () => assign.mutate(v),
        });
        return;
      }
      onBlocked(v.shift.id, v.person.id);
      toast({ variant: "error", title: `Can't assign ${v.person.name}`, description: error.message });
    },
    onSettled: () => refreshWhenIdle(qc),
  });

  const approve = useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: (v: ApproveVars) => approveShiftRequest(v.request.requestId, v.overrideReason ?? null, { flags, idempotencyKey: v.key }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: boardKey });
      patchBoard(qc, (b) => addPerson(b, v.shift.id, { assignmentId: OPTIMISTIC_ID, staffId: v.request.staffId, name: v.request.name }));
    },
    onSuccess: (result, v) => {
      patchBoard(qc, (b) => confirmPerson(b, v.shift.id, v.request.staffId, result.assignment.id));
      toast({
        variant: "undo",
        title: `${v.request.name} approved`,
        description: `${v.request.name} is on ${shiftPlace(v.shift)}.`,
        onAction: () =>
          remove.mutate({
            shift: v.shift,
            person: { assignmentId: result.assignment.id, staffId: v.request.staffId, name: v.request.name },
            key: newIdempotencyKey(),
            mode: "undo",
          }),
      });
    },
    onError: (raw, v) => {
      patchBoard(qc, (b) => removePerson(b, v.shift.id, v.request.staffId));
      const error = errorDetails(raw);
      if (error.code === "needs_override") {
        onNeedsOverride({
          breaks: warnings(error.details?.breaks ?? []),
          personName: v.request.name,
          shift: v.shift,
          confirm: (reason) => approve.mutate({ ...v, overrideReason: reason, key: newIdempotencyKey() }),
        });
        return;
      }
      toast({
        variant: "error",
        title: `Couldn't approve ${v.request.name}`,
        description: error.message,
        onAction: error.retryable ? () => approve.mutate(v) : undefined,
      });
    },
    onSettled: () => refreshWhenIdle(qc),
  });

  const request = useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: (v: { shift: BoardShift; me: Person; key: string }) => postShiftRequest(v.shift.id, { flags, idempotencyKey: v.key }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: boardKey });
      patchBoard(qc, (b) => ({
        ...b,
        shifts: b.shifts.map((s) =>
          s.id === v.shift.id ? { ...s, requests: [...s.requests, { requestId: OPTIMISTIC_ID, staffId: v.me.id, name: v.me.name }] } : s,
        ),
      }));
    },
    onSuccess: (_result, v) => {
      toast({ variant: "success", title: "Request sent", description: `${shiftPlace(v.shift)}. A manager will approve or turn it down.` });
    },
    onError: (raw, v) => {
      patchBoard(qc, (b) => ({
        ...b,
        shifts: b.shifts.map((s) => (s.id === v.shift.id ? { ...s, requests: s.requests.filter((r) => r.staffId !== v.me.id) } : s)),
      }));
      const error = errorDetails(raw);
      toast({
        variant: "error",
        title: `Couldn't request ${shiftPlace(v.shift)}`,
        description: error.message,
        onAction: error.retryable ? () => request.mutate(v) : undefined,
      });
    },
    onSettled: () => refreshWhenIdle(qc),
  });

  // mutate is stable across renders, so these are too.
  const { mutate: assignMutate } = assign;
  const { mutate: removeMutate } = remove;
  const { mutate: approveMutate } = approve;
  const { mutate: requestMutate } = request;
  return useMemo(
    () => ({
      assign: (shift: BoardShift, person: Person) => assignMutate({ shift, person, key: newIdempotencyKey(), mode: "assign" }),
      remove: (shift: BoardShift, person: BoardPerson) => removeMutate({ shift, person, key: newIdempotencyKey(), mode: "remove" }),
      approve: (shift: BoardShift, req: BoardShift["requests"][number]) => approveMutate({ shift, request: req, key: newIdempotencyKey() }),
      request: (shift: BoardShift, me: Person) => requestMutate({ shift, me, key: newIdempotencyKey() }),
    }),
    [assignMutate, removeMutate, approveMutate, requestMutate],
  );
}
