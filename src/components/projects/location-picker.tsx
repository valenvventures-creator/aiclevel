"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Crosshair, Loader2, MapPin, Search, X } from "lucide-react";
import type * as Leaflet from "leaflet";
import { Input, Label } from "@/components/ui/primitives";
import { goldPin, useLeafletMap } from "./leaflet";

type Place = { label: string; latitude: number; longitude: number };

const round = (n: number) => Math.round(n * 1e6) / 1e6;

async function reverse(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { place?: Place | null };
    return json.place?.label ?? null;
  } catch {
    return null;
  }
}

/**
 * Choose where a project is: search an address, click the map (or drag the
 * pin), or use the device's current location. Submits location_label,
 * latitude and longitude with the surrounding form.
 */
export function LocationPicker({ initial }: { initial?: { label: string | null; latitude: number | null; longitude: number | null } }) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(initial?.latitude != null && initial?.longitude != null ? { lat: initial.latitude, lng: initial.longitude } : null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<"search" | "locate" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const labelTouched = useRef(Boolean(initial?.label));
  const mapRef = useRef<HTMLDivElement>(null);
  const ready = useLeafletMap(mapRef);
  const marker = useRef<Leaflet.Marker | null>(null);

  // Place a point: move the pin and, unless the person typed their own name, fill in the address.
  const place = useRef((lat: number, lng: number, name?: string) => {
    const c = { lat: round(lat), lng: round(lng) };
    setCoords(c);
    setResults(null);
    if (name) {
      setLabel(name);
      labelTouched.current = false;
    } else if (!labelTouched.current) {
      void reverse(c.lat, c.lng).then((found) => found && !labelTouched.current && setLabel(found));
    }
  });

  useEffect(() => {
    if (!ready) return;
    const { map } = ready;
    const onClick = (e: Leaflet.LeafletMouseEvent) => place.current(e.latlng.lat, e.latlng.lng);
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const { L, map } = ready;
    if (!coords) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([coords.lat, coords.lng], { icon: goldPin(L), draggable: true, keyboard: true, title: "Project location (drag to adjust)" }).addTo(map);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        place.current(p.lat, p.lng);
      });
    } else marker.current.setLatLng([coords.lat, coords.lng]);
    map.setView([coords.lat, coords.lng], Math.max(map.getZoom() || 0, 13));
  }, [ready, coords]);

  // A map without a position needs an initial view.
  useEffect(() => {
    if (ready && !coords) ready.map.setView([20, 0], 2);
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function search() {
    const q = query.trim();
    if (q.length < 3) return setNote("Type at least 3 characters of an address or place.");
    setBusy("search");
    setNote(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const json = (await res.json().catch(() => ({}))) as { places?: Place[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Address search failed.");
      setResults(json.places ?? []);
      if (!json.places?.length) setNote("No matches. Try a fuller address, or click the map to place the pin.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Address search failed.");
    } finally {
      setBusy(null);
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // search, don't submit the project form
      void search();
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) return setNote("This browser can't share its location.");
    setBusy("locate");
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(null);
        place.current(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setBusy(null);
        setNote(err.code === err.PERMISSION_DENIED ? "Location access was declined. Search an address or click the map instead." : "Your location couldn't be found. Search an address or click the map instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm">Location <span className="text-ivory-faint">(optional, shows the project on the Projects map)</span></legend>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[12rem] flex-[1_1_100%]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ivory-faint" aria-hidden />
          <label htmlFor="loc-search" className="sr-only">Search an address or place</label>
          <input id="loc-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder="Search an address or place" className="h-10 w-full rounded-xl border border-line-strong bg-ink-900 pl-9 pr-3 text-sm" />
        </div>
        <button type="button" onClick={() => void search()} disabled={busy !== null} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm hover:border-line-gold disabled:opacity-60">
          {busy === "search" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />} Search
        </button>
        <button type="button" onClick={locate} disabled={busy !== null} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm hover:border-line-gold disabled:opacity-60">
          {busy === "locate" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />} Use my location
        </button>
      </div>
      {results && results.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="Matching places">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button type="button" onClick={() => place.current(r.latitude, r.longitude, r.label)} className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gold-400/[0.05]">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden /> <span className="min-w-0">{r.label}</span>
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-[10px] text-ivory-faint">Search by OpenStreetMap Nominatim · © OpenStreetMap contributors</li>
        </ul>
      )}
      {note && <p role="status" className="text-xs text-warn">{note}</p>}
      <div ref={mapRef} className="ta-map h-64 w-full overflow-hidden rounded-2xl border border-line" role="application" aria-label="Map: click to place the project's pin; drag the pin to adjust" />
      <div className="space-y-1.5">
        <div>
          <Label htmlFor="p-location">Place name</Label>
          <Input id="p-location" name="location_label" value={label} onChange={(e) => { setLabel(e.target.value); labelTouched.current = true; }} maxLength={300} placeholder={coords ? "e.g. Head office, Austin" : "Search, click the map or use your location first"} />
        </div>
        {coords && (
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] text-ivory-faint">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
            <button type="button" onClick={() => { setCoords(null); setLabel(""); labelTouched.current = false; }} className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-ivory-muted hover:text-risk">
              <X className="size-3.5" aria-hidden /> Clear
            </button>
          </div>
        )}
      </div>
      <input type="hidden" name="latitude" value={coords ? String(coords.lat) : ""} />
      <input type="hidden" name="longitude" value={coords ? String(coords.lng) : ""} />
    </fieldset>
  );
}
