import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ShiftCard, type ShiftStatus } from "./ShiftCard";

// The vitest config does not enable globals, so Testing Library cannot clean up on its own.
afterEach(cleanup);

const base = { role: "Steward", start: "10:00", end: "16:00", needed: 4 } as const;

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
    const card = screen.getByRole("button", { name: /Steward, Gate A, 10:00 to 16:00, 2 of 4 filled/ });
    expect(card).toHaveTextContent("2 of 4");
    expect(screen.getByText("10:00–16:00")).toHaveClass("tabular");
  });

  it("says when a shift ends the next day", () => {
    render(<ShiftCard {...base} start="22:00" end="02:00" status="open" filled={0} />);
    expect(screen.getByRole("button")).toHaveAccessibleName(expect.stringContaining("ends next day"));
  });

  it("shows the reason on an invalid drop target", () => {
    const reason = "Can't assign: Ana Tamm is on Bar 2, 12:00 to 18:00";
    render(<ShiftCard {...base} status="partly-filled" filled={2} drop="invalid" dropReason={reason} />);
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-state", "drop-invalid");
    expect(card).toHaveAccessibleDescription(reason);
  });

  it("marks selected and valid drop states", () => {
    const { rerender } = render(<ShiftCard {...base} status="open" filled={0} selected />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "selected");
    rerender(<ShiftCard {...base} status="open" filled={0} drop="valid" />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "drop-valid");
  });
});
