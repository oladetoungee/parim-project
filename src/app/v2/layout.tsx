import { AppShell } from "@/features/v2/AppShell";

/** A second layout for the same data, so it can be compared with /board side by side. */
export default function V2Layout({ children }: LayoutProps<"/v2">) {
  return <AppShell>{children}</AppShell>;
}
