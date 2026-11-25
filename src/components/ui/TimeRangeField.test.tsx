import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeRangeField } from "./TimeRangeField";
import { durationMinutes, endsNextDay } from "./time";

// The vitest config does not enable globals, so Testing Library cannot clean up on its own.
afterEach(cleanup);

describe("endsNextDay", () => {
  it("is true only when the end is earlier than the start", () => {
    expect(endsNextDay("22:00", "02:00")).toBe(true);
    expect(endsNextDay("10:00", "16:00")).toBe(false);
    expect(endsNextDay("10:00", "10:00")).toBe(false);
    expect(endsNextDay("", "02:00")).toBe(false);
  });

  it("counts the length across midnight", () => {
    expect(durationMinutes("22:00", "02:00")).toBe(240);
  });
});

describe("TimeRangeField", () => {
  it("says 'Ends next day' when the end is before the start", () => {
    render(<TimeRangeField defaultValue={{ start: "22:00", end: "02:00" }} />);
    expect(screen.getByText(/Ends next day/)).toBeInTheDocument();
    expect(screen.getByText(/4 h/)).toBeInTheDocument();
  });

  it("does not say it for a same-day range", () => {
    render(<TimeRangeField defaultValue={{ start: "10:00", end: "16:00" }} />);
    expect(screen.queryByText(/Ends next day/)).not.toBeInTheDocument();
    expect(screen.getByText("6 h")).toBeInTheDocument();
  });

  it("updates as the end time changes and reports the value", () => {
    const onChange = vi.fn();
    render(<TimeRangeField defaultValue={{ start: "18:00", end: "23:00" }} onChange={onChange} />);
    expect(screen.queryByText(/Ends next day/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ends"), { target: { value: "01:00" } });
    expect(onChange).toHaveBeenCalledWith({ start: "18:00", end: "01:00" });
    expect(screen.getByText(/Ends next day/)).toBeInTheDocument();
  });

  it("links both inputs to the note so screen readers hear it", () => {
    render(<TimeRangeField defaultValue={{ start: "22:00", end: "02:00" }} />);
    expect(screen.getByLabelText("Ends")).toHaveAccessibleDescription(expect.stringContaining("Ends next day"));
  });
});
