import { FIGMA_URL, PORTFOLIO_URL, REPO_URL } from "@/features/landing/story";

export { FIGMA_URL, PORTFOLIO_URL, REPO_URL };

/** Where the story sends people into the product. */
export const APP_URL = "/v3/schedule";

export type Palette = "blue" | "white" | "paper" | "ink";

export type Chapter = {
  id: string;
  palette: Palette;
  /** One headline in two weights: the heavy part, then the light part. */
  heavy: string;
  light: string;
  line: string;
  link?: { label: string; href: string };
  /** How many screens the chapter holds still for, one per step of its scene. */
  steps: number;
};

export const hero = {
  heavy: "Hi Parim,",
  light: "I'm Gbemisola.",
  hook: "It's race day at Riverbank. The feature race starts at two, and four shifts are still short.",
  question: "Who do you send?",
};

export const chapters: Chapter[] = [
  {
    id: "gaps",
    palette: "white",
    heavy: "Every gap,",
    light: "by the hour",
    line: "42 shifts and 120 people on one board. From 14:00 to 16:00 it needs 55 people and has 48.",
    link: { label: "Open the schedule", href: APP_URL },
    steps: 3,
  },
  {
    id: "drag",
    palette: "paper",
    heavy: "Drag a person",
    light: "onto a shift",
    line: "Mart Saar lands on Gate A straight away. If the server refuses, he goes back to the staff list.",
    steps: 3,
  },
  {
    id: "rules",
    palette: "ink",
    heavy: "Rules run",
    light: "on every drop",
    line: "Siim Mägi's SIA licence expired, so he can't go on Security. A short rest is different: you can still assign, with a reason.",
    link: { label: "How the rules work", href: "/decisions" },
    steps: 3,
  },
  {
    id: "requests",
    palette: "white",
    heavy: "Workers ask.",
    light: "You approve.",
    line: "Mari Kask asks for Bar 2 from her phone. Approve it and she's on the shift, with an undo.",
    link: { label: "See the requests", href: "/v3/requests" },
    steps: 3,
  },
  {
    id: "system",
    palette: "blue",
    heavy: "One system,",
    light: "Figma to code",
    line: "Every colour, size and timing is a Figma variable. status/short in Figma is --status-short in the CSS.",
    link: { label: "Open the Figma file", href: FIGMA_URL },
    steps: 2,
  },
];

export const finale = {
  heavy: "Thanks for scrolling.",
  light: "Have a go yourself.",
  stats: [
    { figure: "112", label: "Tests, run on every push" },
    { figure: "42", label: "Shifts and 120 people on one board" },
    { figure: "0", label: "Colours in the app outside the design tokens" },
  ],
  cta: "Open ParimShift",
  links: [
    { label: "Decisions", href: "/decisions" },
    { label: "Design system", href: "/system" },
    { label: "Figma", href: FIGMA_URL },
    { label: "Code on GitHub", href: REPO_URL },
    { label: "More about me", href: PORTFOLIO_URL },
  ],
};
