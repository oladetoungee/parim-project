import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge needs to know the custom theme, or it would treat
 * `text-14` and `text-muted` as the same group and drop one of them.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "canvas",
        "surface",
        "paper",
        "raised",
        "hover",
        "pressed",
        "scrim",
        "hairline",
        "strong",
        "ink",
        "muted",
        "subtle",
        "accent",
        "accent-hover",
        "accent-on",
        "accent-tint",
        "covered",
        "covered-tint",
        "short",
        "short-tint",
        "conflict",
        "conflict-tint",
        "open",
        "draft",
        "assigned",
        "need-outline",
        "ring",
      ],
      text: ["12", "14", "16", "20", "24", "32", "48", "72"],
      radius: ["2", "4", "8"],
      shadow: ["lifted"],
      ease: ["standard", "enter", "exit", "spring"],
      font: ["sans", "display"],
    },
    classGroups: {
      duration: [{ duration: ["instant", "quick", "base", "slow"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
