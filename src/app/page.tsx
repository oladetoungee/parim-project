import Link from "next/link";
import { TopBar } from "@/features/shell/TopBar";

const links = [
  { href: "/board", title: "Board", text: "Staff a race day: 42 shifts, 120 people, real rules." },
  { href: "/system", title: "System", text: "Every component and token, in every state." },
  { href: "/decisions", title: "Decisions", text: "What I chose, what I left out, and why." },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-paper">
      <TopBar className="bg-paper" />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-16 md:px-8 md:py-24">
        <h1 className="max-w-4xl font-display text-48 leading-[3.125rem] tracking-[-0.03em] text-ink md:text-72 md:leading-[4.5rem]">
          <span className="font-bold">I built this</span>{" "}
          <span className="font-light">for the Senior Full-Stack Engineer role at Parim.</span>
        </h1>
        <ul className="mt-16 grid gap-x-8 border-t border-ink md:mt-24 md:grid-cols-3">
          {links.map((link) => (
            <li key={link.href} className="border-b border-hairline md:border-b-0">
              <Link
                href={link.href}
                className="group flex flex-col gap-2 py-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="font-display text-24 leading-8 font-bold tracking-[-0.02em] text-ink group-hover:text-accent">
                  {link.title}
                </span>
                <span className="text-14 text-muted">{link.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <footer className="mx-auto w-full max-w-[1120px] px-4 py-8 text-14 text-muted md:px-8">
        An unofficial concept by Gbemisola Oladetoun for Parim
      </footer>
    </div>
  );
}
