# Projects: images, locations and the map

- **Fields** (migration 014): `projects.location_label`, `latitude`, `longitude` (both or neither), `image_file_id`, `updated_at`; `files.purpose = 'PROJECT_IMAGE'` keeps cover images out of Files and C-Level Memory.
- **Form** (`ProjectForm`, create on /projects, edit on /projects/[id] → "Edit project"): name, description, status (edit), image (`ImagePicker` → `POST /api/projects/images`, PNG/JPG/WebP ≤ 8 MB), location (`LocationPicker`): address search, click or drag the pin, or "Use my location" (browser geolocation, allowed for this site only by `Permissions-Policy: geolocation=(self)`).
- **Map** (`ProjectsMap`, Leaflet 1.9): Projects → Map shows a gold pin per located project, with a tooltip and a card (image, status, place, link). Projects without a location are listed below with "Add location". Each project page shows its own pin.
- **Images** are served by `GET /api/projects/images/[id]` to members of the organization only (`projects.read`).
- **Address search** goes through `GET /api/geocode` (`projects.manage`, rate-limited) to OpenStreetMap Nominatim, following its usage policy: identifying User-Agent, at most one request per second per server, 24-hour cache. `GEOCODER_URL` switches to another Nominatim-compatible service.
- **Tiles**: OpenStreetMap's standard tiles (attribution shown), darkened with a CSS filter to match the site. For heavy traffic, set `NEXT_PUBLIC_MAP_TILE_URL` and `NEXT_PUBLIC_MAP_ATTRIBUTION` to a tile provider of your choice (custom tiles are shown unfiltered).
- **Demo**: the three demo projects get sample locations once per database (`ensureDemoProjectLocations`).
