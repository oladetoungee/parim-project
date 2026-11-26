import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { TopBar } from "@/features/shell/TopBar";
import { BoardSummary } from "@/features/landing/BoardSummary";
import { FIGMA_URL, PORTFOLIO_URL, REPO_URL, chapters, closing, intro } from "@/features/landing/story";

const VIDEO = "/parimshift-demo.mp4";
const POSTER = "/parimshift-demo-poster.jpg";
const hasVideo = existsSync(path.join(process.cwd(), "public", VIDEO));

const starts = [
  { href: "/board", title: "Board", text: "Staff the race day yourself." },
  { href: "/system", title: "System", text: "Every component, in every state." },
  { href: "/decisions", title: "Decisions", text: "What I chose and what it cost." },
  { href: FIGMA_URL, title: "Figma", text: "The design system and the board." },
];

const linkStyle =
  "underline decoration-hairline underline-offset-4 hover:text-accent hover:decoration-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function isExternal(href: string) {
  return href.startsWith("http");
}

function SmartLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return isExternal(href) ? (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-canvas">
      <TopBar />
      <main className="mx-auto w-full max-w-[1120px] px-4 pt-16 pb-12 md:px-8 md:pt-24">
        <header className="max-w-[760px]">
          <h1 className="font-display text-48 leading-[3.125rem] tracking-[-0.03em] text-ink md:text-72 md:leading-[4.5rem]">
            <span className="font-bold">Hi Parim.</span>{" "}
            <span className="font-light">I built you something.</span>
          </h1>
          <div className="mt-8 space-y-4 text-16 text-ink md:text-20 md:leading-8">
            {intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <p className="mt-6">
            <BoardSummary />
          </p>
        </header>

        {hasVideo ? (
          <section aria-labelledby="film-heading" className="mt-16">
            <h2 id="film-heading" className="text-14 font-medium text-muted">
              The whole thing in 100 seconds (with jazz in the background, because I love jazz)
            </h2>
            <video
              className="mt-3 w-full rounded-8 border border-hairline bg-paper"
              src={VIDEO}
              poster={POSTER}
              controls
              preload="none"
              playsInline
            >
              <track kind="captions" />
            </video>
          </section>
        ) : null}

        <nav aria-label="Start here" className="mt-16">
          <h2 className="text-14 font-medium text-muted">Start here</h2>
          <ul className="mt-3 grid border-t border-ink sm:grid-cols-2 md:grid-cols-4">
            {starts.map((s) => (
              <li key={s.href} className="border-b border-hairline">
                <SmartLink
                  href={s.href}
                  className="group flex flex-col gap-1 py-5 pr-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="font-display text-24 font-bold tracking-[-0.02em] text-ink group-hover:text-accent">
                    {s.title}
                  </span>
                  <span className="text-14 text-muted">{s.text}</span>
                </SmartLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-20">
          {chapters.map((c) => (
            <section
              key={c.id}
              id={c.id}
              aria-labelledby={`${c.id}-heading`}
              className="grid gap-6 border-t border-hairline py-12 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12"
            >
              <h2
                id={`${c.id}-heading`}
                className="font-display text-24 leading-8 font-bold tracking-[-0.02em] text-ink md:text-32 md:leading-10"
              >
                {c.title}
              </h2>
              <div className="max-w-[64ch] space-y-4 text-16 leading-7 text-ink">
                {c.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {c.points ? (
                  <ul className="space-y-2 border-l border-hairline pl-4 text-muted">
                    {c.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                ) : null}
                {c.see ? (
                  <p className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-14 font-medium">
                    {c.see.map((l) => (
                      <SmartLink key={l.href} href={l.href} className={linkStyle}>
                        {l.label}
                      </SmartLink>
                    ))}
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <section className="border-t border-ink pt-12 pb-8">
          <p className="max-w-[760px] font-display text-32 leading-10 tracking-[-0.02em] text-ink">
            <span className="font-light">{closing}</span>
          </p>
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-14 font-medium">
            <a className={linkStyle} href={PORTFOLIO_URL} target="_blank" rel="noreferrer">
              More about me
            </a>
            <a className={linkStyle} href={REPO_URL} target="_blank" rel="noreferrer">
              The code on GitHub
            </a>
          </p>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-[1120px] px-4 pb-8 text-14 text-muted md:px-8">
        An unofficial concept by Gbemisola Oladetoun for Parim
      </footer>
    </div>
  );
}
