export type Decision = {
  title: string;
  problem: string;
  options: string[];
  choice: string;
  cost: string;
};

export const decisions: Decision[] = [
  {
    title: "A timeline with one row per location",
    problem:
      "On race day a manager asks who is on Gate A at 14:00. A list of 42 shifts makes them build that picture in their head.",
    options: [
      "A sortable table of shifts",
      "A grid with one row per person",
      "A timeline with one row per location",
    ],
    choice:
      "One row per location, 07:00 to 23:00 at 56px an hour, with overlapping shifts stacked in lanes. The coverage strip sits on the same grid, so a gap in the strip lines up with the shifts under it.",
    cost: "It is wide. Below 768px the board becomes a list grouped by location.",
  },
  {
    title: "Coverage bars for every hour",
    problem:
      "\"38 of 42 shifts covered\" sounds fine and hides that the gaps all fall between 14:00 and 16:00.",
    options: ["An overall percentage", "A heatmap per location", "One bar per hour"],
    choice:
      "A bar per hour. The outline is how many people are needed, grey is how many are assigned, and amber is the gap with its count above it. Covered hours have no colour, so the short hours are the only thing that stands out.",
    cost: "One more band above the board. I kept it under 130px tall.",
  },
  {
    title: "Each shift is a ticket with a seat per person",
    problem:
      "The first card the agents built marked status with a coloured stripe down the left edge. It says something is wrong without saying what, and it shows up in a lot of generated UI.",
    options: [
      "Empty places drawn as dashed circles",
      "A dashed border while places are open",
      "A dashed baseline with one segment per place",
      "Small squares like booking seats",
      "A large count that carries the colour",
      "Hatching over the open share of the card",
      "A ticket with a tear line",
      "A status dot before the role",
    ],
    choice:
      "I drew these eight in Figma and combined the empty places with the ticket. The head holds the role, count and time. Below a tear line, every place is a seat: a face when filled, a dashed circle when open. A short shift visibly has empty seats.",
    cost: "Cards are 8px taller, so the full board is longer.",
  },
  {
    title: "Drag and drop, with every step on the keyboard",
    problem:
      "Dragging a person onto a shift is the fastest way to staff a board, and impossible for someone using a keyboard or screen reader.",
    options: ["Drag only", "An assign dialog with two dropdowns", "Drag plus a keyboard path"],
    choice:
      "Space picks up a staff member, arrow keys move between shifts, Space drops and Esc cancels. Each step is announced, for example \"Ana Tamm, steward. Over Gate A 13:00 to 19:00, 2 of 4 filled.\"",
    cost: "Custom announcements and focus handling took longer than the drag itself.",
  },
  {
    title: "Overlaps block, rest limits warn",
    problem:
      "Some rules protect people and some only stop mistakes. Treating them the same either blocks managers who know better or lets real errors through.",
    options: ["Block on every rule", "Warn on every rule", "Block some, warn on others"],
    choice:
      "Overlapping shifts, the wrong role and an expired SIA licence block. Less than 11 hours rest and more than 48 hours a week ask for a reason, which goes into the activity log. A licence expiring within 14 days shows as a note.",
    cost: "Three severities instead of two, on the client and the server.",
  },
  {
    title: "End times past midnight",
    problem: "Events run past midnight, so 22:00 to 02:00 is a normal shift.",
    options: ["Reject an end time before the start", "Ask for an end date", "Read it as the next day"],
    choice:
      "An end time before the start means the next day. The field says \"Ends next day\" and shows the length, so 22:00 to 02:00 reads as 4 hours.",
    cost: "A 20-hour shift typed by mistake would pass, but the length is right there in the field.",
  },
  {
    title: "Workers only see what they can do",
    problem:
      "A disabled Assign button tells a shift worker nothing except that the page wasn't made for them.",
    options: ["Disable manager actions", "Hide them"],
    choice:
      "Workers see their own shifts and the open shifts they can take, with Request shift. The server strips other people's names before it sends the board. Manager actions return 403 for a worker even if called directly.",
    cost: "Two versions of the board to test.",
  },
  {
    title: "An undo toast on every change",
    problem:
      "Staffing 42 shifts means dozens of assignments. A confirm dialog on each one teaches people to click Yes without reading.",
    options: ["Confirm every change", "Optimistic update with undo"],
    choice:
      "The board updates at once and the request runs behind it. Every assign and remove shows a 5 second undo toast. If the save fails, the person slides back to the staff list and a toast offers Retry.",
    cost: "Rollback logic for every write.",
  },
  {
    title: "A row lock for the last slot",
    problem:
      "Two managers drop different people on the last place of a shift at the same moment. Without a lock both read 3 of 4, both insert, and the shift ends up 5 of 4.",
    options: ["Check in the browser only", "A unique constraint", "Lock the shift row inside the transaction"],
    choice:
      "Assigning locks the shift row with SELECT ... FOR UPDATE, then the person's row, checks the rules and inserts. The second request waits, sees 4 of 4 and gets a 409 naming who took the place. A test runs both requests in parallel against MySQL.",
    cost: "Writes queue up per shift. With 42 shifts and a few managers, nobody waits long enough to notice.",
  },
  {
    title: "A retry can't assign someone twice",
    problem:
      "Venue wifi drops. If an assign times out, the board retries, and the first request may already have worked.",
    options: ["Never retry writes", "Retry and hope", "Give every write a key"],
    choice:
      "Every write carries an idempotency key. The server keeps the first answer in Redis for 24 hours, and a repeat of the same key gets that answer back instead of running again. If the connection drops after the database commits, the retry checks whether its own write is already there and reports success.",
    cost: "One Redis round trip per write, and a second code path for retries.",
  },
  {
    title: "Component states live in code",
    problem: "Drawing every state twice, in Figma and in code, would have cost half the night.",
    options: ["Everything in Figma first", "Everything in code", "Foundations in Figma, states in code"],
    choice:
      "Figma has the tokens as variables in light and dark, the badge, button, shift card, coverage strip and field, every board state and the data model. The full state matrix for every component lives on /system in the running app.",
    cost: "Some states exist only in code.",
  },
  {
    title: "One cobalt accent, and red only for conflicts",
    problem:
      "My reference boards lean on red. In a scheduling tool red has to mean one thing, or nobody notices a real conflict.",
    options: ["A red accent", "A neutral accent", "Cobalt"],
    choice:
      "Cobalt for actions, focus and selection. Red only for a conflict, and even then on the card outline and the person who clashes. Every text colour passes WCAG AA in light and dark.",
    cost: "The page is quieter than my own style.",
  },
];

export const aiNote = {
  title: "How I used AI",
  paragraphs: [
    "I built ParimShift in one night with Claude Code. Builder agents wrote the design system, the API and the board in parallel. Separate critic agents, which hadn't seen the build, reviewed design, motion, the API and copy, and scored each piece out of 10. I sent back anything under 8.",
    "I decided the scope, the name, the design direction from my own reference boards, the ticket card out of eight options, and every trade-off on this page.",
    "The critics caught things I would have shipped. The first board design showed 19:00 as fully covered while Gate A had an empty 19:00 to 23:00 shift. A worker could read who took the last place from an error message. Editing a shift's times could double-book someone already on it. A retry after a dropped connection could report failure for a write that had worked.",
    "I turned down the agents' coloured-stripe card, a line explaining why each card was greyed out during a drag, and a red danger button, because red already meant conflict.",
  ],
};

export const nextSteps = [
  "Watch a shift manager staff a real event with it and time the first 10 assignments.",
  "Bulk assign: select several people and drop them on a shift at once.",
  "Send open shifts to workers' phones and let them claim a place.",
  "Live updates between managers through the Redis revision counter.",
];
