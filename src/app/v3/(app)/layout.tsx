import { SidebarShell } from "@/features/v3/SidebarShell";

/** The product with a sidebar. The story at /v3 sits outside this group, so it has no app chrome. */
export default function V3AppLayout({ children }: { children: React.ReactNode }) {
  return <SidebarShell>{children}</SidebarShell>;
}
