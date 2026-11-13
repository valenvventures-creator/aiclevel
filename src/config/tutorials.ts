import {
  ArrowRightLeft,
  BadgeCheck,
  Bell,
  BookOpen,
  BookmarkPlus,
  Brain,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  CornerUpRight,
  FileDown,
  FileText,
  Files,
  FolderKanban,
  Gavel,
  Globe,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Mail,
  MessageSquare,
  Mic,
  Pin,
  Play,
  Plug,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  ThumbsDown,
  ThumbsUp,
  Upload,
  UserPlus,
  Users,
  Vote,
  Volume2,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { TutorialMediaName } from "./tutorial-media";

/**
 * TUTORIALS — the in-app guide to every area of the A.I. C-Level.
 * Content only (rendered by src/app/(c-suite)/tutorials). Screenshots come
 * from the demo organization and are captioned as such.
 */

export type TutorialCategory = "Start here" | "Leadership" | "Intelligence" | "Make your C-Level better" | "For owners & admins" | "Help";

export const TUTORIAL_CATEGORIES: { name: TutorialCategory; blurb: string }[] = [
  { name: "Start here", blurb: "Your first visit, and how to find your way around." },
  { name: "Leadership", blurb: "Talk to your executives, convene them and hear their verdicts." },
  { name: "Intelligence", blurb: "Where your organization's knowledge, work and decisions live." },
  { name: "Make your C-Level better", blurb: "Teach the executives and give them the knowledge they need." },
  { name: "For owners & admins", blurb: "Team, configuration, A.I. connections and organization settings." },
  { name: "Help", blurb: "Answers to common questions and messages." },
];

export interface TutorialImage {
  name: TutorialMediaName;
  alt: string;
  caption?: string;
}

export interface TutorialStep {
  title: string;
  body: string;
  icon: LucideIcon;
  image?: TutorialImage;
  tip?: string;
}

/** A symbol you will see on screen, and what it means. */
export type TutorialSymbol =
  | { kind: "icon"; icon: LucideIcon; meaning: string; label: string }
  | { kind: "badge"; text: string; tone: "gold" | "ok" | "warn" | "risk" | "info" | "neutral"; meaning: string }
  | { kind: "keys"; keys: string[]; meaning: string };

export interface Tutorial {
  slug: string;
  title: string;
  category: TutorialCategory;
  icon: LucideIcon;
  minutes: number;
  summary: string;
  /** Who can use this area (roles). */
  who: string;
  open?: { href: string; label: string };
  overview: string;
  /** The "at a glance" flow shown at the top. */
  flow: { icon: LucideIcon; label: string }[];
  steps: TutorialStep[];
  symbols?: TutorialSymbol[];
  tips?: string[];
  related: string[];
}

const DEMO = "Example from the demo organization.";

export const TUTORIALS: Tutorial[] = [
  /* ------------------------------------------------------------------ */
  /* Start here                                                          */
  /* ------------------------------------------------------------------ */
  {
    slug: "getting-started",
    title: "Getting started: your first 15 minutes",
    category: "Start here",
    icon: Sparkles,
    minutes: 6,
    summary: "Meet your seven A.I. Executives and get your first real answer, session and saved knowledge.",
    who: "Everyone",
    open: { href: "/hq", label: "Open C-Level HQ" },
    overview:
      "The A.I. C-Level is a leadership team of seven A.I. Executives (CEO, CFO, CCO, CHRO, CTO, CLO and Chief Impact Officer) who share one memory of your organization. You can talk to one executive privately, bring several together on a business question, or ask them to produce finished work. Everything they learn about your organization is kept in C-Level Memory, and every important conclusion waits for a person to confirm it.",
    flow: [
      { icon: LayoutDashboard, label: "Land on HQ" },
      { icon: MessageSquare, label: "Ask an executive" },
      { icon: Users, label: "Convene a session" },
      { icon: Brain, label: "Keep what matters" },
    ],
    steps: [
      {
        title: "Start at C-Level HQ",
        icon: LayoutDashboard,
        body: "After you sign in you arrive at C-Level HQ, your daily overview: the CEO's brief, decisions and approvals waiting for you, recent messages from your executives and quick actions.",
        image: { name: "hq", alt: "C-Level HQ with the greeting, quick actions and the Daily CEO Brief", caption: DEMO },
      },
      {
        title: "Ask one executive a question",
        icon: MessageSquare,
        body: "Open Executive Offices, choose an executive (for example the Chief Financial Officer) and type your question in the Conversation tab. Press Enter to send. The answer appears as it is written.",
        tip: "Be specific: include numbers, deadlines and constraints. The more context you give, the better the answer.",
      },
      {
        title: "Bring several executives together",
        icon: Users,
        body: "For a real business decision, open C-Level Sessions → New C-Level Session. Write the question, pick the executives and a strategy, and press Convene. Each executive gives a position and the CEO pulls them into one recommendation and a decision record.",
      },
      {
        title: "Keep what matters",
        icon: Brain,
        body: "Add facts about your organization to C-Level Memory (figures, customers, constraints), upload key documents to Files, and approve good decisions. The executives use all of it in future answers.",
      },
      {
        title: "Help them get better",
        icon: ThumbsUp,
        body: "Rate answers with 👍 or 👎 and say what you wanted instead. Your notes become lessons the executive follows once an admin approves them.",
      },
    ],
    symbols: [
      { kind: "badge", text: "SIMULATED", tone: "gold", meaning: "Demo output: no A.I. key is connected, so this text is a template, not real analysis." },
      { kind: "badge", text: "PROPOSED", tone: "gold", meaning: "Suggested by an A.I. Executive and not yet confirmed by a person." },
      { kind: "badge", text: "VERIFIED", tone: "ok", meaning: "Confirmed by a person in your organization." },
    ],
    tips: [
      "The A.I. Executives are advisers, not licensed professionals: the CLO is not your lawyer and the CFO is not a regulated financial adviser.",
      "Nothing is sent outside the platform without a person approving it.",
    ],
    related: ["finding-your-way", "executive-offices", "c-level-sessions"],
  },
  {
    slug: "finding-your-way",
    title: "Finding your way: menu, search and notifications",
    category: "Start here",
    icon: Search,
    minutes: 4,
    summary: "Use the menu, the search-and-commands box and notifications to get anywhere fast.",
    who: "Everyone",
    overview:
      "Every area is in the menu on the left. The search box at the top (or Ctrl/⌘ + K) lets you jump anywhere, ask any executive or search your organization's knowledge without clicking through menus. The bell shows what needs your attention.",
    flow: [
      { icon: LayoutDashboard, label: "Menu" },
      { icon: Search, label: "Search & commands" },
      { icon: Bell, label: "Notifications" },
    ],
    steps: [
      {
        title: "The menu",
        icon: LayoutDashboard,
        body: "The left menu is grouped into Leadership (HQ, Executive Offices, Executive Comms, C-Level Sessions), Intelligence (Memory, Studio, Decisions, Reports, Files, Projects) and Organization (Settings, Tutorials). Your organization's name is at the top; your profile and Sign out are at the bottom. Use Collapse to make it narrow. On a phone, open it with the menu button at the top left.",
        image: { name: "sidebar", alt: "The left menu with Leadership, Intelligence and Organization sections", caption: DEMO },
      },
      {
        title: "Search and commands",
        icon: Search,
        body: "Click the search box at the top or press Ctrl + K (⌘ + K on a Mac). Type to filter: “Ask CFO” opens a conversation with the CFO; actions include Message C-Level, Start C-Level Session, Open Studio, Search Memory, Upload File and Generate Report. Type two or more letters to also search your organization's memory, decisions, reports and more. Use ↑ ↓ to move, Enter to open and Esc to close.",
        image: { name: "palette", alt: "The search and commands box listing Ask CEO, Ask CFO and other executives", caption: DEMO },
      },
      {
        title: "Notifications",
        icon: Bell,
        body: "The bell at the top right shows a count when something is new: Finished Work ready, memory that needs confirming, executive replies, lessons to review. Click a notification to go straight there, or Mark all read.",
        image: { name: "notifications", alt: "The notifications panel listing recent events", caption: DEMO },
      },
    ],
    symbols: [
      { kind: "keys", keys: ["Ctrl", "K"], meaning: "Open search and commands (⌘ K on a Mac)." },
      { kind: "keys", keys: ["Esc"], meaning: "Close search, menus and panels." },
      { kind: "badge", text: "SIMULATION", tone: "gold", meaning: "Top right: no A.I. key is connected yet, so answers are templates." },
    ],
    tips: ["If you see “Verify your email to invite team members”, use the link in the banner to confirm your address."],
    related: ["getting-started", "c-level-hq"],
  },

  /* ------------------------------------------------------------------ */
  /* Leadership                                                          */
  /* ------------------------------------------------------------------ */
  {
    slug: "c-level-hq",
    title: "C-Level HQ: your daily overview",
    category: "Leadership",
    icon: LayoutDashboard,
    minutes: 3,
    summary: "Read the CEO's brief, clear approvals and jump into the day's work.",
    who: "Everyone (approvals need the Owner, Admin or Executive role)",
    open: { href: "/hq", label: "Open C-Level HQ" },
    overview: "HQ gathers what needs your attention today in one place. Start your day here, act on what is waiting, then use the quick actions to begin new work.",
    flow: [
      { icon: FileText, label: "Read the brief" },
      { icon: CheckCircle2, label: "Clear approvals" },
      { icon: Play, label: "Start new work" },
    ],
    steps: [
      {
        title: "Quick actions",
        icon: Play,
        body: "Across the top: Convene a C-Level Session, Ask the CEO, Message the C-Level and Request Finished Work. Each takes you straight to the right place.",
        image: { name: "hq", alt: "HQ with quick actions and the Daily CEO Brief", caption: DEMO },
      },
      { title: "Daily CEO Brief", icon: FileText, body: "The CEO's summary of what matters today: risks, deadlines and what each executive is watching. Open it to read the full brief." },
      {
        title: "Act on what's waiting",
        icon: CheckCircle2,
        body: "Awaiting your approval lists actions an executive has proposed; use Approve or Reject. Decisions requiring attention and Memory needs confirmation link to the items to review.",
      },
      {
        title: "Keep an eye on the rest",
        icon: LayoutDashboard,
        body: "Recent Executive Comms, Active C-Level Sessions, C-Level Studio work, Recent decisions, the Financial snapshot and Risk & technology alerts round out the picture. Click any item to open it.",
      },
    ],
    related: ["getting-started", "decisions", "executive-comms"],
  },
  {
    slug: "executive-offices",
    title: "Executive Offices: private conversations",
    category: "Leadership",
    icon: Building2,
    minutes: 6,
    summary: "Talk one-to-one with any executive, and use the tools under every answer.",
    who: "Everyone except Viewers can start conversations",
    open: { href: "/executives", label: "Open Executive Offices" },
    overview:
      "Each executive has an office: a private conversation space plus their profile, their own knowledge and lessons (Learning), the shared knowledge they draw on (Library), reports and activity. Conversations are private to you; nobody else in your organization can read them.",
    flow: [
      { icon: Building2, label: "Choose an office" },
      { icon: MessageSquare, label: "Ask" },
      { icon: ThumbsUp, label: "Rate & use the answer" },
    ],
    steps: [
      {
        title: "Choose an executive",
        icon: Building2,
        body: "Executive Offices shows all seven executives with their focus. Click one to enter their office.",
        image: { name: "offices", alt: "The seven executive office cards", caption: DEMO },
      },
      {
        title: "The office",
        icon: LayoutDashboard,
        body: "The header has quick actions: Start conversation, Send message (Executive Comms), Request report and Assign work (Studio), Add to C-Level Session and Voice. Below are the tabs: Conversation, Executive Profile, Learning, Library, Reports and Activity.",
        image: { name: "office-header", alt: "The Chief Financial Officer's office header and quick actions", caption: DEMO },
      },
      {
        title: "Ask a question",
        icon: MessageSquare,
        body: "In the Conversation tab, type your question (or click a suggestion) and press Enter. Use Shift + Enter for a new line, the microphone button to speak instead of typing, and Stop to end an answer early. Past conversations are listed on the left; New conversation starts a fresh one.",
        image: { name: "conversation", alt: "A question to the CFO and the CFO's answer", caption: `${DEMO} Real answers replace the simulated text once an A.I. key is connected.` },
        tip: "When an executive searches the web you will see “Searching the web…” and a Sources list at the end of the answer.",
      },
      {
        title: "Use the answer",
        icon: Copy,
        body: "Under each answer: 👍 / 👎 to rate it, Copy, Read aloud, Regenerate and Continue (latest answer only), Save to C-Level Memory, Forward to another executive (starts an Executive Comms thread) and Bring to C-Level Session. Hover over your own message to edit and resend it.",
        image: { name: "answer-actions", alt: "The row of buttons under an answer", caption: "The buttons under every answer, left to right." },
      },
    ],
    symbols: [
      { kind: "icon", icon: ThumbsUp, label: "Good answer", meaning: "Rate the answer as helpful (you can say what worked)." },
      { kind: "icon", icon: ThumbsDown, label: "Needs improvement", meaning: "Say what it should have said; this becomes a suggested lesson." },
      { kind: "icon", icon: Copy, label: "Copy", meaning: "Copy the answer to your clipboard." },
      { kind: "icon", icon: Volume2, label: "Read aloud", meaning: "Have your browser read the answer out." },
      { kind: "icon", icon: RotateCcw, label: "Regenerate", meaning: "Ask again for a fresh answer (latest answer only)." },
      { kind: "icon", icon: Play, label: "Continue", meaning: "Ask the executive to keep going (latest answer only)." },
      { kind: "icon", icon: BookmarkPlus, label: "Save to C-Level Memory", meaning: "Keep this answer as a proposed memory for confirmation." },
      { kind: "icon", icon: CornerUpRight, label: "Forward", meaning: "Send the answer to another executive in Executive Comms." },
      { kind: "icon", icon: Users, label: "Bring to C-Level Session", meaning: "Open a session that starts from this conversation." },
      { kind: "icon", icon: Mic, label: "Voice input", meaning: "Speak your question instead of typing." },
    ],
    related: ["teaching-your-executives", "executive-library", "web-research"],
  },
  {
    slug: "executive-comms",
    title: "Executive Comms: internal messages",
    category: "Leadership",
    icon: Mail,
    minutes: 4,
    summary: "Send memos to one, several or all executives (and teammates) and get written replies.",
    who: "Everyone except Viewers can send",
    open: { href: "/comms?compose=1", label: "Write a message" },
    overview:
      "Executive Comms is your organization's internal correspondence. Address a message to any mix of executives and human team members; each executive you address replies in the thread with a short memo from their seat. Nothing here is sent outside the platform.",
    flow: [
      { icon: Mail, label: "New message" },
      { icon: Users, label: "Choose recipients" },
      { icon: Send, label: "Send" },
      { icon: MessageSquare, label: "Read replies" },
    ],
    steps: [
      {
        title: "Your mailbox",
        icon: Mail,
        body: "Folders on the left: Inbox, Sent, Starred, Drafts and Archived. Use Unread to see only new items and the search box to find a thread. Click a thread to read it; Mark read clears it from Unread.",
        image: { name: "comms", alt: "The Executive Comms inbox with threads", caption: DEMO },
      },
      {
        title: "Write a message",
        icon: Send,
        body: "Press New message. Click executives to address them (All seven selects everyone) and add human team members if you like. Optionally choose Begin from to start from an existing item, then write a Subject and Message. Press Send, or Save draft to finish later.",
        image: { name: "comms-compose", alt: "The new message form with executives to choose from", caption: DEMO },
      },
      { title: "Read the replies", icon: MessageSquare, body: "Each executive you addressed replies in the same thread shortly after, as an internal memo signed with their title. You get a notification when replies arrive." },
    ],
    symbols: [
      { kind: "icon", icon: Star, label: "Starred", meaning: "Important threads you have starred." },
      { kind: "icon", icon: Send, label: "Sent", meaning: "Messages you sent." },
    ],
    tips: ["Executives never claim to have taken outside action from Comms. Anything consequential goes through an approval."],
    related: ["executive-offices", "c-level-hq"],
  },
  {
    slug: "c-level-sessions",
    title: "C-Level Sessions: convene leadership",
    category: "Leadership",
    icon: Users,
    minutes: 7,
    summary: "Bring a business question to several executives and get one integrated recommendation.",
    who: "Owners, Admins, Executives and Members",
    open: { href: "/sessions/new", label: "New C-Level Session" },
    overview:
      "A C-Level Session is a structured meeting on one question. Each executive gives an independent position, specialists review or challenge where the strategy calls for it, and the CEO (or the chair you choose) writes a synthesis with a recommendation, rationale, preserved dissent, risks, next steps and confidence. The synthesis becomes a proposed decision.",
    flow: [
      { icon: ClipboardList, label: "Frame the question" },
      { icon: Users, label: "Executives respond" },
      { icon: Sparkles, label: "CEO synthesis" },
      { icon: Gavel, label: "Decision record" },
    ],
    steps: [
      {
        title: "Set up the session",
        icon: ClipboardList,
        body: "C-Level Sessions → New C-Level Session. Give it a Session title and the Objective (the business question, constraints and what a good outcome looks like). Select at least two executives, choose a Session strategy, a Chair (the CEO by default), an optional Project, and attach up to five documents. Press Convene.",
        image: { name: "session-new", alt: "The new session form with title, objective, executives and strategy", caption: DEMO },
      },
      {
        title: "Watch it run",
        icon: Play,
        body: "The executives answer one stage at a time. A progress line shows where things are, for example “Stage 1 of 2 · Independent positions · 2 of 3 executives finished”. You can leave or reload the page: the round picks up where it left off when you come back.",
        image: { name: "session-progress", alt: "A session in progress with the stage and progress bar", caption: DEMO },
      },
      {
        title: "Read the outcome",
        icon: Sparkles,
        body: "The transcript shows each position, then the CEO synthesis. On the right, the Decision record shows the proposed recommendation with confidence and risks. Use Create minutes or Create decision memo to turn it into a report, and Review & approve to take it to the Decisions page.",
      },
      {
        title: "Ask follow-up questions",
        icon: MessageSquare,
        body: "Below the transcript, choose a strategy button (Ask everyone, CEO synthesis, Challenge assumptions, Financial review, Legal / risk review, Technical review, People / operations, Communications, Impact review, Seek consensus, Preserve dissent, Executive vote, Discuss, then vote), write your question and press Convene (or Ctrl/⌘ + Enter). Use Call on to ask just one executive. Stop session ends a round; what was said is kept.",
        image: { name: "session-controls", alt: "The session controls with strategy buttons and the question box", caption: DEMO },
      },
    ],
    symbols: [
      { kind: "badge", text: "IN SESSION", tone: "warn", meaning: "A round is running right now." },
      { kind: "badge", text: "PROPOSED", tone: "gold", meaning: "The decision waits for a person to approve it." },
      { kind: "icon", icon: Square, label: "Stop session", meaning: "End the current round; everything said so far is kept." },
      { kind: "icon", icon: Globe, label: "Web research", meaning: "That answer used web research; its sources are listed at the end." },
    ],
    tips: [
      "If an executive could not answer, a “Retry … analysis?” (or “Retry … vote?”) link appears: it asks that executive again on the same question.",
      "Rate session answers with 👍 / 👎 too. Corrections become lessons for that executive.",
    ],
    related: ["executive-votes", "decisions", "reports"],
  },
  {
    slug: "executive-votes",
    title: "Executive votes: choose between options",
    category: "Leadership",
    icon: Vote,
    minutes: 5,
    summary: "Have every executive score your options, see the tally, and get the CEO's pick.",
    who: "Owners, Admins, Executives and Members",
    overview:
      "Use a vote when you have a choice to make between paths. Each executive scores every option from 1 to 10 from their role's point of view and votes for one with a confidence level; the CEO then recommends one option. With “Discuss, then vote”, each executive gives a short position first so the votes are informed.",
    flow: [
      { icon: ListChecks, label: "Write the options" },
      { icon: Vote, label: "Executives vote" },
      { icon: Sparkles, label: "CEO recommends" },
      { icon: CheckCircle2, label: "You choose" },
    ],
    steps: [
      {
        title: "Write your options",
        icon: ListChecks,
        body: "In a session, choose Executive vote (or Discuss, then vote). Enter each possible path as one short line, e.g. “Raise a $1.5M seed extension”. Use Add option for up to six, or Suggest options to have the CEO draft them from your question, then edit. If you leave the fields empty, the executives vote on A: Proceed and B: Do not proceed.",
        image: { name: "session-controls", alt: "Option fields A, B and C with Add option and Suggest options", caption: DEMO },
      },
      {
        title: "Read each vote",
        icon: Vote,
        body: "Every executive's vote appears as a short card: the option chosen, their confidence and the reason. Show full scoring opens their full scoring table.",
        image: { name: "vote-card", alt: "A vote card showing the option chosen, confidence and reason", caption: DEMO },
      },
      {
        title: "See the tally",
        icon: BadgeCheck,
        body: "The Executive vote panel on the right shows every option's wording, how many votes it got, its average score and confidence, a CEO recommends badge and a notice if votes are tied. Tap an executive under How each executive voted to see their reason and scores. Earlier votes are under Previous votes.",
        image: { name: "vote-panel", alt: "The vote results panel with bars, scores and how each executive voted", caption: DEMO },
      },
      { title: "Make the call", icon: CheckCircle2, body: "The executives only recommend. On the Decisions page, choose which option to adopt (the CEO's pick is pre-selected) and press Approve with this option." },
    ],
    symbols: [
      { kind: "badge", text: "CEO RECOMMENDS", tone: "gold", meaning: "The option the CEO recommends after the vote." },
      { kind: "badge", text: "CHOSEN", tone: "ok", meaning: "The option a person approved." },
    ],
    related: ["c-level-sessions", "decisions"],
  },

  /* ------------------------------------------------------------------ */
  /* Intelligence                                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: "decisions",
    title: "Decisions: approve what the C-Level recommends",
    category: "Intelligence",
    icon: Gavel,
    minutes: 4,
    summary: "Review recommendations, choose an option, approve, and keep a decision memory.",
    who: "Everyone can read; Owners, Admins and Executives approve",
    open: { href: "/decisions", label: "Open Decisions" },
    overview:
      "Every session synthesis creates a structured decision: the question, options, recommendation, rationale, risks and confidence. It stays PROPOSED until a person acts. Approved decisions are saved to C-Level Memory, so all seven executives remember them.",
    flow: [
      { icon: Gavel, label: "Review" },
      { icon: ListChecks, label: "Choose option" },
      { icon: CheckCircle2, label: "Approve" },
      { icon: Brain, label: "Remembered" },
    ],
    steps: [
      {
        title: "Review a decision",
        icon: Gavel,
        body: "Each card shows the status, confidence, question, recommendation, rationale, options and risks. View session takes you to the full discussion.",
        image: { name: "decisions", alt: "A decision card with options, Adopt selector and Approve button", caption: DEMO },
      },
      {
        title: "Choose and approve",
        icon: CheckCircle2,
        body: "If there were options, pick the one to adopt in the Adopt list (the CEO's recommendation is pre-selected), then press Approve with this option. Or mark it Deferred or Rejected.",
      },
      { title: "Share it", icon: FileText, body: "Decision memo creates a report with the question, the recommendation, how the C-Level voted, risks and status, ready to export as PDF or Word." },
    ],
    symbols: [
      { kind: "badge", text: "PROPOSED", tone: "gold", meaning: "Waiting for a person." },
      { kind: "badge", text: "UNDER REVIEW", tone: "warn", meaning: "Being considered." },
      { kind: "badge", text: "APPROVED", tone: "ok", meaning: "Adopted, and saved to C-Level Memory." },
    ],
    related: ["c-level-sessions", "executive-votes", "c-level-memory"],
  },
  {
    slug: "c-level-memory",
    title: "C-Level Memory: your organization's knowledge",
    category: "Intelligence",
    icon: Brain,
    minutes: 6,
    summary: "Add facts, confirm what the executives propose, and control who sees what.",
    who: "Everyone can read; Members and above add; Owners, Admins and Executives verify and delete",
    open: { href: "/memory", label: "Open C-Level Memory" },
    overview:
      "C-Level Memory is not chat history. It holds facts, decisions, commitments and lessons about your organization, each with where it came from. All seven executives search it for every answer, but only the parts relevant to the question; each one ranks its own focus areas first. Anything an A.I. Executive concludes arrives as PROPOSED and never becomes organizational fact until a person confirms it.",
    flow: [
      { icon: BookmarkPlus, label: "Add or save" },
      { icon: BadgeCheck, label: "Verify" },
      { icon: Brain, label: "Used in answers" },
    ],
    steps: [
      {
        title: "Browse and search",
        icon: Search,
        body: "Search C-Level Memory at the top, and filter by status and category. Click a record to open the Memory inspector with its full provenance: source, date, creator, verifier, confidence and visibility.",
        image: { name: "memory", alt: "C-Level Memory with search, filters, records and the add form", caption: DEMO },
      },
      {
        title: "Add knowledge",
        icon: BookmarkPlus,
        body: "Use Add to C-Level Memory: a Title and Content, a Category, Importance (1 to 5), Visibility (Organization, Leadership only or Owner only), an optional Project, and which executives it is Most relevant to. Things you add yourself count as confirmed. Every executive can use it; Visibility decides for whom: an executive only uses a Leadership only entry when answering the Owner, an Admin or an Executive, and an Owner only entry when answering the Owner.",
      },
      {
        title: "Confirm what's proposed",
        icon: BadgeCheck,
        body: "Saved answers and uploaded documents arrive as PROPOSED. Open one in the inspector and use Verify if it is right, Edit to correct it, Pin to make it more likely to be used, or Archive to retire it (Restore brings it back).",
        image: { name: "memory-inspector", alt: "The memory inspector with Verify, Pin and Archive", caption: DEMO },
      },
    ],
    symbols: [
      { kind: "badge", text: "PROPOSED", tone: "gold", meaning: "From an A.I. Executive or a document: not yet confirmed." },
      { kind: "badge", text: "VERIFIED", tone: "ok", meaning: "Confirmed by a person." },
      { kind: "badge", text: "USER CONFIRMED", tone: "ok", meaning: "Added or edited by a person." },
      { kind: "icon", icon: Pin, label: "Pinned", meaning: "Given extra weight when executives search memory." },
    ],
    tips: ["Most relevant to makes an entry come up more readily for the executives you tick; it does not hide it from the others."],
    related: ["files", "decisions", "configuring-executives"],
  },
  {
    slug: "c-level-studio",
    title: "C-Level Studio: request finished work",
    category: "Intelligence",
    icon: Workflow,
    minutes: 5,
    summary: "Describe what you need; the right executive leads it and delivers a document for review.",
    who: "Owners, Admins, Executives and Members",
    open: { href: "/studio", label: "Open C-Level Studio" },
    overview:
      "Studio produces finished work: strategies, plans, models, campaigns, policies, research and reports. You describe the work; the platform routes it to the best lead executive with contributors, and the lead writes it in steps. You review, ask for revisions and save it as a report.",
    flow: [
      { icon: ClipboardList, label: "Describe" },
      { icon: ArrowRightLeft, label: "Routed to a lead" },
      { icon: Workflow, label: "Produced" },
      { icon: CheckCircle2, label: "Review & approve" },
    ],
    steps: [
      {
        title: "Describe the work",
        icon: ClipboardList,
        body: "Write what you need in the box, or click a suggestion such as “Develop a fundraising strategy.” Leave Automatic routing on (or pick a lead executive), set the priority (Low, Normal, High, Urgent) and an optional project. Press Assign to the C-Level.",
        image: { name: "studio", alt: "The Studio request box with suggestions, routing, priority and project", caption: DEMO },
      },
      { title: "Let it be written", icon: Workflow, body: "The lead executive writes the work in short steps; keep the page open to watch it progress, or come back later. In production and Awaiting your review show where each piece is." },
      {
        title: "Review it",
        icon: CheckCircle2,
        body: "When it is ready: Approve as Finished Work, or Request revision with a note on what to change (a new version is written). Save as Report adds it to Reports; Attach to Executive Comms and Bring to C-Level Session share it. Version history keeps every version.",
        image: { name: "studio-job", alt: "A finished Studio piece with the Review actions", caption: DEMO },
      },
    ],
    tips: ["Request report and Assign work in an executive's office open Studio with that executive as lead."],
    related: ["reports", "executive-offices"],
  },
  {
    slug: "reports",
    title: "Reports: briefs, minutes and memos",
    category: "Intelligence",
    icon: FileText,
    minutes: 3,
    summary: "Read, export (PDF, Word, Markdown) and manage your organization's reports.",
    who: "Everyone can read; creators and Owners, Admins and Executives can delete",
    open: { href: "/reports", label: "Open Reports" },
    overview: "Reports collects every brief, review, set of session minutes, decision memo and saved Studio work. Each has a lead executive, contributors, a version and its sources.",
    flow: [
      { icon: FileText, label: "Open" },
      { icon: FileDown, label: "Export" },
      { icon: Send, label: "Share" },
    ],
    steps: [
      {
        title: "Find a report",
        icon: FileText,
        body: "Reports are listed newest first with their type and lead executive. Generate report opens Studio to create a new one. Reports also come from Studio (Save as Report), sessions (Create minutes) and decisions (Decision memo).",
        image: { name: "reports", alt: "The Reports list", caption: DEMO },
      },
      {
        title: "Export it",
        icon: FileDown,
        body: "Open a report and use Export: Download PDF or Download Word for a branded document with page numbers, or Download Markdown for plain text. Sources lists any web pages it cites.",
        image: { name: "report-detail", alt: "A report with Export, Lead executive and Manage panels", caption: DEMO },
      },
      { title: "Delete when needed", icon: Settings, body: "Under Manage, Delete report removes it for everyone after you confirm. Linked sessions, decisions and Studio work are kept." },
    ],
    related: ["c-level-studio", "decisions"],
  },
  {
    slug: "files",
    title: "Files: company documents for all seven executives",
    category: "Intelligence",
    icon: Files,
    minutes: 3,
    summary: "Upload company documents once; every executive draws on them.",
    who: "Everyone can read; all but Viewers and Advisors upload; Owners, Admins and Executives delete",
    open: { href: "/files", label: "Open Files" },
    overview: "Files holds your company documents: plans, policies, pitch decks, financials and the foundational documents added when your organization was set up. All seven executives search them for every question and cite what they use as [D1], [D2]. Files are private to your organization. For knowledge only one executive should use, upload it in that executive's Learning tab instead.",
    flow: [
      { icon: Upload, label: "Upload" },
      { icon: BadgeCheck, label: "Processed" },
      { icon: Users, label: "Used by executives" },
    ],
    steps: [
      {
        title: "Upload",
        icon: Upload,
        body: "Drag files onto the Upload box or click to browse. Supported: PDF, DOCX, PPTX, XLSX, CSV, TXT, MD, images and common audio and video up to 20 MB. The text of PDF, Word, PowerPoint, Excel, CSV, TXT and Markdown files is read on upload, so the executives can use it. Images, audio and video are stored as they are.",
        image: { name: "files", alt: "The Files library with the upload box", caption: DEMO },
      },
      { title: "Every executive uses them", icon: Users, body: "You don't need to do anything else: for each question, every executive picks the most relevant passages from your company documents. You can also attach up to five files when you set up a C-Level Session. A summary of each new document appears in C-Level Memory as PROPOSED for you to confirm." },
    ],
    symbols: [{ kind: "badge", text: "READY", tone: "ok", meaning: "Processed: its text can be used by the executives." }],
    tips: ["Downloads use short-lived private links: never permanent public ones."],
    related: ["executive-library", "c-level-sessions", "c-level-memory"],
  },
  {
    slug: "projects",
    title: "Projects: one place per initiative",
    category: "Intelligence",
    icon: FolderKanban,
    minutes: 3,
    summary: "Group sessions, decisions, memory, reports and Studio work for one initiative.",
    who: "Everyone can read; Owners, Admins and Executives manage",
    open: { href: "/projects", label: "Open Projects" },
    overview: "A project workspace shows everything about one initiative together: sessions, decisions, memory, reports, Studio work, files and conversations.",
    flow: [
      { icon: FolderKanban, label: "Create" },
      { icon: ArrowRightLeft, label: "Link work" },
      { icon: LayoutDashboard, label: "See it together" },
    ],
    steps: [
      {
        title: "Create a project",
        icon: FolderKanban,
        body: "Under New project, enter a Project name and Description and press Create project.",
        image: { name: "projects", alt: "Project workspaces with the new project form", caption: DEMO },
      },
      { title: "Link work to it", icon: ArrowRightLeft, body: "Choose the project when you set up a C-Level Session, request Studio work or add to C-Level Memory. It then shows in the project's workspace, and executives give that project's context extra weight." },
    ],
    related: ["c-level-sessions", "c-level-studio"],
  },

  /* ------------------------------------------------------------------ */
  /* Make your C-Level better                                            */
  /* ------------------------------------------------------------------ */
  {
    slug: "teaching-your-executives",
    title: "Learning: each executive's own intelligence",
    category: "Make your C-Level better",
    icon: GraduationCap,
    minutes: 6,
    summary: "Give one executive its own documents, knowledge and lessons, used by that executive only.",
    who: "Everyone except Viewers rates answers; Owners and Admins add documents, knowledge and lessons",
    overview:
      "Each of the seven executives has a Learning tab: its own intelligence. Documents you upload there, knowledge you write there and lessons it learns are used by that executive only. They don't appear in Files or C-Level Memory, and the other executives don't see them. Every executive still draws on your company documents in Files as well. Lessons are short rules, like “Always state runway in months under base and downside scenarios”, drafted from your 👍/👎 feedback or written by an admin.",
    flow: [
      { icon: ThumbsDown, label: "Rate & explain" },
      { icon: Sparkles, label: "Lesson drafted" },
      { icon: CheckCircle2, label: "Admin approves" },
      { icon: GraduationCap, label: "Applied from now on" },
    ],
    steps: [
      {
        title: "Open the Learning tab",
        icon: GraduationCap,
        body: "In an executive's office, open Learning. You'll see what only this executive uses (its own documents and knowledge), lessons waiting for approval, active lessons and recent feedback.",
        image: { name: "learning", alt: "The CFO's Learning tab with its own documents, lessons and upload box", caption: DEMO },
      },
      { title: "Upload documents for this executive", icon: Upload, body: "Owners and Admins drag files onto Upload documents for the CFO (or whichever executive). PDF, Word, PowerPoint, Excel, CSV, TXT and Markdown work. The text of each file (up to about 20,000 characters) becomes that executive's private knowledge. A scanned PDF has no text to read, so upload a version with selectable text." },
      { title: "Write knowledge", icon: BookmarkPlus, body: "Under Write knowledge, choose Playbook (how we do something), Framework (a way of thinking) or Reference (facts, figures, policies), give it a title and write it as you would brief a new senior hire. Items can be read, edited, turned off or deleted under Documents & knowledge only the CFO uses." },
      {
        title: "Rate the answer",
        icon: ThumbsDown,
        body: "Under any answer (in a conversation or a session), press 👎. Write what it should have said or done differently and press Send feedback. Or press 👍 and say what worked. “Just rate it” records the rating without a lesson.",
        image: { name: "feedback-box", alt: "The feedback box after pressing thumbs down", caption: DEMO },
      },
      {
        title: "Approve the lesson",
        icon: CheckCircle2,
        body: "Admins get a notification. Open the executive's office → Learning tab (a number shows how many are waiting). Under Waiting for approval, edit the title or wording if needed, then Approve lesson or Dismiss.",
      },
      { title: "Teach a lesson directly", icon: GraduationCap, body: "Admins can write a lesson straight away with Teach the CFO a lesson (or whichever executive). Under Active lessons you can edit or retire a lesson at any time." },
    ],
    symbols: [
      { kind: "badge", text: "SUGGESTED", tone: "gold", meaning: "Drafted from feedback and waiting for an admin." },
      { kind: "badge", text: "ACTIVE", tone: "ok", meaning: "Approved: applied to every future answer." },
    ],
    tips: ["Write corrections as general rules (“always…”, “when…”), not about one number, so they help every future answer.", "Documents every executive should use belong in Files, not in one executive's Learning tab."],
    related: ["executive-library", "configuring-executives"],
  },
  {
    slug: "executive-library",
    title: "The Library: what every executive also draws on",
    category: "Make your C-Level better",
    icon: BookOpen,
    minutes: 4,
    summary: "See the company documents and built-in frameworks each executive uses besides its own knowledge.",
    who: "Everyone reads; Owners and Admins turn frameworks on or off",
    overview:
      "Besides its own knowledge (Learning tab), every executive draws on two shared sources, shown in its Library tab: your company documents from Files (cited as [D1], [D2]) and built-in frameworks for its role, for example the 13-week cash flow for the CFO or a contract review checklist for the CLO (cited as [L1], [L2]). For each question it uses only the few most relevant passages.",
    flow: [
      { icon: Files, label: "Company documents" },
      { icon: BookOpen, label: "Built-in frameworks" },
      { icon: Search, label: "Relevant passages used" },
    ],
    steps: [
      {
        title: "Open the library",
        icon: BookOpen,
        body: "In an executive's office, open the Library tab. Company documents (shared by all seven) are listed first, then the Built-in frameworks for the role. Where knowledge goes, on the right, shows which tab to use for what.",
        image: { name: "library", alt: "The CFO's Library with company documents and built-in frameworks", caption: DEMO },
      },
      { title: "Add company documents in Files", icon: Upload, body: "To add or remove a company document, use Files (Add or manage in Files). Every executive picks it up automatically: there is nothing to copy into each library. For a document only one executive should use, upload it in that executive's Learning tab." },
      { title: "Keep frameworks relevant", icon: SlidersHorizontal, body: "Owners and Admins can turn off any built-in framework they don't want used. Only turned-on frameworks are used." },
    ],
    symbols: [
      { kind: "badge", text: "PLAYBOOK", tone: "neutral", meaning: "How your organization does something." },
      { kind: "badge", text: "FRAMEWORK", tone: "neutral", meaning: "A way of thinking about a problem." },
      { kind: "badge", text: "REFERENCE", tone: "neutral", meaning: "Facts, figures or policies." },
      { kind: "badge", text: "OFF", tone: "warn", meaning: "Turned off: not used in answers." },
    ],
    related: ["teaching-your-executives", "files", "configuring-executives"],
  },
  {
    slug: "web-research",
    title: "Web research: current outside facts",
    category: "Make your C-Level better",
    icon: Globe,
    minutes: 3,
    summary: "Let executives look up markets, competitors, regulations and news, with sources.",
    who: "Owners and Admins switch it on or off",
    open: { href: "/settings/tools", label: "Open Tools settings" },
    overview:
      "With web research on, an executive can search the web when a question needs current outside facts. It searches only a few times per answer, never puts confidential details in a search, treats web pages as untrusted information, and lists its sources at the end of the answer.",
    flow: [
      { icon: Settings, label: "Turn it on" },
      { icon: Globe, label: "Searching the web…" },
      { icon: BookOpen, label: "Sources listed" },
    ],
    steps: [
      {
        title: "Turn it on",
        icon: Settings,
        body: "Settings → Tools & MCP → Web research card: Turn on for all executives (or Turn off for all). To change one executive, use Settings → A.I. C-Level → Configure → Tools.",
        image: { name: "tools", alt: "The Web research card in Tools settings", caption: DEMO },
      },
      { title: "See it in action", icon: Globe, body: "Ask something current, such as “What is the UK SaaS market size this year?”. You will see “Searching the web…”, and the answer ends with a Sources list of links. Session answers that used the web show a Web research badge." },
    ],
    symbols: [{ kind: "badge", text: "WEB RESEARCH", tone: "info", meaning: "This answer used web research; see its Sources." }],
    tips: ["It needs a working Anthropic (Claude) key, and web search allowed on your Anthropic account. Each search costs about $0.01."],
    related: ["ai-models-and-connections", "executive-offices"],
  },

  /* ------------------------------------------------------------------ */
  /* For owners & admins                                                 */
  /* ------------------------------------------------------------------ */
  {
    slug: "team-and-roles",
    title: "Team and roles: who can do what",
    category: "For owners & admins",
    icon: UserPlus,
    minutes: 4,
    summary: "Invite your team and give each person the right role.",
    who: "Owners and Admins",
    open: { href: "/settings/team", label: "Open Team settings" },
    overview: "Invite people by email and give each one a role. Roles decide what they can see and do; the platform checks them on every action.",
    flow: [
      { icon: UserPlus, label: "Invite" },
      { icon: ShieldCheck, label: "Choose a role" },
      { icon: Users, label: "They join" },
    ],
    steps: [
      {
        title: "Invite someone",
        icon: UserPlus,
        body: "Settings → Team → Invite a team member: enter their Email, choose a Role and press Send invitation. They receive an email to join. You need to have verified your own email first.",
        image: { name: "settings-team", alt: "Team settings with the invite form and member list", caption: DEMO },
      },
      { title: "Change or remove", icon: SlidersHorizontal, body: "In the member list, change a person's role or press Remove. Removing someone never deletes the organization's data." },
    ],
    symbols: [
      { kind: "badge", text: "OWNER", tone: "gold", meaning: "Everything, including billing, ownership and CEO Leadership Intelligence." },
      { kind: "badge", text: "ADMIN", tone: "gold", meaning: "Manages the team, settings, executives, A.I. models, tools and integrations." },
      { kind: "badge", text: "EXECUTIVE", tone: "neutral", meaning: "Full use, plus verifying memory, approving decisions, managing projects and deleting files and reports." },
      { kind: "badge", text: "MEMBER", tone: "neutral", meaning: "Uses executives, Comms, sessions, Studio, memory, files and reports." },
      { kind: "badge", text: "ADVISOR", tone: "neutral", meaning: "Talks to executives and uses Comms; otherwise read-only." },
      { kind: "badge", text: "VIEWER", tone: "neutral", meaning: "Read-only." },
    ],
    related: ["organization-settings", "configuring-executives"],
  },
  {
    slug: "configuring-executives",
    title: "Configuring an executive",
    category: "For owners & admins",
    icon: SlidersHorizontal,
    minutes: 6,
    summary: "Shape each executive's role, reasoning, skills, memory access, tools and model.",
    who: "Owners and Admins",
    open: { href: "/settings/c-level", label: "Open A.I. C-Level settings" },
    overview: "Every executive is configured in the database, not hard-coded. Settings → A.I. C-Level → Configure lets you change how one executive thinks, what it knows about and what it can use.",
    flow: [
      { icon: Users, label: "Pick an executive" },
      { icon: SlidersHorizontal, label: "Adjust" },
      { icon: CheckCircle2, label: "Save" },
    ],
    steps: [
      { title: "Identity and persona", icon: Users, body: "Change the title, functional mandate and description; then the persona: core question, north star, communication and decision style, reasoning framework, output preferences, risk constraints and system instructions. Be specific, e.g. “Always give base, upside and downside cases.”" },
      { title: "Model and effort", icon: Sparkles, body: "Choose the provider and model, a fallback, and the reasoning effort (low to max). Higher effort means deeper but slower and more expensive answers; very high effort can make long conversations hit the time limit." },
      {
        title: "Skills and memory focus",
        icon: Brain,
        body: "Skills: one per line as “Name — what it covers”. Memory focus: every executive draws on all of C-Level Memory; tick the areas this executive should rank first, or choose No particular focus.",
        image: { name: "configure-memory", alt: "The Memory focus section with focus-area checkboxes", caption: DEMO },
      },
      { title: "Tools", icon: Plug, body: "Tick the tools this executive may use, such as Web research. Tools marked “requires approval” always go through a human approval. Press Save executive configuration." },
    ],
    tips: ["To give one executive its own knowledge or correct how it works, use its Learning tab; documents for all seven go in Files. Both are quicker than rewriting the profile."],
    related: ["executive-library", "teaching-your-executives", "ai-models-and-connections"],
  },
  {
    slug: "ai-models-and-connections",
    title: "A.I. models and connections",
    category: "For owners & admins",
    icon: KeyRound,
    minutes: 4,
    summary: "Connect Claude, check the connection, and watch usage and cost.",
    who: "Owners and Admins",
    open: { href: "/settings/ai-models", label: "Open AI Models settings" },
    overview:
      "The executives run on Claude (Anthropic). OpenAI is an optional backup. Keys are stored on the server only (in your hosting environment variables) and are never shown in the browser. Without a key, the platform runs in simulation: answers are labelled templates.",
    flow: [
      { icon: KeyRound, label: "Add the key" },
      { icon: Plug, label: "Test connection" },
      { icon: LayoutDashboard, label: "Watch usage" },
    ],
    steps: [
      { title: "Add the key", icon: KeyRound, body: "Create a key at console.anthropic.com → API Keys (with credit on the account). In Netlify: Site configuration → Environment variables → ANTHROPIC_API_KEY, paste only the key, save, then Deploys → Trigger deploy → Deploy site." },
      {
        title: "Test the connection",
        icon: Plug,
        body: "Settings → AI Models → Providers → Test connection. It explains exactly what is wrong if it fails (rejected key, no credit, wrong variable…) and shows a masked hint of the saved key so you can compare it with your console.",
        image: { name: "ai-models", alt: "The Providers card with Test connection buttons", caption: `${DEMO} Shows “Not configured” because the demo has no keys.` },
      },
      { title: "Watch usage", icon: LayoutDashboard, body: "The same page lists each executive's model and effort, and Usage shows requests, tokens and estimated cost for the last 500 requests." },
    ],
    symbols: [
      { kind: "badge", text: "CONFIGURED", tone: "ok", meaning: "A key is saved (use Test connection to confirm it works)." },
      { kind: "badge", text: "NOT CONFIGURED", tone: "warn", meaning: "No key is saved for this provider." },
    ],
    related: ["web-research", "configuring-executives", "troubleshooting"],
  },
  {
    slug: "organization-settings",
    title: "Organization profile and settings",
    category: "For owners & admins",
    icon: Settings,
    minutes: 5,
    summary: "Tell the executives who you are, add CEO leadership intelligence, and check email and security.",
    who: "Owners and Admins (CEO Leadership Intelligence: Owner only)",
    open: { href: "/settings/organization", label: "Open Organization settings" },
    overview: "The more the executives know about your organization, the better their advice. The Organization profile is read before every answer.",
    flow: [
      { icon: Building2, label: "Organization profile" },
      { icon: Sparkles, label: "CEO intelligence" },
      { icon: Mail, label: "Email" },
      { icon: ShieldCheck, label: "Security" },
    ],
    steps: [
      {
        title: "Organization profile",
        icon: Building2,
        body: "Settings → Organization: name and industry, then the Organization Constitution: mission, vision, values, business model, priorities, risk tolerance, brand voice, audiences, objectives, key relationships, restrictions and decision principles. Fill it in detail.",
        image: { name: "organization", alt: "The Organization settings with the constitution fields", caption: DEMO },
      },
      {
        title: "CEO Leadership Intelligence",
        icon: Sparkles,
        body: "Owner only. Add your principles, past decisions, writing, speeches, interviews, preferences and history so the A.I. CEO reflects how you lead. Each entry can be included or excluded, or removed.",
        image: { name: "ceo-intelligence", alt: "CEO Leadership Intelligence entries", caption: DEMO },
      },
      { title: "Email delivery", icon: Mail, body: "Settings → Email delivery shows whether verification, invitation and password-reset emails can be sent, and lets you send a test email to yourself.", image: { name: "email", alt: "Email delivery status and test email", caption: DEMO } },
      { title: "Security", icon: ShieldCheck, body: "Settings → Security: change your password, sign out of all other sessions, and review recent security activity.", image: { name: "security", alt: "Security settings", caption: DEMO } },
    ],
    related: ["team-and-roles", "configuring-executives"],
  },

  /* ------------------------------------------------------------------ */
  /* Help                                                                */
  /* ------------------------------------------------------------------ */
  {
    slug: "troubleshooting",
    title: "Troubleshooting and common questions",
    category: "Help",
    icon: LifeBuoy,
    minutes: 5,
    summary: "What common labels and messages mean, and what to do about them.",
    who: "Everyone",
    overview: "Most questions come down to a few things: whether an A.I. key is connected, who is allowed to do what, and the time limits on long work. Here is what to do.",
    flow: [
      { icon: Search, label: "Find the message" },
      { icon: LifeBuoy, label: "Read the fix" },
      { icon: CheckCircle2, label: "Try again" },
    ],
    steps: [
      { title: "Answers say “Simulated response — demo mode”", icon: Sparkles, body: "No A.I. key is connected, so the platform shows labelled templates. An Owner or Admin connects Claude in the hosting settings (see A.I. models and connections). New answers are then real; old ones stay labelled as simulated." },
      { title: "Test connection fails", icon: KeyRound, body: "Read the message: it says whether the key was rejected (create a new one), the account has no credit (add credit), or the key is in the wrong variable. After changing a key in Netlify, trigger a new deploy." },
      { title: "“The executives are still answering the previous question”", icon: Users, body: "A session round is running in another window or tab. Wait a minute or press Stop session there. A round that was interrupted resumes when you reopen the session." },
      { title: "An executive “could not complete the analysis”", icon: RotateCcw, body: "Use the Retry link next to the message to ask that executive again on the same question (or the same vote)." },
      { title: "“Web research is not enabled”", icon: Globe, body: "Web search is switched off on your Anthropic account; an administrator can turn it on in the Anthropic console. Executives still answer from your own information." },
      { title: "A button is missing or greyed out", icon: ShieldCheck, body: "Your role may not include that action; see Team and roles. Ask an Owner or Admin to change your role if you need it." },
      { title: "Emails don't arrive", icon: Mail, body: "Check your spam folder. An Admin can open Settings → Email delivery to check the status and send a test email." },
      { title: "A long piece of Studio work takes a while", icon: Workflow, body: "Studio writes in short steps; keep the page open to watch it, or come back later. If it fails, use Retry on the work's page." },
    ],
    related: ["ai-models-and-connections", "team-and-roles", "getting-started"],
  },
];

export function tutorialBySlug(slug: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.slug === slug);
}
