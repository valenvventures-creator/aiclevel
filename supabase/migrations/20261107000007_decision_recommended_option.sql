-- =============================================================================
-- Migration 007: record which option the chair recommended after a vote
-- After an Executive Vote, the CEO synthesis names one option. It is stored
-- here so the decision record can show it next to the vote results. When a
-- person approves the decision, chosen_option is set from it if still empty.
-- Existing RLS policies on decisions already cover this column.
-- =============================================================================
alter table public.decisions add column if not exists recommended_option text;
