-- =============================================================================
-- Migration 008: keep every option's score from an executive's vote
-- Each executive scores every option 1–10 before voting for one. The scores
-- are kept so the vote results can show each option's average score, not
-- just how many executives picked it. Existing RLS policies already cover it.
-- =============================================================================
alter table public.executive_session_votes add column if not exists scores_json jsonb;
