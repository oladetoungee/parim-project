import type { Metadata } from "next";
import { StoryPage } from "@/features/story/StoryPage";

export const metadata: Metadata = {
  title: "ParimShift, by Gbemisola Oladetoun",
  description: "A race day staffing board built for Parim, told in one scroll.",
};

export default function StoryRoute() {
  return <StoryPage />;
}
