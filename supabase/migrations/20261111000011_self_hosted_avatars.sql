-- =============================================================================
-- Migration 011: executive portraits served with the app
--
-- The seven default portraits were loaded from thoughtauthorities.com, which no
-- longer hosts the product. They now ship in public/brand/executives, so
-- stored avatar URLs on the old host are rewritten to the app-relative path.
-- Demo mode applies the same change at runtime (stored-labels.ts).
-- =============================================================================

update public.ai_executives
set avatar_url = '/brand/executives/' || substr(avatar_url, length('https://thoughtauthorities.com/assets/avatars/') + 1)
where avatar_url like 'https://thoughtauthorities.com/assets/avatars/%';
