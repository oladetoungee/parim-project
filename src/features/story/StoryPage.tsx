"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { APP_URL, FIGMA_URL, chapters, finale, hero, type Chapter, type Palette } from "./content";
import { BrowserFrame, Scaled } from "./Device";
import { BoardScene, DragScene, GapsScene, RequestsPhone, RequestsScene, RulesScene, SystemScene, TokenRow } from "./scenes";

const palettes: Record<Palette, CSSProperties> = {
  blue: {
    "--story-bg": "var(--blue-600)",
    "--story-fg": "var(--white)",
    "--story-muted": "rgb(255 255 255 / 0.82)",
  } as CSSProperties,
  white: {
    "--story-bg": "var(--white)",
    "--story-fg": "var(--ink)",
    "--story-muted": "var(--stone-700)",
  } as CSSProperties,
  paper: {
    "--story-bg": "var(--paper)",
    "--story-fg": "var(--ink)",
    "--story-muted": "var(--stone-700)",
  } as CSSProperties,
  ink: {
    "--story-bg": "var(--ink)",
    "--story-fg": "var(--ink-text)",
    "--story-muted": "var(--ink-muted)",
  } as CSSProperties,
};

/** Hero, the chapters, then the finale. Each entry is one section on the page. */
const sections: { palette: Palette; steps: number }[] = [
  { palette: "blue", steps: 1 },
  ...chapters.map((c) => ({ palette: c.palette, steps: c.steps })),
  { palette: "ink", steps: 1 },
];

/**
 * Tracks which section is on screen and how far through each one the reader
 * has scrolled. Progress goes on each section as --p for things that move
 * with the scroll (no re-render); the step, a whole number, goes in state.
 */
function useScrollStory(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [steps, setSteps] = useState<number[]>(() => Array(count).fill(0));

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      let current = 0;
      const next = refs.current.map((el, i) => {
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        if (rect.top <= vh * 0.5) current = i;
        const travel = rect.height - vh;
        const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : rect.top <= 0 ? 1 : 0;
        el.style.setProperty("--p", p.toFixed(4));
        return Math.min(sections[i].steps - 1, Math.floor(p * sections[i].steps));
      });
      setActive((a) => (a === current ? a : current));
      setSteps((s) => (s.every((v, i) => v === next[i]) ? s : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return { refs, active, steps };
}

export function StoryPage() {
  const { refs, active, steps } = useScrollStory(sections.length);
  const register = (i: number) => (el: HTMLElement | null) => {
    refs.current[i] = el;
  };

  return (
    <div
      className="story relative isolate min-h-dvh bg-[var(--story-bg)] text-[var(--story-fg)] transition-[background-color,color] duration-[600ms] ease-standard"
      style={palettes[sections[active].palette]}
    >
      <StoryBar />
      <main>
        <Hero ref={register(0)} />
        {chapters.map((chapter, i) => (
          <ChapterSection key={chapter.id} ref={register(i + 1)} chapter={chapter} step={steps[i + 1]} shown={active >= i + 1} />
        ))}
        <Finale ref={register(sections.length - 1)} />
      </main>
    </div>
  );
}

/* ---------- The bar along the top: the wordmark and the two ways in. ---------- */

const pill =
  "inline-flex h-9 items-center rounded-full px-4 text-14 font-medium transition-[background-color,color,opacity] duration-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--story-fg)]";

function StoryBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-5 md:px-8">
      <Link
        href="/v3"
        className="font-display text-20 leading-7 tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="font-bold">Parim</span>
        <span className="font-light">Shift</span>
      </Link>
      <nav aria-label="Main" className="flex items-center gap-2">
        <a
          href={FIGMA_URL}
          target="_blank"
          rel="noreferrer"
          className={cn(
            pill,
            "hidden border border-[color-mix(in_srgb,var(--story-fg)_35%,transparent)] sm:inline-flex hover:border-[var(--story-fg)]",
          )}
        >
          Figma
        </a>
        <Link href={APP_URL} className={cn(pill, "bg-[var(--story-fg)] text-[var(--story-bg)] hover:opacity-85")}>
          Open the app
        </Link>
      </nav>
    </header>
  );
}

/* ---------- Shared layout: headline left, device centre, line right. ---------- */

