# Executive Learning and the Executive Library

Two ways to make each A.I. Executive better at its job over time without retraining the model: **lessons** (from feedback) and the **Executive Library** (reference knowledge). Both are per executive and per organization, and both are bounded when they reach the model.

## Feedback → lessons (`src/server/executives/learning.ts`)
1. Anyone who can use the executives (`executives.use`) rates an answer 👍/👎. Ratings work in executive conversations (on the person's own messages) and on executive messages in C-Level Sessions (`FeedbackButtons`). Each person gets one rating per answer; rating again replaces it. Votes and failures are recorded in `executive_feedback`.
2. If the person writes what the answer should have said or done (or what worked), the note is distilled into a short, general lesson. This uses the `lesson_from_feedback` prompt and the `lesson_drafting` utility task through the gateway. The question, answer and feedback are wrapped as data. If drafting fails, the person's own words are used.
3. A.I.-drafted lessons are **PROPOSED**. Owners and Admins are notified, and they review lessons on the executive's **Learning** tab (`executives.configure`): edit, then **Approve** or **Dismiss**.
4. Only **APPROVED** lessons are applied, as the `leadership_lessons` prompt layer right after the executive profile. At most 20 lessons and 5,000 characters, newest first. Platform rules still take precedence.
5. Admins can also write a lesson directly ("Teach the CFO directly"). It is approved on creation. Active lessons can be edited or retired.

Every answer's metadata records the `lesson_ids` and `library_ids` that informed it (session messages).

## Executive Library (`src/server/executives/library.ts`)
- **Starter frameworks** (`src/config/executives/library.ts`): four or more general, well-established frameworks per role, for example the 13-week cash flow and scenario planning for the CFO, and the contract review checklist for the CLO.
  - They are copied into the organization per executive on first read. Newly shipped starters are added the same way later.
  - Starters can be turned off but not edited or deleted, so a removed starter never comes back.
- **The organization's own knowledge:** playbooks, frameworks and references written by admins, and **documents** whose extracted text is copied in from Files (up to about 20,000 characters).
- **Retrieval:** for each request, enabled items are ranked by lexical similarity to the query, with a small preference for the organization's own items. At most 4 items and about 7,000 characters reach the model, as the `executive_library` layer, cited as [L#] and wrapped as reference data.
- Curated on the executive's **Library** tab (`executives.configure`); everyone else can read it.

## Skills and memory areas
In Settings → A.I. C-Level → Configure, admins can now edit each executive's **skills** ("Name — description" per line; given to the model as its expertise) and **memory areas** (all, or chosen categories). Approved decisions are always shared with every executive (`isSharedDecision`).

## Data and security
Migration 009 adds `executive_feedback`, `executive_lessons` and `executive_library_items`, each with `organization_id` and RLS.
- **Feedback:** members read; a member inserts their own rating; only the author edits or deletes it.
- **Lessons:** members read; members may only propose their own; admins manage.
- **Library:** members read; admins manage.

All access goes through `db()` with the organization from `authorize()`. The server checks that a rated answer belongs to the organization, to that executive and, for private conversations, to the person rating it.
