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
    problem: "On race day a manager asks who is on Gate A at 14:00. A list of 42 shifts makes them work that out in their head.",
    options: ["A sortable table of shifts", "A grid with one row per person", "A timeline with one row per location"],
    choice:
      "One row per location, 07:00 to 23:00. Overlapping shifts stack in lanes, and the coverage bars sit on the same hour grid, so a gap lines up with the shifts under it.",
    cost: "It's wide. On a phone the board becomes a list grouped by location.",
  },
  {
    title: "Coverage bars for every hour",
    problem: "\"38 of 42 shifts covered\" sounds fine and hides that every gap falls between 14:00 and 16:00.",
    options: ["One overall percentage", "A heatmap per location", "One bar per hour"],
    choice: "A bar per hour. Grey is who's assigned, amber is the gap with its count above it. Covered hours have no colour.",
    cost: "One more band above the board.",
  },
  {
    title: "A seat for every place on a shift",
    problem: "A shift card has to show who's on, who's missing and whether it's in trouble, forty times on one screen.",
    options: [
      "A coloured stripe on the edge",
      "Empty places as dashed circles",
      "A dashed border while places are open",
      "One baseline segment per place",
      "Small squares like booking seats",
      "A large count that carries the colour",
      "Hatching over the open share",
      "A ticket with a tear line",
    ],
    choice:
      "I compared them across a full row of the board for glanceability, visual noise and how they held up at two hours wide. Seats plus an amber baseline won: it shows open capacity directly and keeps covered shifts quiet.",
    cost: "Two signals for one fact, which I kept because each one works at a different distance.",
  },
  {
    title: "Drag and drop, with every step on the keyboard",
    problem: "Dragging is the fastest way to staff a board, and impossible with a keyboard or a screen reader.",
    options: ["Drag only", "An assign dialog with two dropdowns", "Drag plus a keyboard path"],
    choice: "Space picks someone up, arrow keys jump between shifts that can take them, Space drops and Esc cancels. Each step is read out.",
    cost: "The keyboard path took longer than the drag.",
  },
  {
    title: "Overlaps block, rest limits warn",
    problem: "Some rules protect people and some only catch mistakes. Treating them the same either blocks managers who know better or lets real errors through.",
    options: ["Block on every rule", "Warn on every rule", "Block some, warn on others"],
    choice:
      "Overlaps, the wrong role and an expired licence block. Less than 11 hours rest or more than 48 hours a week asks for a reason, which goes into the activity log.",
    cost: "Three severities instead of two, on the client and the server.",
  },
  {
    title: "End times past midnight",
    problem: "Events run late, so 22:00 to 02:00 is a normal shift.",
    options: ["Reject it", "Ask for an end date", "Read it as the next day"],
    choice: "An end time before the start means the next day. The field says \"Ends next day\" and shows the length.",
    cost: "A 20-hour typo would pass, but the length is right there.",
  },
  {
    title: "Workers only see what they can do",
    problem: "A disabled Assign button tells a shift worker the page wasn't made for them.",
    options: ["Disable manager actions", "Hide them"],
    choice:
      "Workers see their shifts and the open ones they can request. The server strips other people's names, and manager actions return 403 even if called directly.",
    cost: "Two versions of the board to test.",
  },
  {
    title: "An undo toast on every change",
    problem: "A confirm dialog on every assignment teaches people to click Yes without reading.",
    options: ["Confirm every change", "Change straight away, with undo"],
    choice:
      "The board updates at once and saves behind it. Every change gets a 5 second undo, and a failed save slides the person back with a Retry.",
    cost: "Rollback logic for every write.",
  },
  {
    title: "Only one manager gets the last place",
    problem: "Two managers drop different people on the last place of a shift at the same moment. Without care, the shift ends up 5 of 4.",
    options: ["Check in the browser only", "A unique constraint", "Lock the shift while assigning"],
    choice:
      "Assigning locks the shift for a moment, checks the rules and saves. The second manager is told who got there first. A test fires both requests at once against MySQL.",
    cost: "Writes to one shift queue up, which nobody notices at this scale.",
  },
  {
    title: "A retry can't assign someone twice",
    problem: "Venue wifi drops. If a save times out, the board retries, and the first one may already have worked.",
    options: ["Never retry", "Retry and hope", "Give every write a key"],
    choice: "Every write carries an idempotency key. Redis keeps the first answer for 24 hours and a repeat gets that answer back.",
    cost: "One Redis call per write.",
  },
  {
    title: "Component states live in code",
    problem: "Drawing every state twice, in Figma and in code, would have doubled the work.",
    options: ["Everything in Figma first", "Everything in code", "Foundations in Figma, states in code"],
    choice:
      "Figma has the tokens in light and dark, the main components, every board state and the data model. The full state matrix lives on the system page.",
    cost: "Some states exist only in code.",
  },
  {
    title: "Parim's blue as the one accent, red only for conflicts",
    problem: "In a scheduling tool red has to mean one thing, or nobody notices a real conflict.",
    options: ["A red accent", "A neutral accent", "Parim's blue"],
    choice: "Parim's sky blue for marks, and a deeper shade of it for buttons, links and focus so text still passes contrast. Red only for conflicts. Every text colour passes WCAG AA in light and dark.",
    cost: "A quieter page.",
  },
];

export const aiNote = {
  title: "How I used AI",
  paragraphs: [
    "I built ParimShift in about a day with Claude Code, set up as a small team: builder agents for the design system, the API and the board, and separate critic agents that scored each piece out of 10. Anything under 8 went back.",
    "I made the calls on scope, design and every trade-off on this page.",
    "The critics caught real bugs: a coverage bar that disagreed with the shifts under it, a worker able to see who took a place, and a shift edit that could double-book someone.",
  ],
};

export const nextSteps = [
  "Watch a shift manager staff a real event with it and time the first ten assignments.",
  "Bulk assign: select several people and drop them on a shift at once.",
  "Send open shifts to workers' phones so they can claim a place.",
  "Live updates between managers.",
];
