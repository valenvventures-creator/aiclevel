# Executive Learning and the Executive Library

Two ways to make each A.I. Executive better at its job over time without retraining the model: **lessons** (from feedback) and the **Executive Library** (reference knowledge). Both are per executive and per organization, and both are bounded when they reach the model.

## Feedback → lessons (`src/server/executives/learning.ts`)
1. Anyone who can use the executives (`executives.use`) rates an answer 👍/👎. Ratings work in executive conversations (on the person's own messages) and on executive messages in C-Level Sessions (`FeedbackButtons`). Each person gets one rating per answer; rating again replaces it. Votes and failures are recorded in `executive_feedback`.
2. If the person writes what the answer should have said or done (or what worked), the note is distilled into a short, general lesson. This uses the `lesson_from_feedback` prompt and the `lesson_drafting` utility task through the gateway. The question, answer and feedback are wrapped as data. If drafting fails, the person's own words are used.
3. A.I.-drafted lessons are **PROPOSED**. Owners and Admins are notified, and they review lessons on the executive's **Learning** tab (`executives.configure`): edit, then **Approve** or **Dismiss**.
4. Only **APPROVED** lessons are applied, as the `leadership_lessons` prompt layer right after the executive profile. At most 20 lessons and 5,000 characters, newest first. Platform rules still take precedence.
5. Admins can also write a lesson directly ("Teach the CFO directly"). It is approved on creation. Active lessons can be edited or retired.

Every answer's metadata records the `lesson_ids` and `library_ids` that informed it (session messages). Context assembly also returns the company `documentFileIds` used.

## Where an executive's knowledge comes from

| Source | Who uses it | Where it is managed | Cited as |
|---|---|---|---|
| **Its own knowledge**: documents uploaded and knowledge written in its **Learning** tab | That executive only | Learning tab (`executives.configure`) | [L#] |
| **Built-in frameworks** for its role | That executive | Library tab: turn on/off | [L#] |
| **Company documents**: Files tab and onboarding uploads | All seven executives | Files (`files.upload`) | [D#] |
| **C-Level Memory**: facts, decisions, commitments | All seven executives (each ranks its focus areas first); the asking person's visibility applies | Memory | [M#] |

### Private executive documents
- Uploaded with `POST /api/executives/[slug]/documents`. The file is stored with `files.executive_id` set (migration 012), so it is **not listed in Files** (`listCompanyFiles`) and **not added to C-Level Memory**.
- Its extracted text (PDF, DOCX, PPTX, XLSX, CSV, TXT, MD; `src/server/files/extract.ts`) becomes an executive library item (`kind: DOCUMENT`, up to ~20,000 characters). Deleting the item deletes the private file.
- Written knowledge (playbook, framework, reference) is also an executive library item.

### Executive library (`src/server/executives/library.ts`)
- **Starter frameworks** (`src/config/executives/library.ts`): four or more general, well-established frameworks per role, for example the 13-week cash flow and scenario planning for the CFO, and the contract review checklist for the CLO.
  - They are copied into the organization per executive on first read. Newly shipped starters are added the same way later.
  - Starters can be turned off but not edited or deleted, so a removed starter never comes back.
- **Retrieval:** for each request, enabled items are ranked by lexical similarity to the query, with a small preference for the organization's own items. At most 4 items and about 7,000 characters reach the model, as the `executive_library` layer ("your own knowledge").

### Company documents (`src/server/files/company-documents.ts`)
- Every executive searches the organization's company files for each request: documents are split into ~1,600-character passages, and the 3 most relevant passages (at most 2 per file, ~6,000 characters) reach the model as the `company_documents` layer.
- The 80 most recent readable files are considered, the first 60,000 characters of each. Files private to one executive are excluded.
- Documents uploaded before their format was readable get their text read in the background (`backfillDocumentText`, scheduled with `after()` from `requireContext`).

## Skills and memory focus
In Settings → A.I. C-Level → Configure, admins can now edit each executive's **skills** ("Name — description" per line; given to the model as its expertise) and **memory focus** (no particular focus, or chosen categories ranked first). Every executive draws on all of C-Level Memory.

## Data and security
Migration 009 adds `executive_feedback`, `executive_lessons` and `executive_library_items`, each with `organization_id` and RLS.
- **Feedback:** members read; a member inserts their own rating; only the author edits or deletes it.
- **Lessons:** members read; members may only propose their own; admins manage.
- **Library:** members read; admins manage.

All access goes through `db()` with the organization from `authorize()`. The server checks that a rated answer belongs to the organization, to that executive and, for private conversations, to the person rating it.
