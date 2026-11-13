"use client";

import { useEffect, useRef } from "react";
import { el, goldPin, useLeafletMap } from "./leaflet";

export interface MapPin {
  id: string;
  name: string;
  status: string;
  location: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
}

const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed", ARCHIVED: "Archived" };

/**
 * Interactive map with a gold pin for each project. Hover shows the name;
 * clicking opens a card with the image, status, place and a link to the
 * project. With one pin it centres on it; with several it fits them all.
 */
export function ProjectsMap({ pins, height = 460, label = "Map of project locations", zoom = 13 }: { pins: MapPin[]; height?: number; label?: string; zoom?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useLeafletMap(ref, { zoomControl: true });

  useEffect(() => {
    if (!ready) return;
    const { L, map } = ready;
    const layer = L.layerGroup().addTo(map);
    for (const p of pins) {
      const marker = L.marker([p.latitude, p.longitude], { icon: goldPin(L), title: p.name, alt: p.name, keyboard: true, riseOnHover: true });
      marker.bindTooltip(el("span", "ta-tip", p.name), { direction: "top", opacity: 1 });
      const card = el("div", "ta-pop");
      if (p.imageUrl) {
        const img = el("img", "ta-pop-img");
        img.src = p.imageUrl;
        img.alt = "";
        img.loading = "lazy";
        card.append(img);
      }
      card.append(el("p", "ta-pop-status", (STATUS_LABEL[p.status] ?? p.status).toUpperCase()), el("p", "ta-pop-name", p.name));
      if (p.location) card.append(el("p", "ta-pop-place", p.location));
      const link = el("a", "ta-pop-link", "Open project →");
      link.href = `/projects/${p.id}`;
      card.append(link);
      marker.bindPopup(card, { maxWidth: 260, minWidth: 200, autoPanPadding: [24, 24] });
      marker.addTo(layer);
    }
    if (pins.length === 1) map.setView([pins[0].latitude, pins[0].longitude], zoom);
    else if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.latitude, p.longitude] as [number, number])), { padding: [48, 48], maxZoom: 12 });
    else map.setView([20, 0], 2);
    return () => {
      layer.remove();
    };
  }, [ready, pins, zoom]);

  return <div ref={ref} role="region" aria-label={label} className="ta-map w-full overflow-hidden rounded-2xl border border-line" style={{ height }} />;
}
