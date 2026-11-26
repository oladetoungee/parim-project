"use client";

import { useState, type ReactNode } from "react";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CoverageMeter } from "@/components/ui/CoverageMeter";
import { CoverageStrip, type HourCoverage } from "@/components/ui/CoverageStrip";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field, Input, Select } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, MoreIcon, PlusIcon } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ShiftCard, ShiftCardSkeleton } from "@/components/ui/ShiftCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { StaffRow } from "@/components/ui/StaffRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { TimeRangeField } from "@/components/ui/TimeRangeField";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { TopBar } from "@/features/shell/TopBar";

const people = [
  { id: "1", name: "Ana Tamm" },
  { id: "2", name: "Kofi Mensah" },
  { id: "3", name: "Mari Kask" },
  { id: "4", name: "Joel Price" },
  { id: "5", name: "Ines Duarte" },
];

const needed = [6, 10, 14, 18, 22, 24, 24, 24, 22, 20, 18, 16, 12, 10, 8, 4];
const assigned = [6, 10, 14, 18, 22, 24, 24, 14, 13, 20, 18, 16, 12, 10, 8, 4];
const hours: HourCoverage[] = needed.map((n, i) => ({ hour: 7 + i, needed: n, assigned: assigned[i] }));

export default function SystemPage() {
  return (
    <ToastProvider>
      <TopBar current="system" />
      <Gallery />
    </ToastProvider>
  );
}

