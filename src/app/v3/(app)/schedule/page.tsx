import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduleScreen } from "@/features/v2/ScheduleScreen";

export const metadata: Metadata = {
  title: "Schedule, ParimShift",
  description: "Staff the Autumn race day: see what is uncovered by hour and assign people to shifts.",
};

export default function SchedulePage() {
  // The screen reads ?shift= from the URL, which needs a Suspense boundary for a static page.
  return (
    <Suspense>
      <ScheduleScreen />
    </Suspense>
  );
}
