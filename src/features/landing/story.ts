export type Chapter = {
  id: string;
  title: string;
  paragraphs: string[];
  /** Short list of the concrete things, for readers who skim. */
  points?: string[];
  see?: { label: string; href: string }[];
};

export const FIGMA_URL = "https://www.figma.com/design/SV8LCoOm5W4SmQft8zky23/PARIM";
export const REPO_URL = "https://github.com/oladetoungee/parim-project";
export const PORTFOLIO_URL = "https://www.gbemisolaoladetoun.com";

export const intro = [
  "Hi. I'm Gbemisola, and I'd really like to work at Parim.",
  "I went through your product, the event module, the staff app, the way your customers talk about staffing a race day or a festival, and I liked what I saw. So instead of only sending a CV, I built a small slice of it to show how I'd work on your team.",
  "It's called ParimShift. Parim means best in Estonian, which felt right. Below is the story of how it came together, from the first sketch in Figma to the database lock that stops two managers filling the same last place. Everything mentioned here is live, so you can click through and try it.",
];

export const chapters: Chapter[] = [
  {
    id: "what",
    title: "What ParimShift does",
    paragraphs: [
      "Picture a shift manager on the morning of a race day. There are 42 shifts across six locations: two gates, two bars, security and the car park. 120 people are on the books. The manager needs to know, at a glance, what is still uncovered and at what time, fill it fast, and never put someone on a shift that breaks a rule.",
      "So the board is a timeline, one row per location. Above it sits a bar for every hour, and the hours that are short of people turn amber. Drag a person from the staff list onto a shift and the board updates straight away. Try to put someone where they can't go and it tells you why, in plain words. The shift worker gets their own view on the same board: their shifts, the open ones they can ask for, and nobody else's names.",
    ],
    see: [{ label: "Open the board", href: "/board" }],
  },
  {
    id: "design",
    title: "I designed it first",
    paragraphs: [
      "Before any code, I set up a design system in Figma. My own reference boards lean towards Swiss typography: strict grids, a bold and a light weight of the same typeface in one headline, flat colour and a lot of white space. A scheduling tool gets stared at for hours, so I took the calm side of that.",
      "Every colour, size, spacing step, radius and motion timing is a Figma variable, and the same names exist as CSS variables in the code. Light and dark are two modes of the same variables, so the whole file and the whole app switch with one setting. Cobalt is the only accent. Red means one thing, a conflict, so nobody misses a real one.",
    ],
    points: [
      "Foundations: colour, type, space, radius, elevation and motion as variables",
      "Components: badge, button, shift card, coverage strip and form field with every state",
      "The board in eight states, desktop and mobile, manager and worker",
    ],
    see: [
      { label: "Figma file", href: FIGMA_URL },
      { label: "The system in code", href: "/system" },
    ],
  },
  {
    id: "card",
    title: "The shift card took a few tries",
    paragraphs: [
      "The first card marked its status with a coloured stripe down the left edge. It worked, but it says something is wrong without saying what, and it is the kind of thing you see in a lot of generated UI. I drew eight alternatives in Figma and picked a ticket, with a tear line between the shift and its people. I built it, then saw 42 of them on one board and it was too busy.",
      "So I went back and laid every option across a real row of the board at real widths before choosing again. The card that shipped gives every place on a shift a seat: a face when it's filled, a dashed circle when it's open. Along the bottom edge there's a segment per place, grey when filled and amber when open. From across the room, the only cards that catch your eye are the ones that need people.",
    ],
    see: [{ label: "Why, on the decisions page", href: "/decisions" }],
  },
  {
    id: "motion",
    title: "Motion that explains something",
    paragraphs: [
      "I only animated moments where something changes state. When you drop a person on a shift, their face springs into place and the count rolls from 2 to 3. If the save fails, they slide back to the staff list. Undo plays the drop in reverse, and a refused drop gives the card a small shake. Hover never moves anything.",
      "Every animation uses the same duration and easing tokens as Figma, only moves transform and opacity so it stays smooth, and turns into a simple fade if you've asked your device for reduced motion.",
    ],
  },
  {
    id: "data",
    title: "The data model",
    paragraphs: [
      "Under the board there are nine tables: events, locations, roles, staff, licences, shifts, assignments, shift requests and an audit log. Times are stored in UTC and shown in the event's timezone, and a shift that ends before it starts simply ends the next day.",
      "The interesting part is the last free place on a shift. If two managers drop different people on it at the same moment, both could read 3 of 4 and both could insert. So assigning someone runs in one transaction that locks the shift row, then the person's row, always in that order so it can't deadlock, checks the rules and only then writes. The second manager waits a few milliseconds, sees 4 of 4 and is told who got there first. There's a test that fires both requests at once against a real MySQL database to prove it.",
    ],
    see: [{ label: "The diagram", href: "/decisions#data-heading" }],
  },
  {
    id: "frontend",
    title: "How the front end is put together",
    paragraphs: [
      "It's Next.js with the App Router, strict TypeScript and Tailwind, where Tailwind only knows the design tokens, so there's no way to use an off-system colour or size. The board talks to the API through TanStack Query.",
      "When you assign someone, the screen changes before the server answers and quietly rolls back if it says no. That's what makes it feel instant on venue wifi. Drag and drop uses dnd-kit with a full keyboard path, so you can pick a person up with Space, jump between the shifts that can take them with the arrow keys, and hear each step read out.",
    ],
    points: [
      "One pure rules module, shared by the browser for instant feedback and the server for the final say",
      "One set of Zod schemas for the forms, the client and the API",
      "Shift cards are memoised, and a test proves a drop re-renders only the card that changed",
      "Container queries so a two-hour shift lays itself out differently from an eight-hour one",
      "Feature folders: the board, the shell and the UI kit each own their code",
    ],
  },
  {
    id: "backend",
    title: "The back end, the database and the cache",
    paragraphs: [
      "The API is a set of small REST route handlers. Every body and query is validated, every error comes back in one shape, and the status codes mean what they say: 409 for a rule break or a race lost, 403 for a worker trying a manager action, 422 for bad input.",
      "The data lives in MySQL 8 on Railway in Amsterdam, through Drizzle so the SQL stays visible and typed. Redis on Upstash in Frankfurt holds idempotency keys. Every write carries one, so if the wifi drops and the board retries, the server hands back the first answer instead of doing the work twice. The app itself runs on Vercel in Frankfurt, so the whole round trip stays in Europe.",
    ],
  },
  {
    id: "security",
    title: "Keeping it safe",
    paragraphs: [
      "It's a demo with a role switch instead of a login, but I still treated it like something real people would use. The role lives in a signed cookie and the server never trusts a role sent in a request. A worker's board arrives from the server with other people's names already taken out.",
    ],
    points: [
      "Signed, HttpOnly session cookie, checked in constant time",
      "Writes need JSON and a matching Origin, which shuts out cross-site requests",
      "Rate limits in Redis, per session and per IP",
      "Request bodies capped in size, and every input validated",
      "Security headers on every page: a content security policy, HSTS, no framing",
      "Every response carries a request id, and errors are logged without personal data",
      "Dependencies audited in CI",
    ],
  },
  {
    id: "tests",
    title: "How I know it works",
    paragraphs: [
      "The rules have table tests for the awkward cases: a shift over midnight, rest across two days, a licence that expires on the day itself, exactly 48 hours. The API is tested against a real MySQL database, not a mock, including the two-managers race. Playwright drives the real board with the keyboard, and an accessibility check runs on every page in light and dark. All of it runs in GitHub Actions on every push.",
    ],
    see: [{ label: "The code", href: REPO_URL }],
  },
  {
    id: "ai",
    title: "How I used AI",
    paragraphs: [
      "I built this in about a day with Claude Code, set up as a small team: builder agents for the design system, the API and the board, and separate critic agents that hadn't seen the work and scored it out of 10. I made the calls on scope, design and every trade-off, and the critics caught real bugs I'd have shipped. The decisions page has the details.",
    ],
    see: [{ label: "Decisions", href: "/decisions" }],
  },
  {
    id: "production",
    title: "If this were going to production",
    paragraphs: [
      "This is a demo, so some things are deliberately missing. If I were building ParimShift for real customers, this is what I'd add next.",
    ],
    points: [
      "Real sign-in with SSO, and every row scoped to the customer's organisation",
      "Error tracking and tracing with Sentry and OpenTelemetry, with alerts on the assign endpoint's error rate and latency",
      "Uptime checks, dashboards, and logs shipped somewhere searchable",
      "Point-in-time database backups, a tested restore, and a staging environment that mirrors production",
      "Live updates between managers over websockets instead of refreshing",
      "Load tests on a 1,500-person event day before the first one",
      "Data retention rules for staff data under GDPR, and an audit log export",
      "Estonian and other languages, and the worker view in the mobile app",
    ],
  },
];

export const closing =
  "Thanks for reading this far. I'd love to talk about it, and about what you're building at Parim.";