function Headline({ heavy, light, as: Tag = "h2" }: { heavy: string; light: string; as?: "h1" | "h2" }) {
  return (
    <Tag className="font-display text-32 leading-9 tracking-[-0.03em] md:text-[2.75rem] md:leading-[3rem] xl:text-[3.5rem] xl:leading-[3.5rem]">
      <span className="font-bold">{heavy}</span> <span className="font-light">{light}</span>
    </Tag>
  );
}

function PillLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  const className = cn(
    pill,
    "mt-5 self-start border border-[color-mix(in_srgb,var(--story-fg)_35%,transparent)] hover:border-[var(--story-fg)]",
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function Stage({ left, centre, right }: { left: ReactNode; centre: ReactNode; right: ReactNode }) {
  return (
    <div className="sticky top-0 flex h-dvh flex-col justify-center gap-6 px-5 pt-16 pb-6 md:px-8 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,min(54vw,780px))_minmax(0,0.85fr)] lg:items-center lg:gap-10 lg:pt-0 lg:pb-0">
      <div className="max-w-md">{left}</div>
      <div className="w-full">{centre}</div>
      <div className="flex max-w-xs flex-col">{right}</div>
    </div>
  );
}

/* ---------- Hero: plays on its own, no clicking. ---------- */

function Hero({ ref }: { ref: (el: HTMLElement | null) => void }) {
  return (
    <section ref={ref} aria-labelledby="story-hero" className="relative h-[170vh]">
      <Stage
        left={
          <h1
            id="story-hero"
            className="font-display text-48 leading-[3.125rem] tracking-[-0.03em] lg:text-[2.75rem] lg:leading-[3rem] xl:text-[3.25rem] xl:leading-[3.5rem]"
          >
            <span className="story-rise block font-bold" style={{ animationDelay: "100ms" }}>
              {hero.heavy}
            </span>
            <span className="story-rise block font-light" style={{ animationDelay: "350ms" }}>
              {hero.light}
            </span>
          </h1>
        }
        centre={
          <div className="story-device-in" style={{ animationDelay: "700ms" }}>
            <BrowserFrame path="/schedule">
              <BoardScene />
            </BrowserFrame>
          </div>
        }
        right={
          <>
            <p
              className="story-rise text-16 leading-6 text-[var(--story-muted)] md:text-[1.125rem] md:leading-7"
              style={{ animationDelay: "1500ms" }}
            >
              {hero.hook}
            </p>
            <p
              className="story-rise mt-3 font-display text-24 leading-8 font-bold tracking-[-0.02em]"
              style={{ animationDelay: "2100ms" }}
            >
              {hero.question}
            </p>
            <ScrollCue />
          </>
        }
      />
    </section>
  );
}

function ScrollCue() {
  return (
    <span
      className="story-rise mt-8 hidden items-center gap-3 text-12 font-medium text-[var(--story-muted)] lg:flex"
      style={{ animationDelay: "2700ms" }}
    >
      <span
        aria-hidden="true"
        className="relative h-10 w-px overflow-hidden bg-[color-mix(in_srgb,var(--story-fg)_30%,transparent)]"
      >
        <span className="story-cue absolute inset-x-0 top-0 h-4 bg-[var(--story-fg)]" />
      </span>
      Scroll
    </span>
  );
}

/* ---------- A chapter: holds still while its scene plays through its steps. ---------- */

function ChapterSection({
  ref,
  chapter,
  step,
  shown,
}: {
  ref: (el: HTMLElement | null) => void;
  chapter: Chapter;
  step: number;
  /** True once the reader reaches the chapter. The words rise in then and stay. */
  shown: boolean;
}) {
  const enter = cn(
    "transition-[opacity,translate] duration-[800ms] ease-enter",
    shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
  );
  const headingId = `story-${chapter.id}`;
  return (
    <section ref={ref} aria-labelledby={headingId} className="relative" style={{ height: `${chapter.steps * 90 + 40}vh` }}>
      <Stage
        left={
          <div id={headingId} className={enter}>
            <Headline heavy={chapter.heavy} light={chapter.light} />
          </div>
        }
        centre={<Scene chapter={chapter} step={step} />}
        right={
          <div className={cn("flex flex-col delay-150", enter)}>
            <p className="text-16 leading-6 text-[var(--story-muted)] md:text-[1.125rem] md:leading-7">{chapter.line}</p>
            {chapter.link ? <PillLink href={chapter.link.href}>{chapter.link.label}</PillLink> : null}
            <StepDots steps={chapter.steps} step={step} />
          </div>
        }
      />
    </section>
  );
}

function Scene({ chapter, step }: { chapter: Chapter; step: number }) {
  switch (chapter.id) {
    case "gaps":
      return (
        <BrowserFrame path="/schedule" width={920} height={600}>
          <GapsScene step={step} />
        </BrowserFrame>
      );
    case "drag":
      return (
        <BrowserFrame path="/schedule" width={920} height={600}>
          <DragScene step={step} />
        </BrowserFrame>
      );
    case "rules":
      return (
        <BrowserFrame path="/schedule" theme="dark" width={920} height={600}>
          <RulesScene step={step} />
        </BrowserFrame>
      );
    case "requests":
      return (
        <div className="relative pl-[16%]">
          <BrowserFrame path="/requests" width={920} height={600}>
            <RequestsScene step={step} />
          </BrowserFrame>
          <div
            aria-hidden="true"
            inert
            data-theme="light"
            className="absolute top-1/2 left-0 w-[24%] -translate-y-[44%] drop-shadow-2xl"
          >
            <Scaled width={300} height={600} className="overflow-visible">
              <RequestsPhone step={step} />
            </Scaled>
          </div>
        </div>
      );
    case "system":
      return (
        <div className="flex flex-col items-center gap-10">
          <div className="h-[260px] w-full md:h-[360px]">
            <SystemScene />
          </div>
          <TokenRow />
        </div>
      );
    default:
      return null;
  }
}

/** Where the reader is in the chapter. Decorative: the scroll position says the same. */
function StepDots({ steps, step }: { steps: number; step: number }) {
  if (steps < 2) return null;
  return (
    <span aria-hidden="true" className="mt-6 hidden gap-1.5 lg:flex">
      {Array.from({ length: steps }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 rounded-full bg-[var(--story-fg)] transition-[width,opacity] duration-slow ease-standard",
            i === step ? "w-6 opacity-100" : "w-1.5 opacity-30",
          )}
        />
      ))}
    </span>
  );
}

