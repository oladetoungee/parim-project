// Drag and drop wiring for dnd-kit: how a drop target is chosen, how the
// keyboard moves between shifts, and what a screen reader hears.

import {
  closestCenter,
  pointerWithin,
  type Announcements,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { blocks, warnings, type RuleBreak } from "@/lib/rules";
import type { BoardShift } from "@/server/db/queries";
import { shiftPlace } from "./board-math";

export const shiftDropId = (id: number) => `shift-${id}`;
export const staffDragId = (id: number) => `staff-${id}`;
export const idFrom = (id: UniqueIdentifier) => Number(String(id).split("-")[1]);

/** The mouse picks the card under the pointer. The keyboard has no pointer, so it takes the nearest centre. */
export const boardCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

const NEXT = ["ArrowRight", "ArrowDown"];
const PREVIOUS = ["ArrowLeft", "ArrowUp"];

/**
 * Arrow keys jump from shift to shift in reading order (location by location,
 * then by start time) instead of nudging 25px at a time. `order` is read on
 * every key press so filters apply straight away.
 */
export function shiftKeyboardCoordinates(order: () => readonly number[]): KeyboardCoordinateGetter {
  return (event, { context }) => {
    const forward = NEXT.includes(event.code);
    if (!forward && !PREVIOUS.includes(event.code)) return undefined;
    event.preventDefault();

    const ids = order();
    const { over, collisionRect, droppableRects } = context;
    if (ids.length === 0 || !collisionRect) return undefined;

    const current = over ? ids.indexOf(idFrom(over.id)) : -1;
    const nextIndex = current === -1 ? (forward ? 0 : ids.length - 1) : Math.min(ids.length - 1, Math.max(0, current + (forward ? 1 : -1)));
    const rect = droppableRects.get(shiftDropId(ids[nextIndex]));
    if (!rect) return undefined;
    return {
      x: rect.left + rect.width / 2 - collisionRect.width / 2,
      y: rect.top + rect.height / 2 - collisionRect.height / 2,
    };
  };
}

export type DropCheck = { valid: boolean; breaks: RuleBreak[]; reason?: string };

/** "Can't assign: Ana Tamm is already on Bar 2, 12:00 to 18:00." */
export function judge(breaks: RuleBreak[]): DropCheck {
  const blocking = blocks(breaks);
  if (blocking.length > 0) return { valid: false, breaks, reason: `Can't assign: ${blocking[0].message}` };
  return { valid: true, breaks };
}

type Lookup = {
  person: (id: UniqueIdentifier) => { name: string; roleName: string } | undefined;
  shift: (id: UniqueIdentifier) => BoardShift | undefined;
  check: (staffId: number, shiftId: number) => DropCheck | undefined;
};

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "To assign this person, press Space to pick them up. Use the arrow keys to move between shifts, Space to assign them to the shift you are over, or Escape to cancel.",
};

/** Plain English for each step of a keyboard or mouse drag. */
export function boardAnnouncements({ person, shift, check }: Lookup): Announcements {
  const who = (id: UniqueIdentifier) => {
    const p = person(id);
    return p ? `${p.name}, ${p.roleName}` : "This person";
  };
  const describeOver = (activeId: UniqueIdentifier, overId: UniqueIdentifier) => {
    const s = shift(overId);
    if (!s) return `${who(activeId)}. Not over a shift.`;
    const place = `${who(activeId)}. Over ${shiftPlace(s)}, ${s.filled} of ${s.slots} filled.`;
    const result = check(idFrom(activeId), s.id);
    if (result && !result.valid) return `${place} ${result.reason}`;
    const warning = result ? warnings(result.breaks)[0] : undefined;
    if (warning) return `${place} ${warning.message} Press Space to assign with a reason.`;
    return `${place} Press Space to assign.`;
  };

  return {
    onDragStart: ({ active }) =>
      `Picked up ${who(active.id)}. Use the arrow keys to move between shifts, Space to assign, Escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? describeOver(active.id, over.id) : `${who(active.id)}. Not over a shift.`),
    onDragEnd: ({ active, over }) => {
      const name = person(active.id)?.name ?? "This person";
      const s = over ? shift(over.id) : undefined;
      if (!s) return `${name} was not assigned.`;
      const result = check(idFrom(active.id), s.id);
      if (result && !result.valid) return `${name} was not assigned. ${result.reason}`;
      return `Assigning ${name} to ${shiftPlace(s)}.`;
    },
    onDragCancel: ({ active }) => `Cancelled. ${person(active.id)?.name ?? "This person"} was not assigned.`,
  };
}
