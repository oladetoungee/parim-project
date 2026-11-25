import { cn } from "@/lib/cn";

/* A flat block in bg/paper. Static: the board fades in over it when the data lands. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block rounded-2 bg-paper", className)} />;
}
