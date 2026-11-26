import type { Metadata } from "next";
import { PeopleScreen } from "@/features/v2/PeopleScreen";

export const metadata: Metadata = {
  title: "People, ParimShift",
  description: "Everyone on the event: role, SIA licence, hours this week and shifts on the day.",
};

export default function PeoplePage() {
  return <PeopleScreen />;
}
