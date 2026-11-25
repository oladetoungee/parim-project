import Link from "next/link";
import { TopBar } from "@/features/shell/TopBar";
import { BoardSummary } from "@/features/landing/BoardSummary";

const others = [
  { href: "/system", title: "System", text: "Every component and token, in every state." },
  { href: "/decisions", title: "Decisions", text: "What I chose, what I left out, and why." },
];

const linkClass =
  "group flex h-full flex-col gap-2 py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const titleClass = "font-display text-24 leading-8 font-bold tracking-[-0.02em] text-ink group-hover:text-accent";

/*
 * An 8 column grid. The board is the work, so it takes half the row with a
 * line from the live API; System and Decisions take two columns each.
 */
export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper">
      <TopBar className="bg-paper" />
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-16 pb-12 md:px-8 md:pt-24 md:pb-16">
        <h1 className="max-w-4xl font-display text-48 leading-[3.125rem] tracking-[-0.03em] text-ink md:text-72 md:leading-[4.5rem]">
          <span className="font-bold">I built this</span>{" "}
          <span className="font-light">
            for the Senior <span className="whitespace-nowrap">Full-Stack</span> Engineer role at Parim.
          </span>
        </h1>
        <ul className="mt-16 grid gap-x-8 border-t border-ink md:mt-24 md:grid-cols-8">
          <li className="border-b border-hairline md:col-span-4 md:border-b-0">
            <Link href="/board" className={linkClass}>
              <span className={titleClass}>Board</span>
              <span className="max-w-[44ch] text-14 text-muted">
                Staff a race day: 42 shifts across six locations, 120 people, and the rules a scheduler has to keep. Drag
                someone on, or do it all from the keyboard.
              </span>
              <span className="mt-2">
                <BoardSummary />
              </span>
            </Link>
          </li>
          {others.map((link) => (
            <li key={link.href} className="border-b border-hairline md:col-span-2 md:border-b-0">
              <Link href={link.href} className={linkClass}>
                <span className={titleClass}>{link.title}</span>
                <span className="text-14 text-muted">{link.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <footer className="mx-auto w-full max-w-[1120px] px-4 pb-8 text-14 text-muted md:px-8">
        An unofficial concept by Gbemisola Oladetoun for Parim
      </footer>
    </div>
  );
}
