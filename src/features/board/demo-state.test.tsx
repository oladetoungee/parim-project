import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { DemoStateNote, DemoStatesMenu } from "./BoardControls";
import { DemoStateProvider } from "./demo-state";
import { useBoard } from "./queries";

// The board's error banner and demo note, wired to the real query and menu.
// fetch is faked: ?fail=1 answers with the API's demo 503, anything else with a board.
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("fail=1")) {
    return Response.json(
      { error: { code: "demo_failure", message: "Simulated failure from the demo flags. Nothing was saved.", details: null } },
      { status: 503 },
    );
  }
  return Response.json({ shifts: [] });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const board = useBoard();
  return (
    <>
      <DemoStatesMenu />
      <DemoStateNote />
      {board.isError ? <p role="alert">Couldn&apos;t refresh the board</p> : null}
      {board.data ? <p>Board loaded</p> : null}
    </>
  );
}

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DemoStateProvider>
          <Harness />
        </DemoStateProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function pick(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: /^Demo states/ }));
  await user.click(await screen.findByRole("menuitemradio", { name: new RegExp(`^${label}`) }));
}

it("Error loading shows the banner with the data kept, and Normal takes it away", async () => {
  const user = userEvent.setup();
  renderBoard();
  await screen.findByText("Board loaded");

  await pick(user, "Error loading");
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't refresh the board");
  expect(screen.getByText("Board loaded")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith("/api/events/1/board?fail=1", expect.anything());

  await pick(user, "Normal");
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(fetchMock).toHaveBeenLastCalledWith("/api/events/1/board", expect.anything());
  expect(screen.getByRole("button", { name: "Demo states" })).toBeInTheDocument();
});

it("the menu checks the active state", async () => {
  const user = userEvent.setup();
  renderBoard();
  await pick(user, "Save fails");
  await user.click(screen.getByRole("button", { name: /^Demo states/ }));
  expect(await screen.findByRole("menuitemradio", { name: /^Save fails/ })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("menuitemradio", { name: /^Normal/ })).toHaveAttribute("aria-checked", "false");
});

it("Slow network and Save fails each show their note until you go back to normal", async () => {
  const user = userEvent.setup();
  renderBoard();
  await screen.findByText("Board loaded");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();

  await pick(user, "Slow network");
  expect(screen.getByRole("status")).toHaveTextContent("Slow network: saves take 2 seconds.");
  expect(screen.getByRole("button", { name: "Demo states, Slow network on" })).toBeInTheDocument();

  await pick(user, "Save fails");
  expect(screen.getByRole("status")).toHaveTextContent("Saves will fail: try assigning someone to see the rollback.");

  await user.click(screen.getByRole("button", { name: "Back to normal" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
