import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShiftCard, type ShiftStatus } from "./ShiftCard";

// The vitest config does not enable globals, so Testing Library cannot clean up on its own.
afterEach(cleanup);

const base = { role: "Steward", start: "10:00", end: "16:00", needed: 4 } as const;

/** The face circle around a person's initials. */
const face = (initials: string) => screen.getByText(initials).closest(".ticket-seat");

const cases: { status: ShiftStatus; filled: number; label: string }[] = [
  { status: "open", filled: 0, label: "Open" },
  { status: "partly-filled", filled: 2, label: "Short" },
  { status: "filled", filled: 4, label: "Covered" },
  { status: "conflict", filled: 3, label: "Conflict" },
  { status: "draft", filled: 0, label: "Draft" },
];

describe("ShiftCard", () => {
  it.each(cases)("shows the word for $status, not only a colour", ({ status, filled, label }) => {
    render(<ShiftCard {...base} status={status} filled={filled} />);
    const card = screen.getByRole("button");
    expect(card).toHaveTextContent(label);
    expect(card).toHaveAccessibleName(expect.stringContaining(label));
  });

  it("shows role, time with tabular figures and filled out of needed", () => {
    render(<ShiftCard {...base} status="partly-filled" filled={2} location="Gate A" />);
    const card = screen.getByRole("button", {
      name: "Steward, Gate A, 10:00–16:00, 2 of 4 filled, 2 places open, Short",
    });
    expect(card).toHaveTextContent("2 of 4");
    expect(screen.getByText("10:00–16:00")).toHaveClass("tabular");
  });

  it("says when a shift ends the next day", () => {
    render(<ShiftCard {...base} start="22:00" end="02:00" status="open" filled={0} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(expect.stringContaining("22:00–02:00 next day"));
  });

  it("shows the reason on an invalid drop target", () => {
    const reason = "Can't assign: Ana Tamm is on Bar 2, 12:00 to 18:00";
    render(<ShiftCard {...base} status="partly-filled" filled={2} drop="invalid" dropReason={reason} />);
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-state", "drop-invalid");
    expect(card).toHaveAccessibleDescription(reason);
  });

  it("draws one place per slot: faces for filled, dashed circles for open", () => {
    const people = [
      { id: "a", name: "Ana Tamm" },
      { id: "b", name: "Kofi Mensah" },
    ];
    const { container } = render(<ShiftCard {...base} status="partly-filled" filled={2} people={people} />);
    expect(screen.getByText("AT")).toBeInTheDocument();
    expect(screen.getByText("KM")).toBeInTheDocument();
    expect(container.querySelectorAll(".border-dashed.rounded-full.size-6")).toHaveLength(2);
  });

  it("shows +N past five places, and +N past three for narrow cards", () => {
    render(<ShiftCard {...base} needed={8} status="open" filled={0} />);
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  it("rings the clashing person in conflict colour and names them", () => {
    const people = [
      { id: "a", name: "Ana Tamm" },
      { id: "b", name: "Kofi Mensah" },
    ];
    render(<ShiftCard {...base} status="conflict" filled={2} people={people} clashStaffIds={["b"]} />);
    expect(face("KM")).toHaveAttribute("data-clash", "true");
    expect(face("AT")).not.toHaveAttribute("data-clash");
    expect(screen.getByRole("button")).toHaveAccessibleName(expect.stringContaining("clash: Kofi Mensah"));
  });

  it("marks selected and valid drop states", () => {
    const { rerender } = render(<ShiftCard {...base} status="open" filled={0} selected />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "selected");
    rerender(<ShiftCard {...base} status="open" filled={0} drop="valid" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "drop-valid");
    expect(screen.getByRole("button")).toHaveAttribute("data-drop", "valid");
  });

  it("has no aria-label: the name is the visible text plus hidden words, so it always contains what is shown", () => {
    render(<ShiftCard {...base} status="partly-filled" filled={2} location="Gate A" />);
    const card = screen.getByRole("button");
    expect(card).not.toHaveAttribute("aria-label");
    expect(card).toHaveAccessibleName(expect.stringMatching(/^Steward, .*10:00–16:00, 2 of 4 filled/));
  });

  it("scales in a face that joins after the first render, and only that one", () => {
    const ana = { id: "a", name: "Ana Tamm" };
    const kofi = { id: "b", name: "Kofi Mensah" };
    const { rerender } = render(<ShiftCard {...base} status="partly-filled" filled={1} people={[ana]} />);
    expect(face("AT")).not.toHaveClass("motion-face-in");
    rerender(<ShiftCard {...base} status="partly-filled" filled={2} people={[ana, kofi]} />);
    expect(face("KM")).toHaveClass("motion-face-in");
    expect(face("AT")).not.toHaveClass("motion-face-in");
  });

  it("plays the exit on a face marked leaving", () => {
    render(<ShiftCard {...base} status="partly-filled" filled={1} people={[{ id: "a", name: "Ana Tamm", leaving: true }]} />);
    expect(face("AT")).toHaveClass("motion-face-out");
  });

  it("ticks the count and crossfades the badge only when they change", () => {
    const { container, rerender } = render(<ShiftCard {...base} status="partly-filled" filled={3} />);
    expect(container.querySelector(".motion-tick")).toBeNull();
    rerender(<ShiftCard {...base} status="filled" filled={4} />);
    expect(container.querySelector(".motion-tick")).toHaveTextContent("4");
    expect(container.querySelector(".motion-crossfade-in")).toHaveTextContent("Covered");
    expect(container.querySelector(".motion-crossfade-out")).toHaveTextContent("Short");
    expect(screen.getByRole("button")).toHaveAccessibleName(expect.stringMatching(/Covered$/));
  });
});
