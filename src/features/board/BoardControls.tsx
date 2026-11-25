"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ApiError, postSession } from "./api";
import { demoStates, useDemoState } from "./demo-state";

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
  "flex cursor-default flex-col gap-0.5 rounded-2 py-2 pr-3 pl-8 text-left outline-hidden select-none",
  "data-[highlighted]:bg-hover",
);

/** Every state from the spec, reachable in one place. */
export function DemoStatesMenu() {
  const { state, setState } = useDemoState();
  const current = demoStates.find((d) => d.value === state);
  return (
    <Menu.Root>
      <Menu.Trigger className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5")}>
        <span className="hidden md:inline">Demo states</span>
        <span className="md:hidden">Demo</span>
        {state !== "normal" ? <span className="hidden font-normal text-muted md:inline">, {current?.label}</span> : null}
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
              <Menu.RadioItem key={d.value} value={d.value} className={cn(itemClass, "relative")}>
                <Menu.ItemIndicator className="absolute top-2.5 left-3 size-2 rounded-full bg-ink" />
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
