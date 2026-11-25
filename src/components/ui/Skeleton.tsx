import { cn } from "@/lib/cn";

/* A flat block in bg/paper with a slow opacity pulse. Reduced motion holds it still. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("motion-skeleton block rounded-2 bg-paper", className)} />;
}
