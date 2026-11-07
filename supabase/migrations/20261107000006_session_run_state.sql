-- =============================================================================
-- Migration 006: stepwise C-Suite Session rounds
-- A round runs in bounded steps (each well under the host's request limit).
-- run_state holds the round in progress: question, stage reached, partial
-- answers and a short lease. It is null when no round is in progress.
-- Existing RLS policies on executive_sessions already cover this column.
-- =============================================================================
alter table public.executive_sessions add column if not exists run_state jsonb;

-- Sessions left "RUNNING" by the one-shot orchestrator (cut off by the host's
-- request limit) are returned to ACTIVE so they can be continued.
update public.executive_sessions set status = 'ACTIVE' where status = 'RUNNING' and run_state is null;
