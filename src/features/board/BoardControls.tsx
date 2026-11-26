"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ApiError, postSession } from "./api";
import { demoStates, useDemoState, type DemoState } from "./demo-state";

const roles = [
  { value: "manager", label: "Manager" },
  { value: "worker", label: "Worker" },
] as const;

type Role = (typeof roles)[number]["value"];

/**
 * The demo login. POST /api/session sets the signed cookie; the server reads
 * the role from it on every request, so switching refetches everything.
 */
export function RoleSwitch({ role, onSwitched }: { role: Role | undefined; onSwitched: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const switchRole = useMutation({
    mutationFn: postSession,
    onSuccess: async () => {
      onSwitched();
      qc.removeQueries({ queryKey: ["staff"] });
      qc.removeQueries({ queryKey: ["activity"] });
      await qc.invalidateQueries({ queryKey: ["board"] });
    },
    onError: (e) => {
      toast({ variant: "error", title: "Couldn't switch role", description: e instanceof ApiError ? e.message : undefined });
    },
  });
  const value = switchRole.isPending ? switchRole.variables : role;
  return (
    <SegmentedControl
      aria-label="View as"
      size="sm"
      options={roles}
      value={value ?? "manager"}
      disabled={role === undefined}
      onValueChange={(next) => {
        if (next !== value) switchRole.mutate(next);
      }}
    />
  );
}

const itemClass = cn(
  "relative flex cursor-default flex-col gap-0.5 rounded-2 py-2 pr-3 pl-8 text-left outline-hidden select-none",
  "data-[highlighted]:bg-hover",
);

/**
 * Every state from the spec, reachable in one place. Radix gives the items
 * role="menuitemradio" with aria-checked, arrow keys, Home and End,
 * typeahead, Enter or Space to pick, and Escape to close with focus back on
 * the trigger.
 */
export function DemoStatesMenu() {
  const { state, setState } = useDemoState();
  const current = demoStates.find((d) => d.value === state);
  const active = state !== "normal";
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={active ? `Demo states, ${current?.label} on` : "Demo states"}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5")}
      >
        {active ? <span aria-hidden className="size-1.5 rounded-full bg-ink" /> : null}
        <span className="hidden md:inline">Demo states</span>
        <span className="md:hidden">Demo</span>
        {active ? <span className="hidden font-normal text-muted md:inline">: {current?.label}</span> : null}
        <ChevronDownIcon className="text-muted" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="motion-popover z-50 w-72 rounded-8 border border-hairline bg-raised p-1 shadow-lifted"
        >
          <Menu.RadioGroup value={state} onValueChange={(v) => setState(v as typeof state)}>
            {demoStates.map((d) => (
              <Menu.RadioItem key={d.value} value={d.value} className={itemClass}>
                <Menu.ItemIndicator className="absolute top-2.5 left-2.5 text-ink">
                  <CheckIcon />
                </Menu.ItemIndicator>
                <span className="text-14 font-medium text-ink">{d.label}</span>
                <span className="text-12 text-muted">{d.hint}</span>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

const notes: Partial<Record<DemoState, string>> = {
  slow: "Slow network: saves take 2 seconds.",
  fail: "Saves will fail: try assigning someone to see the rollback.",
};

/**
 * A quiet line under the board header for the two states that otherwise look
 * like Normal until something is saved. The other states show themselves.
 */
export function DemoStateNote() {
  const { state, setState } = useDemoState();
  const note = notes[state];
  if (!note) return null;
  return (
    <div role="status" className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-14 text-muted">
      <span>{note}</span>
      <Button size="sm" variant="ghost" onClick={() => setState("normal")}>
        Back to normal
      </Button>
    </div>
  );
}
