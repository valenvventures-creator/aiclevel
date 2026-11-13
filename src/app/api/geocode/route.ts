import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { authorize } from "@/server/organizations/service";
import { rateLimit } from "@/server/auth/rate-limit";
import { placeAt, searchPlaces } from "@/server/projects/geocode";

/**
 * Address search (?q=) and reverse lookup (?lat=&lng=) for project locations.
 * Signed-in people who manage projects only; rate-limited per person.
 */
export async function GET(req: Request) {
  try {
    const ctx = await authorize("projects.manage");
    if (!rateLimit(`geocode:${ctx.user.id}`, 60, 10 * 60_000).ok) return NextResponse.json({ error: "Too many searches. Wait a minute and try again." }, { status: 429 });
    const url = new URL(req.url);
    const q = url.searchParams.get("q");
    try {
      if (q !== null) return NextResponse.json({ places: await searchPlaces(q) });
      const lat = Number(url.searchParams.get("lat"));
      const lng = Number(url.searchParams.get("lng"));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
      return NextResponse.json({ place: await placeAt(lat, lng) });
    } catch (err) {
      console.error("[geocode] lookup failed", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: "Address search is unavailable right now. You can still click the map to place the pin." }, { status: 503 });
    }
  } catch (err) {
    return apiError(err);
  }
}
