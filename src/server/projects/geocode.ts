import "server-only";

/**
 * Address search for project locations, using OpenStreetMap's Nominatim
 * service (https://nominatim.org). Follows its usage policy: an identifying
 * User-Agent, at most one request per second from this server, and cached
 * results. Results are labelled "© OpenStreetMap contributors" in the UI.
 * Set GEOCODER_URL to use another Nominatim-compatible service.
 */
export interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

const BASE = (process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org").replace(/\/+$/, "");
const USER_AGENT = "A.I. C-Level project map (https://www.aiclevel.io)";
const TTL_MS = 24 * 60 * 60_000;
const cache = new Map<string, { at: number; value: Place[] }>();
let nextSlot = 0;

/** Waits for this server's next one-request-per-second slot. */
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1000;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

async function get(path: string): Promise<unknown> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  await throttle();
  const res = await fetch(`${BASE}${path}`, { headers: { "user-agent": USER_AGENT, accept: "application/json", "accept-language": "en" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder answered ${res.status}`);
  return res.json();
}

type Raw = { display_name?: string; lat?: string; lon?: string };

/** Turns Nominatim results into places, dropping anything malformed. Pure. */
export function toPlaces(raw: unknown): Place[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  return (list as Raw[])
    .map((r) => ({ label: String(r.display_name ?? "").slice(0, 300), latitude: Number(r.lat), longitude: Number(r.lon) }))
    .filter((p) => p.label && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180);
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = query.trim().slice(0, 200);
  if (q.length < 3) return [];
  const path = `/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
  const places = toPlaces(await get(path));
  cache.set(path, { at: Date.now(), value: places as never });
  return places;
}

export async function placeAt(latitude: number, longitude: number): Promise<Place | null> {
  const path = `/reverse?format=jsonv2&zoom=16&lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}`;
  const [place] = toPlaces(await get(path));
  return place ?? null;
}
