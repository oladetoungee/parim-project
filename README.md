# ParimShift

An event shift board and the design system behind it, built by Gbemisola Oladetoun for Parim.

**Live:** https://parimshift.gbemisolaoladetoun.com
**Design:** [Figma file](https://www.figma.com/design/SV8LCoOm5W4SmQft8zky23/PARIM)

A shift manager staffs a race day: 42 shifts across six locations and 120 people. The board shows which hours are short, lets you drag or keyboard-assign people onto shifts, and refuses anything that breaks a rule (overlaps, the wrong role, an expired SIA licence) or asks for a reason when it bends one (less than 11 hours rest, over 48 hours a week). Shift workers see their own shifts and the open ones they can request.

The home page tells the full story, and `/decisions` has the trade-offs.

## Stack

- Next.js (App Router), strict TypeScript, Tailwind v4 mapped to design tokens
- TanStack Query for optimistic updates with rollback, dnd-kit for drag and keyboard assign, Radix primitives
- REST route handlers with Zod validation and one error shape
- MySQL 8 through Drizzle, with row locks for the last free place on a shift
- Upstash Redis for idempotency keys and rate limits
- Vitest (unit, component, integration against real MySQL), Playwright with axe, GitHub Actions

## Run it locally

```bash
pnpm install
cp .env.example .env.local   # fill in MySQL, Redis and a session secret
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm test        # unit and component
pnpm test:int    # integration, needs TEST_DATABASE_URL
pnpm e2e         # Playwright, builds and serves against the test database
```

## Layout

```
src/app            pages and API route handlers
src/components/ui  the design system components
src/features       board, shell, landing and decisions
src/lib            shared rules, schemas and time helpers
src/server         database, assign transaction, sessions, security
tokens             design tokens, mirrored from Figma variables
drizzle            migrations
tests              unit, integration and end-to-end tests
```