/* ---------- Finale: the numbers and the way in. ---------- */

function Finale({ ref }: { ref: (el: HTMLElement | null) => void }) {
  return (
    <section ref={ref} aria-labelledby="story-finale" className="flex min-h-dvh flex-col justify-center px-5 pt-24 pb-10 md:px-8">
      <div className="w-full max-w-[1280px]">
        <h2
          id="story-finale"
          className="font-display text-48 leading-[3.125rem] tracking-[-0.03em] md:text-[4rem] md:leading-[4rem]"
        >
          <span className="font-bold">{finale.heavy}</span>
          <br />
          <span className="font-light">{finale.light}</span>
        </h2>
        <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {finale.stats.map((s) => (
            <li
              key={s.label}
              className="flex aspect-[3/2] flex-col justify-between rounded-[20px] border border-[var(--ink-hairline)] p-6"
            >
              <span className="font-display text-[4rem] leading-none font-bold tracking-[-0.03em]">{s.figure}</span>
              <span className="text-14 text-[var(--story-muted)]">{s.label}</span>
            </li>
          ))}
          <li>
            <Link
              href={APP_URL}
              className="group flex aspect-[3/2] flex-col justify-between rounded-[20px] bg-[var(--blue-600)] p-6 text-[var(--white)] transition-[background-color] duration-base hover:bg-[var(--blue-700)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--blue-400)]"
            >
              <span className="font-display text-32 leading-9 font-bold tracking-[-0.02em]">{finale.cta}</span>
              <span
                aria-hidden="true"
                className="text-48 leading-none transition-transform duration-base ease-standard group-hover:translate-x-2"
              >
                →
              </span>
            </Link>
          </li>
        </ul>
        <nav
          aria-label="More"
          className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--ink-hairline)] pt-6 text-14"
        >
          {finale.links.map((l) =>
            l.href.startsWith("http") ? (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--story-muted)] underline-offset-4 hover:text-[var(--story-fg)] hover:underline"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                className="text-[var(--story-muted)] underline-offset-4 hover:text-[var(--story-fg)] hover:underline"
              >
                {l.label}
              </Link>
            ),
          )}
          <span className="ml-auto text-[var(--story-muted)]">By Gbemisola Oladetoun, for Parim</span>
        </nav>
      </div>
    </section>
  );
}
