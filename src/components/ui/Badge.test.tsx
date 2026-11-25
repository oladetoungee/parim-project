import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge, type BadgeStatus } from "./Badge";
import { CoverageStrip } from "./CoverageStrip";

// The vitest config does not enable globals, so Testing Library cannot clean up on its own.
afterEach(cleanup);

describe("Badge", () => {
  it.each<[BadgeStatus, string]>([
    ["covered", "Covered"],
    ["short", "Short"],
    ["conflict", "Conflict"],
    ["open", "Open"],
    ["draft", "Draft"],
  ])("%s carries the word %s", (status, word) => {
    render(<Badge status={status} />);
    expect(screen.getByText(word)).toBeInTheDocument();
  });
});

describe("CoverageStrip", () => {
  it("labels each hour with assigned, needed and shortfall", () => {
    render(
      <CoverageStrip
        hours={[
          { hour: 13, needed: 10, assigned: 10 },
          { hour: 14, needed: 14, assigned: 9 },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "14:00 to 15:00, 9 of 14 staff, 5 short." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "13:00 to 14:00, 10 of 10 staff, covered." })).toBeInTheDocument();
  });
});
