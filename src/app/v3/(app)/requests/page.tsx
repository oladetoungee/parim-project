import type { Metadata } from "next";
import { RequestsScreen } from "@/features/v2/RequestsScreen";

export const metadata: Metadata = {
  title: "Requests, ParimShift",
  description: "Shift requests from workers, waiting for a manager to approve them.",
};

export default function RequestsPage() {
  return <RequestsScreen />;
}
