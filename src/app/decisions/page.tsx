import type { Metadata } from "next";
import { TopBar } from "@/features/shell/TopBar";
import { aiNote, decisions, nextSteps } from "@/features/decisions/decisions";
import { DataModel } from "@/features/decisions/DataModel";

export const metadata: Metadata = {
  title: "Decisions · ParimShift",
  description: "The calls behind ParimShift, the options I dropped and what each choice cost.",
};

const REPO_URL = "https://github.com/oladetoungee/parim-project";
const FIGMA_URL = "https://www.figma.com/design/SV8LCoOm5W4SmQft8zky23/PARIM";

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-14 font-medium text-muted">{children}</p>;
}

export default function DecisionsPage() {
  return (
    <>
      <TopBar current="decisions" />
      <main className="mx-auto max-w-[1120px] px-4 pb-24 pt-16 md:px-8">
        <header className="max-w-[720px]">
          <h1 className="font-display text-48 tracking-[-0.03em] text-ink md:text-72">
            <span className="font-bold">Decisions</span>
            <span className="font-light"> and what they cost</span>
          </h1>
          <p className="mt-6 text-16 text-muted">
            I built ParimShift for the Senior Full-Stack Engineer role at Parim. It is one slice of a
            scheduling product: staffing a race day with 42 shifts across six locations. This page lists
            the calls I made, the options I dropped and what each choice cost.
          </p>
        </header>

        <section aria-labelledby="decisions-heading" className="mt-20">
          <h2 id="decisions-heading" className="sr-only">
            Decisions
          </h2>
          {decisions.map((d) => (
            <article
              key={d.title}
              className="grid gap-6 border-t border-hairline py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12"
            >
              <h3 className="font-display text-24 font-bold tracking-[-0.02em] text-ink">{d.title}</h3>
              <div className="space-y-6 text-16 text-ink">
                <p>{d.problem}</p>
                <div className="space-y-2">
                  <Label>Options I looked at</Label>
                  <ul className="space-y-1 text-muted">
                    {d.options.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label>What I chose</Label>
                  <p>{d.choice}</p>
                </div>
                <div className="space-y-2">
                  <Label>What it cost</Label>
                  <p className="text-muted">{d.cost}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section
          aria-labelledby="ai-heading"
          className="grid gap-6 border-t border-hairline py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12"
        >
          <h2 id="ai-heading" className="font-display text-24 font-bold tracking-[-0.02em] text-ink">
            {aiNote.title}
          </h2>
          <div className="space-y-4 text-16 text-ink">
            {aiNote.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="data-heading" className="border-t border-hairline py-10">
          <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
            <h2 id="data-heading" className="font-display text-24 font-bold tracking-[-0.02em] text-ink">
              Data model
            </h2>
            <p className="text-16 text-muted">
              MySQL 8 through Drizzle. Times are stored in UTC and shown in the event&apos;s timezone.
              The pair of shift and person is unique on assignments, so nobody is on the same shift twice
              even when two requests land together.
            </p>
          </div>
          <DataModel />
        </section>

        <section
          aria-labelledby="next-heading"
          className="grid gap-6 border-t border-hairline py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12"
        >
          <h2 id="next-heading" className="font-display text-24 font-bold tracking-[-0.02em] text-ink">
            What I&apos;d do next with real Parim users
          </h2>
          <ul className="space-y-3 text-16 text-ink">
            {nextSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <footer className="flex flex-col gap-2 border-t border-hairline pt-8 text-14 text-muted md:flex-row md:justify-between">
          <p>An unofficial concept by Gbemisola Oladetoun for Parim</p>
          <p className="flex gap-6">
            <a className="underline underline-offset-4 hover:text-ink" href={REPO_URL}>
              Code on GitHub
            </a>
            <a className="underline underline-offset-4 hover:text-ink" href={FIGMA_URL}>
              Figma file
            </a>
          </p>
        </footer>
      </main>
    </>
  );
}
