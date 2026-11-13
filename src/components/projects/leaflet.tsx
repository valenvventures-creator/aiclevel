"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState, type RefObject } from "react";
import type * as Leaflet from "leaflet";

/**
 * Shared Leaflet setup for project maps. By default tiles come from
 * OpenStreetMap (free, attribution required; https://operations.osmfoundation.org/policies/tiles/)
 * and are darkened with a CSS filter to match the site. For high traffic,
 * set NEXT_PUBLIC_MAP_TILE_URL (and NEXT_PUBLIC_MAP_ATTRIBUTION) to a tile
 * provider of your choice — custom tiles are shown as they are, unfiltered.
 */
const CUSTOM_TILES = process.env.NEXT_PUBLIC_MAP_TILE_URL;
export const TILE_URL = CUSTOM_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

type L = typeof Leaflet;

/** Creates a Leaflet map in `ref` once Leaflet has loaded in the browser; removes it on unmount. */
export function useLeafletMap(ref: RefObject<HTMLDivElement | null>, options: Leaflet.MapOptions = {}) {
  const [ready, setReady] = useState<{ L: L; map: Leaflet.Map } | null>(null);
  useEffect(() => {
    let map: Leaflet.Map | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;
    void import("leaflet").then((mod) => {
      const L = (mod as unknown as { default?: L }).default ?? (mod as unknown as L);
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, worldCopyJump: true, ...options });
      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19, className: CUSTOM_TILES ? "" : "ta-tiles-dark" }).addTo(map);
      // Scroll-wheel zoom only after the person clicks the map, so the page still scrolls past it.
      map.on("click focus", () => map?.scrollWheelZoom.enable());
      map.on("mouseout blur", () => map?.scrollWheelZoom.disable());
      // Maps drawn while hidden (e.g. inside a closed "Edit" section) redraw when they get a size.
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(ref.current);
      setReady({ L, map });
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
    };
    // The map is created once per mount; options are read at creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
  return ready;
}

/** The gold A.I. C-Level map pin. */
export function goldPin(L: L, active = false): Leaflet.DivIcon {
  const fill = active ? "#fff1c4" : "#efba11";
  return L.divIcon({
    className: "ta-pin",
    html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".6"/></filter></defs><path filter="url(#s)" d="M15 1C7.3 1 1.5 6.9 1.5 14.3 1.5 24.6 15 38.5 15 38.5s13.5-13.9 13.5-24.2C28.5 6.9 22.7 1 15 1z" fill="${fill}" stroke="#2a2108" stroke-width="1.5"/><circle cx="15" cy="14.5" r="5" fill="#0b0d12"/></svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    tooltipAnchor: [0, -30],
  });
}

/** Builds a text element without HTML parsing (project names are user-entered). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
