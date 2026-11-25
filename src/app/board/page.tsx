import type { Metadata } from "next";
import { BoardApp } from "@/features/board/BoardApp";

export const metadata: Metadata = {
  title: "Board, ParimShift",
  description: "Staff the Autumn race day: see what is uncovered by hour and assign people to shifts.",
};

/**
 * The board fetches in the browser with TanStack Query, so this page is a
 * static shell. src/proxy.ts has already given the visitor a session cookie by
 * the time the client asks the API for data.
 */
export default function BoardPage() {
  return <BoardApp />;
}
