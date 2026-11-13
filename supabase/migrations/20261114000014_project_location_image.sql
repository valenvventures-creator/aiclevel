-- =============================================================================
-- Migration 014: project location (for the Projects map) and cover image
--
-- projects.location_label   address or place name, as people read it
-- projects.latitude/longitude  WGS 84 coordinates of the project's map pin
-- projects.image_file_id    cover image, stored as a file with purpose PROJECT_IMAGE
-- files.purpose             marks files that serve one feature only (not
--                           company documents; not listed in Files)
-- =============================================================================

alter table public.files
  add column if not exists purpose text check (purpose in ('PROJECT_IMAGE'));

alter table public.projects
  add column if not exists location_label text check (char_length(location_label) <= 300),
  add column if not exists latitude double precision check (latitude between -90 and 90),
  add column if not exists longitude double precision check (longitude between -180 and 180),
  add column if not exists image_file_id uuid references public.files (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add constraint projects_coordinates_pair check ((latitude is null) = (longitude is null));
