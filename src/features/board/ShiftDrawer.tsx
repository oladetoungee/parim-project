"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer, DrawerContent } from "@/components/ui/Drawer";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import { TimeRangeField, type TimeRange } from "@/components/ui/TimeRangeField";
import { useToast } from "@/components/ui/Toast";
import type { RuleBreak } from "@/lib/rules";
import type { Board, BoardPerson, BoardShift } from "@/server/db/queries";
import { ApiError, boardKey, newIdempotencyKey, patchShift, type Activity, type ShiftPatch } from "./api";
import { capitalise, shiftPlace } from "./board-math";
import { useDemoState } from "./demo-state";
import { useActivity } from "./queries";

const badgeFor = { covered: "covered", short: "short", open: "open" } as const;

type ShiftDrawerProps = {
  board: Board;
  shift: BoardShift | null;
  onClose: () => void;
  onRemove: (shift: BoardShift, person: BoardPerson) => void;
  onApprove: (shift: BoardShift, request: BoardShift["requests"][number]) => void;
};

/**
 * Click or Enter on a shift opens this. Managers edit the shift, remove
 * people, approve requests and read the shift's activity. Radix Dialog under
 * the Drawer traps focus and puts it back on the card when it closes.
 */
export function ShiftDrawer({ board, shift, onClose, onRemove, onApprove }: ShiftDrawerProps) {
  const manager = board.viewer.role === "manager";
  return (
    <Drawer open={shift !== null} onOpenChange={(open) => !open && onClose()}>
      {shift ? (
        <DrawerContent
          title={`${capitalise(shift.roleName)} at ${shift.locationName}`}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                {shift.startTime} to {shift.endTime}, {shift.filled} of {shift.slots} filled
              </span>
              <Badge status={badgeFor[shift.status]} />
            </span>
          }
        >
          <div className="flex flex-col gap-8">
            {manager ? <EditShiftForm key={shift.id} board={board} shift={shift} /> : <WorkerDetails shift={shift} />}
            {manager && shift.requests.length > 0 ? (
              <DrawerSection title="Requests">
                <ul className="flex flex-col">
                  {shift.requests.map((r) => (
                    <li key={r.requestId} className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0">
                      <Avatar name={r.name} />
                      <span className="min-w-0 flex-1 truncate text-14 font-medium text-ink">{r.name}</span>
                      <Button size="sm" variant="secondary" onClick={() => onApprove(shift, r)} disabled={r.requestId < 0}>
                        Approve
                      </Button>
                    </li>
                  ))}
                </ul>
              </DrawerSection>
            ) : null}
            {manager ? <AssignedList shift={shift} onRemove={onRemove} /> : null}
            {manager ? <ActivityList shiftId={shift.id} timezone={board.event.timezone} /> : null}
          </div>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-14 font-semibold text-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

function WorkerDetails({ shift }: { shift: BoardShift }) {
  return (
    <DrawerSection title="Details">
      <p className="text-14 text-ink">{shiftPlace(shift)}</p>
      {shift.notes ? <p className="text-14 text-muted">{shift.notes}</p> : null}
      {shift.assignedToMe ? <p className="text-14 text-ink">You are on this shift.</p> : null}
      {!shift.assignedToMe && shift.requests.length > 0 ? <p className="text-14 text-ink">Requested. Waiting for a manager.</p> : null}
    </DrawerSection>
  );
}

function AssignedList({ shift, onRemove }: { shift: BoardShift; onRemove: ShiftDrawerProps["onRemove"] }) {
  return (
    <DrawerSection title={`Assigned, ${shift.filled} of ${shift.slots}`}>
      {shift.assigned.length === 0 ? (
        <p className="text-14 text-muted">No one yet. Drag a person from Available staff onto the shift.</p>
      ) : (
        <ul className="flex flex-col">
          {shift.assigned.map((p) => (
            <li key={p.staffId} className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0">
              <Avatar name={p.name} />
              <span className="min-w-0 flex-1 truncate text-14 font-medium text-ink">{p.name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove(shift, p)}
                // Still saving: there is no assignment id to remove yet.
                disabled={p.assignmentId < 0}
                aria-label={`Remove ${p.name}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DrawerSection>
  );
}

// ---------------------------------------------------------------- edit form

/** PATCH 409s say which people on the shift break which rule. */
type PersonBreaks = { staffId: number; name: string; breaks: RuleBreak[] };

type FormState = { roleId: number; time: TimeRange; slots: string; notes: string };

function initialForm(shift: BoardShift): FormState {
  return { roleId: shift.roleId, time: { start: shift.startTime, end: shift.endTime }, slots: String(shift.slots), notes: shift.notes ?? "" };
}

function changesFrom(shift: BoardShift, form: FormState): Omit<ShiftPatch, "version"> {
  const patch: Omit<ShiftPatch, "version"> = {};
  if (form.roleId !== shift.roleId) patch.roleId = form.roleId;
  if (form.time.start !== shift.startTime || form.time.end !== shift.endTime) {
    patch.startTime = form.time.start;
    patch.endTime = form.time.end;
  }
  if (Number(form.slots) !== shift.slots) patch.slots = Number(form.slots);
  if (form.notes.trim() !== (shift.notes ?? "")) patch.notes = form.notes.trim() || null;
  return patch;
}

function EditShiftForm({ board, shift }: { board: Board; shift: BoardShift }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { flags } = useDemoState();
  const [form, setForm] = useState(() => initialForm(shift));
  // The version the edit started from. A newer one on the server means someone else saved first.
  const [baseVersion, setBaseVersion] = useState(shift.version);
  const [needsReason, setNeedsReason] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<{ message: string; stale?: boolean; people?: PersonBreaks[] } | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: ShiftPatch) => patchShift(shift.id, body, { flags, idempotencyKey: newIdempotencyKey() }),
    onSuccess: () => {
      toast({ variant: "success", title: "Shift saved", description: shiftPlace({ ...shift, startTime: form.time.start, endTime: form.time.end }) });
      setNeedsReason(false);
      setReason("");
      setError(null);
      void qc.invalidateQueries({ queryKey: boardKey }).then(() => {
        const fresh = qc.getQueryData<Board>(boardKey)?.shifts.find((s) => s.id === shift.id);
        if (fresh) {
          setBaseVersion(fresh.version);
          setForm(initialForm(fresh));
        }
      });
      void qc.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (raw) => {
      const e = raw instanceof ApiError ? raw : new ApiError(0, "unknown", "Something went wrong. Try again.");
      if (e.code === "stale_version") {
        setError({ message: "Someone changed this shift. Reload to see their changes.", stale: true });
      } else if (e.code === "needs_override" || e.code === "rule_blocked") {
        if (e.code === "needs_override") setNeedsReason(true);
        const people = ((e.details?.people as PersonBreaks[] | undefined) ?? []).filter((p) => p.breaks.length > 0);
        setError({ message: e.message, people });
      } else {
        setError({ message: e.message });
      }
    },
  });

  function reload() {
    const fresh = qc.getQueryData<Board>(boardKey)?.shifts.find((s) => s.id === shift.id) ?? shift;
    void qc.invalidateQueries({ queryKey: boardKey }).then(() => {
      const latest = qc.getQueryData<Board>(boardKey)?.shifts.find((s) => s.id === shift.id) ?? fresh;
      setForm(initialForm(latest));
      setBaseVersion(latest.version);
      setError(null);
      setNeedsReason(false);
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const slots = Number(form.slots);
    if (!Number.isInteger(slots) || slots < 1 || slots > 50) {
      setSlotsError("Enter a whole number from 1 to 50.");
      return;
    }
    if (form.time.start && form.time.start === form.time.end) return;
    const changes = changesFrom(shift, form);
    if (Object.keys(changes).length === 0) {
      setError({ message: "Nothing has changed yet." });
      return;
    }
    if (needsReason && reason.trim().length < 3) {
      setError({ message: "Give a short reason for the override." });
      return;
    }
    save.mutate({ version: baseVersion, ...changes, overrideReason: needsReason ? reason.trim() : undefined });
  }

  const sameTimes = Boolean(form.time.start) && form.time.start === form.time.end;

  return (
    <DrawerSection title="Edit shift">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Role">
          <Select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: Number(e.target.value) })}>
            {board.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {capitalise(r.name)}
              </option>
            ))}
          </Select>
        </Field>
        <TimeRangeField
          value={form.time}
          onChange={(time) => setForm({ ...form, time })}
          error={sameTimes ? "A shift can't start and end at the same time." : undefined}
        />
        <Field label="Places" hint="How many people this shift needs." error={slotsError ?? undefined}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            className="tabular"
            value={form.slots}
            onChange={(e) => {
              setForm({ ...form, slots: e.target.value });
              setSlotsError(null);
            }}
          />
        </Field>
        <Field label="Notes">
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Radio channel, meeting point" />
        </Field>
        {needsReason ? (
          <Field label="Reason for the override" hint="Saved in the shift's activity." required>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        ) : null}
        {error ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-14 font-medium text-conflict">
            <span className="min-w-0 flex-1">{error.message}</span>
            {error.people?.length ? (
              <ul className="w-full flex-none font-normal text-ink">
                {error.people.flatMap((p) =>
                  p.breaks.map((b, i) => (
                    <li key={`${p.staffId}-${b.code}-${i}`} className="mt-1">
                      {b.message}
                    </li>
                  )),
                )}
              </ul>
            ) : null}
            {error.stale ? (
              <Button size="sm" variant="secondary" onClick={reload}>
                Reload
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={save.isPending}>
            {needsReason ? "Save anyway" : "Save changes"}
          </Button>
        </div>
      </form>
    </DrawerSection>
  );
}

// ---------------------------------------------------------------- activity

const fieldNames: Record<string, string> = { startsAt: "times", endsAt: "times", roleId: "role", slots: "places", notes: "notes" };

function describe(item: Activity): string {
  const p = item.payload as { staffName?: string; overrideReason?: string | null; changes?: Record<string, unknown> };
  const who = p.staffName ?? "someone";
  switch (item.action) {
    case "assignment.created":
      return p.overrideReason ? `Assigned ${who}, with the reason "${p.overrideReason}"` : `Assigned ${who}`;
    case "assignment.removed":
      return `Removed ${who}`;
    case "shift.updated": {
      const fields = [...new Set(Object.keys(p.changes ?? {}).map((k) => fieldNames[k] ?? k))];
      return fields.length ? `Changed the ${fields.join(" and ")}` : "Edited the shift";
    }
    case "shift_request.created":
      return `${who} asked for this shift`;
    case "shift_request.approved":
      return "Approved a request";
    default:
      return item.action;
  }
}

function actorName(actor: string) {
  return actor === "manager" ? "Manager" : "Shift worker";
}

function when(iso: string, timezone: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ActivityList({ shiftId, timezone }: { shiftId: number; timezone: string }) {
  const activity = useActivity(shiftId, true);
  return (
    <DrawerSection title="Activity">
      {activity.isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-44" />
        </div>
      ) : activity.isError ? (
        <ErrorState title="Couldn't load the activity" onRetry={() => void activity.refetch()} retrying={activity.isFetching} />
      ) : activity.data.items.length === 0 ? (
        <p className="text-14 text-muted">Nothing has happened on this shift yet.</p>
      ) : (
        <ol className="flex flex-col">
          {activity.data.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-0.5 border-b border-hairline py-2.5 last:border-b-0">
              <span className="text-14 text-ink">{describe(item)}</span>
              <span className="text-12 text-muted tabular">
                {actorName(item.actor)}, <time dateTime={item.createdAt}>{when(item.createdAt, timezone)}</time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </DrawerSection>
  );
}
