import { cn } from "@/lib/cn";

export type AvatarPerson = {
  id: string;
  /** Leave out when the viewer may not see who it is (worker view). */
  name?: string;
};

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const circle =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-paper text-12 font-medium text-muted ring-2 ring-canvas select-none";

/* Figma: Avatar. 28px circle, 12px Medium initials, bg/paper, 2px canvas ring. Property: hidden. */
export function Avatar({ name, className, decorative = false }: { name?: string; className?: string; decorative?: boolean }) {
  // Decorative when the name is printed next to it (a staff row).
  if (decorative) {
    return (
      <span aria-hidden="true" className={cn(circle, className)}>
        {name ? initials(name) : ""}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={name ?? "Assigned"}
      className={cn(circle, className)}
      data-hidden={name ? undefined : true}
    >
      <span aria-hidden="true">{name ? initials(name) : ""}</span>
    </span>
  );
}

type AvatarStackProps = {
  people: readonly AvatarPerson[];
  /** Avatars shown before the "+N" overflow. */
  max?: number;
  className?: string;
};

/* Figma: Avatar stack. Overlap 2px, so initials are never cut. "+N" after 3. */
export function AvatarStack({ people, max = 3, className }: AvatarStackProps) {
  if (people.length === 0) return null;

  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const names = people.map((p) => p.name).filter(Boolean);
  const label =
    names.length === people.length ? names.join(", ") : `${people.length} assigned`;

  return (
    <span role="img" aria-label={label} className={cn("inline-flex items-center", className)}>
      <span aria-hidden="true" className="inline-flex items-center -space-x-0.5">
        {shown.map((p) => (
          <span key={p.id} className={circle}>
            {p.name ? initials(p.name) : ""}
          </span>
        ))}
        {overflow > 0 ? <span className={cn(circle, "bg-canvas text-ink tabular")}>+{overflow}</span> : null}
      </span>
    </span>
  );
}
