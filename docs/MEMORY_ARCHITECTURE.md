# C-Suite Memory Architecture

C-Suite Memory is organizational intelligence — facts, decisions, commitments, lessons — **not chat history**.

## Record
`MemoryRecord`: title, content, category (19 categories), importance 1–5, status, pinned, source_type + source_id (provenance), created_by, verified_by, confidence, visibility (ORGANIZATION / LEADERSHIP / OWNER_ONLY), executive_relevance, project_id, embeddings, timestamps.

## Status lifecycle
`PROPOSED` (AI-generated or extracted from documents) → `USER_CONFIRMED` (human-entered or edited) → `VERIFIED` (reviewed by OWNER/ADMIN/EXECUTIVE) · `SYSTEM_IMPORTED` (integrations, onboarding) · `ARCHIVED`.
**AI-generated conclusions never become organizational truth automatically.** Saving an executive message to memory creates a PROPOSED record; uploaded documents create PROPOSED "Document:" records.

## Sources
human entry · uploaded document · executive conversation · C-Suite Session · report · external integration · API · research · import (onboarding Constitution).

## Retrieval (`src/server/memory/retrieval.ts`)
Score = (0.55·similarity + 0.15·recency + 0.15·importance + executive-relevance boost + project boost + pin boost) × status weight, after hard filters: organization, not archived, viewer visibility, executive's permitted categories (except approved decisions: VERIFIED or USER_CONFIRMED records in DECISIONS are organization-wide and every executive may recall them, see `isSharedDecision`). Top-k (default 8) only — the full memory is never sent to a model.

- Demo/default: lexical embedding (hashed bag-of-words, 256-d) — labelled as lexical, not semantic.
- Production: provider embeddings into `semantic_embedding vector(1536)`; `match_memory_records()` pre-filters ~40 candidates by cosine distance (HNSW), then the same ranking applies. Embedding worker is Phase 7.

## Permissions
`memory.read` (all roles), `memory.write` (writers), `memory.verify` and `memory.delete` (operators). RLS mirrors visibility tiers. Every create/edit/verify/archive/delete is audited.

## UI
`/memory`: ranked search, status and category filters, inspector with full provenance (source, date, creator, verifier, confidence, visibility, related record), verify / pin / archive / delete / edit.
