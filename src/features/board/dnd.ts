// Drag and drop wiring for dnd-kit: how a drop target is chosen, how the
// keyboard moves between shifts, and what a screen reader hears.

import {
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

/** Shifts the dragged person can go on, in keyboard reading order. `row` is the location row's index. */
export type KeyboardTarget = { id: number; row: number };

/**
 * The mouse picks the card under the pointer. A keyboard drag has no
 * pointer: the target is whatever the arrow keys chose (`keyboardTarget`),
 * not the card nearest the floating row, so the overlay can sit below the
 * card it is over without taking another card by accident.
 */
export function boardCollision(keyboardTarget: () => number | null): CollisionDetection {
  return (args) => {
    if (args.pointerCoordinates) return pointerWithin(args);
    const id = keyboardTarget();
    return id === null ? [] : [{ id: shiftDropId(id) }];
  };
}

/** Sent once by the board right after a keyboard pick-up, to move onto the first valid shift. */
export const PICK_UP_CODE = "BoardPickUp";
/** The floating row sits this far below the card it is over, so the card stays readable. */
export const OVERLAY_GAP = 8;

/**
 * Arrow keys jump between the shifts this person can take, never onto one
 * they can't. Left and right: previous and next in reading order (location
 * by location, then as drawn). Up and down: the nearest valid shift, by
 * horizontal position, in the closest location row above or below that has
 * one. `targets` is read on every key press so filters apply straight away.
 */
export function shiftKeyboardCoordinates(
  targets: (staffId: number) => readonly KeyboardTarget[],
  current: { get: () => number | null; set: (id: number | null) => void },
): KeyboardCoordinateGetter {
  return (event, { active, context }) => {
    const code = event.code;
    const horizontal = code === "ArrowRight" || code === "ArrowLeft";
    const vertical = code === "ArrowDown" || code === "ArrowUp";
    if (!horizontal && !vertical && code !== PICK_UP_CODE) return undefined;
    event.preventDefault();

    const list = targets(idFrom(active));
    const { droppableRects, collisionRect } = context;
    if (list.length === 0 || !collisionRect) {
      current.set(null);
      return undefined;
    }

    const index = list.findIndex((t) => t.id === current.get());
    let next: KeyboardTarget | undefined;
    if (code === PICK_UP_CODE || index === -1) {
      next = list[0];
    } else if (horizontal) {
      next = list[Math.min(list.length - 1, Math.max(0, index + (code === "ArrowRight" ? 1 : -1)))];
    } else {
      const here = list[index];
      const down = code === "ArrowDown";
      const others = list.filter((t) => (down ? t.row > here.row : t.row < here.row));
      if (others.length === 0) {
        next = here;
      } else {
        const row = down ? Math.min(...others.map((t) => t.row)) : Math.max(...others.map((t) => t.row));
        const centre = (id: number) => {
          const r = droppableRects.get(shiftDropId(id));
          return r ? r.left + r.width / 2 : 0;
        };
        const x = centre(here.id);
        next = others
          .filter((t) => t.row === row)
          .reduce((best, t) => (Math.abs(centre(t.id) - x) < Math.abs(centre(best.id) - x) ? t : best));
      }
    }

    current.set(next.id);
    const rect = droppableRects.get(shiftDropId(next.id));
    if (!rect) return undefined;
    return { x: rect.left, y: rect.top + rect.height + OVERLAY_GAP };
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
  /** How many shifts on the board this person can go on. */
  validCount: (staffId: number) => number;
};

export const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    "To assign this person, press Space to pick them up. It moves to the first shift they can take. Left and right arrows move between those shifts, up and down change location. Space assigns, Escape cancels.",
};

/** Plain English for each step of a keyboard or mouse drag. */
export function boardAnnouncements({ person, shift, check, validCount }: Lookup): Announcements {
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
    onDragStart: ({ active }) => {
      const count = validCount(idFrom(active.id));
      if (count === 0) return `No shifts can take ${person(active.id)?.name ?? "this person"}. Press Esc to cancel.`;
      return `Picked up ${who(active.id)}. ${count === 1 ? "1 shift fits" : `${count} shifts fit`}. Left and right arrows move between them, up and down change location. Space assigns, Escape cancels.`;
    },
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
