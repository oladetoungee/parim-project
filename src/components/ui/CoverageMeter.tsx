import { cn } from "@/lib/cn";

type CoverageMeterProps = {
  covered: number;
  total: number;
  /** What is being counted. */
  noun?: string;
  className?: string;
};

/* "38 of 42 shifts covered", with a 4px bar underneath. The text carries the value. */
export function CoverageMeter({ covered, total, noun = "shifts", className }: CoverageMeterProps) {
  const ratio = total === 0 ? 0 : Math.min(1, covered / total);
  const complete = total > 0 && covered >= total;
  return (
    <div className={cn("flex min-w-48 flex-col gap-2", className)}>
      <p className="text-14 text-muted">
        <span className="font-semibold text-ink tabular">
          {covered} of {total}
        </span>{" "}
        {noun} covered
      </p>
      <span aria-hidden="true" className="relative block h-1 overflow-hidden rounded-full bg-hairline">
        <span
          className={cn(
            "absolute inset-0 origin-left transition-transform duration-base ease-standard motion-reduce:transition-none",
            complete ? "bg-covered" : "bg-ink",
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </span>
    </div>
  );
}