function Gallery() {
  const [view, setView] = useState<"manager" | "worker">("manager");
  const [strip, setStrip] = useState(hours);
  const [shake, setShake] = useState(0);
  const { toast } = useToast();

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col px-4 py-12 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-32 leading-9 tracking-[-0.02em] text-ink">
            <span className="font-bold">Parim</span>
            <span className="font-light">Shift</span> <span className="font-light text-muted">components</span>
          </h1>
          <p className="max-w-xl text-14 text-muted">
            All the components in every state. Built from the tokens in tokens/tokens.json.
          </p>
        </div>
      </header>

      <Section title="Button" note="Primary, secondary, ghost. Sizes sm and md. Red is kept for conflicts, so there is no red button.">
        <Row>
          <Button variant="primary">Assign</Button>
          <Button variant="secondary">Remove</Button>
          <Button variant="ghost">Cancel</Button>
        </Row>
        <Row>
          <Button variant="primary" size="sm">Assign</Button>
          <Button variant="secondary" size="sm">Remove</Button>
          <Button variant="ghost" size="sm">Cancel</Button>
        </Row>
        <Row>
          <Button variant="primary" loading>Assign</Button>
          <Button variant="secondary" loading>Remove</Button>
          <Button variant="primary" disabled>Assign</Button>
          <Button variant="secondary" disabled>Remove</Button>
          <Button variant="ghost" disabled>Cancel</Button>
        </Row>
      </Section>

      <Section title="Icon button" note="Always named. The name shows as a tooltip on hover and focus.">
        <Row>
          <IconButton label="Previous day" icon={<ChevronLeftIcon />} variant="secondary" />
          <IconButton label="Next day" icon={<ChevronRightIcon />} variant="secondary" />
          <IconButton label="Add shift" icon={<PlusIcon />} />
          <IconButton label="More actions" icon={<MoreIcon />} />
          <IconButton label="Close" icon={<CloseIcon />} />
          <IconButton label="Add shift" icon={<PlusIcon />} disabled />
        </Row>
      </Section>

      <Section title="Field" note="Label, hint and error. Inputs and native selects.">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Slots" hint="How many people this shift needs.">
            <Input type="number" defaultValue={4} min={1} className="tabular" />
          </Field>
          <Field label="Slots" error="Enter at least 1 slot.">
            <Input type="number" defaultValue={0} className="tabular" />
          </Field>
          <Field label="Notes" hint="For example the radio channel or meeting point">
            <Input />
          </Field>
          <Field label="Role">
            <Select defaultValue="steward">
              <option value="steward">Steward</option>
              <option value="bar">Bar staff</option>
              <option value="security">Security</option>
            </Select>
          </Field>
          <Field label="Location" hint="Can't change once staff are assigned.">
            <Select defaultValue="gate-a" disabled>
              <option value="gate-a">Gate A</option>
            </Select>
          </Field>
          <Field label="Notes">
            <Input disabled defaultValue="Locked" />
          </Field>
        </div>
      </Section>

      <Section title="Time range" note="An end before the start means the shift ends the next day.">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <TimeRangeField defaultValue={{ start: "10:00", end: "16:00" }} />
          <TimeRangeField defaultValue={{ start: "22:00", end: "02:00" }} />
          <TimeRangeField defaultValue={{ start: "10:00", end: "10:00" }} error="Start and end can't be the same." />
        </div>
      </Section>

      <Section title="Segmented control" note="Arrow keys move between options. The indicator slides.">
        <Row>
          <SegmentedControl
            aria-label="View as"
            options={[
              { value: "manager", label: "Manager" },
              { value: "worker", label: "Worker" },
            ]}
            value={view}
            onValueChange={setView}
          />
          <SegmentedControl
            aria-label="Day"
            size="sm"
            options={[
              { value: "fri", label: "Fri" },
              { value: "sat", label: "Sat" },
              { value: "sun", label: "Sun" },
            ]}
          />
        </Row>
      </Section>

      <Section title="Badge" note="An 8px dot and the status word.">
        <Row>
          <Badge status="covered" />
          <Badge status="short" />
          <Badge status="conflict" />
          <Badge status="open" />
          <Badge status="draft" />
        </Row>
      </Section>

      <Section title="Avatar" note="28px. Stacks overlap by 2px and show +N after three. Names are hidden in the worker view. On a shift card faces are 24px with 10px initials.">
        <Row>
          <Avatar name="Ana Tamm" />
          <Avatar />
          <AvatarStack people={people.slice(0, 2)} />
          <AvatarStack people={people} />
          <AvatarStack people={[{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]} />
        </Row>
      </Section>

      <Section title="Shift card" note="All the places on a shift are seats: a face when filled, a dashed circle when open. The bottom edge repeats that, amber where a place is open. A conflict turns the border red and rings the person who clashes, and a draft has a dashed border. Narrow cards drop the status word and stack the role, count and time.">
        <Row>
          <ShiftCard role="Steward" location="Gate A" start="10:00" end="16:00" filled={0} needed={4} status="open" />
          <ShiftCard role="Steward" location="Gate A" start="10:00" end="16:00" filled={2} needed={4} status="partly-filled" people={people.slice(0, 2)} />
          <ShiftCard role="Bar staff" location="Bar 1" start="12:00" end="20:00" filled={5} needed={5} status="filled" people={people} />
          <ShiftCard role="Security" location="Car park" start="18:00" end="02:00" filled={2} needed={3} status="conflict" people={people.slice(2, 4)} clashStaffIds={["4"]} />
          <ShiftCard role="Steward" location="Gate B" start="07:00" end="12:00" filled={0} needed={2} status="draft" />
        </Row>
        <Row>
          <ShiftCard role="Steward" location="Gate A" start="10:00" end="16:00" filled={2} needed={4} status="partly-filled" people={people.slice(0, 2)} selected />
          <ShiftCard role="Steward" location="Gate A" start="10:00" end="16:00" filled={2} needed={4} status="partly-filled" people={people.slice(0, 2)} drop="valid" />
          <ShiftCard
            role="Steward"
            location="Bar 2"
            start="12:00"
            end="18:00"
            filled={2}
            needed={4}
            status="partly-filled"
            people={people.slice(0, 2)}
            drop="invalid"
            dropReason="Can't assign: Ana Tamm is on Bar 2, 12:00 to 18:00"
          />
          <ShiftCard
            key={shake}
            role="Security"
            location="Car park"
            start="18:00"
            end="02:00"
            filled={2}
            needed={3}
            status="conflict"
            people={people.slice(2, 4)}
            shake={shake > 0}
            onClick={() => setShake((n) => n + 1)}
          />
          <ShiftCardSkeleton />
        </Row>
        <Row>
          <ShiftCard role="Bar staff" location="Bar 2" start="11:00" end="23:00" filled={3} needed={8} status="partly-filled" people={people.slice(0, 3)} />
          <ShiftCard role="Steward" location="Gate A" start="10:00" end="16:00" filled={2} needed={6} status="partly-filled" people={people.slice(0, 2)} className="w-44" />
          <ShiftCard role="Steward" location="Gate A" start="14:00" end="16:00" filled={1} needed={3} status="partly-filled" people={people.slice(2, 3)} className="w-[108px]" />
          <ShiftCard role="Bar staff" location="Bar 1" start="14:00" end="16:00" filled={2} needed={5} status="partly-filled" people={people.slice(0, 2)} className="w-[108px]" />
          <ShiftCard role="Security" location="Car park" start="14:00" end="16:00" filled={0} needed={2} status="open" className="w-[108px]" />
        </Row>
        <p className="text-12 text-muted">Click the fourth card in the second row to play the conflict shake.</p>
      </Section>

      <Section title="Coverage strip" note="Hover or focus an hour. Arrow keys move between hours.">
        <CoverageStrip hours={strip} />
        <Row>
          <Button
            size="sm"
            onClick={() => setStrip((list) => list.map((h) => (h.hour === 14 || h.hour === 15 ? { ...h, assigned: h.needed } : h)))}
          >
            Fill 14:00 to 16:00
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStrip(hours)}>
            Reset
          </Button>
        </Row>
      </Section>

      <Section title="Coverage meter">
        <div className="grid gap-8 sm:grid-cols-3">
          <CoverageMeter covered={38} total={42} />
          <CoverageMeter covered={42} total={42} />
          <CoverageMeter covered={0} total={0} />
        </div>
      </Section>

      <Section title="Staff row" note="Rows with hairlines. Picked up is the only lifted state.">
        <div className="flex max-w-sm flex-col">
          <StaffRow name="Ana Tamm" role="Steward" hoursThisWeek={24} />
          <StaffRow name="Kofi Mensah" role="Security" licence={{ status: "valid" }} hoursThisWeek={36} />
          <StaffRow name="Mari Kask" role="Security" licence={{ status: "expiring", daysLeft: 9 }} hoursThisWeek={40} />
          <StaffRow name="Joel Price" role="Security" licence={{ status: "expired" }} hoursThisWeek={12} />
          <StaffRow name="Ines Duarte" role="Bar staff" hoursThisWeek={52} />
          <StaffRow name="Tom Varga" role="Steward" hoursThisWeek={8} state="disabled" />
        </div>
        <div className="max-w-sm pt-4">
          <StaffRow name="Ana Tamm" role="Steward" hoursThisWeek={24} state="picked-up" />
        </div>
      </Section>

      <Section title="Toast" note="Undo runs a 5 second bar that pauses on hover and focus.">
        <Row>
          <Button
            onClick={() =>
              toast({
                variant: "undo",
                title: "Ana Tamm assigned to Gate A",
                onAction: () => toast({ variant: "success", title: "Assignment undone" }),
              })
            }
          >
            Undo toast
          </Button>
          <Button onClick={() => toast({ variant: "success", title: "Shift saved" })}>Success toast</Button>
          <Button
            onClick={() =>
              toast({
                variant: "error",
                title: "Couldn't assign Ana Tamm",
                description: "The change was rolled back.",
                onAction: () => undefined,
              })
            }
          >
            Error toast
          </Button>
        </Row>
      </Section>

      <Section title="Skeleton">
        <div className="flex max-w-sm flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState
          title="No shifts yet"
          description="Create the first shift for this event, or copy the shifts from the last one."
          actions={
            <>
              <Button variant="primary">Create first shift</Button>
              <Button>Copy from last event</Button>
            </>
          }
          className="py-0"
        />
        <EmptyState
          title="No short shifts at Gate A"
          actions={<Button size="sm">Clear filters</Button>}
          className="py-0"
        />
      </Section>

      <Section title="Error state">
        <ErrorState
          title="Couldn't load shifts"
          description="Check your connection. Shifts already on screen are still current."
          onRetry={() => undefined}
        />
      </Section>

      <Section title="Drawer" note="Traps focus, closes on Esc and returns focus to the trigger.">
        <Drawer>
          <DrawerTrigger asChild>
            <Button>Open shift drawer</Button>
          </DrawerTrigger>
          <DrawerContent
            title="Steward, Gate A"
            description="Sat 14 June, 10:00 to 16:00"
            footer={
              <>
                <Button variant="ghost">Cancel</Button>
                <Button variant="primary">Save</Button>
              </>
            }
          >
            <div className="flex flex-col gap-6">
              <TimeRangeField defaultValue={{ start: "10:00", end: "16:00" }} />
              <Field label="Slots">
                <Input type="number" defaultValue={4} className="tabular" />
              </Field>
              <Field label="Notes" hint="For example the radio channel or meeting point">
                <Input />
              </Field>
            </div>
          </DrawerContent>
        </Drawer>
      </Section>

      <Section title="Tabs" note="The underline slides. Arrow keys move between tabs.">
        <Tabs defaultValue="details">
          <TabsList aria-label="Shift">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="people">Assigned people</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="disabled" disabled>
              Requests
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="text-14 text-muted">
            Role, time, slots and notes.
          </TabsContent>
          <TabsContent value="people" className="text-14 text-muted">
            Two of four assigned.
          </TabsContent>
          <TabsContent value="activity" className="text-14 text-muted">
            Changes from the audit log.
          </TabsContent>
        </Tabs>
      </Section>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t border-hairline py-10">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-20 leading-7 font-bold tracking-[-0.01em] text-ink">{title}</h2>
        {note ? <p className="text-14 text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-4">{children}</div>;
}
