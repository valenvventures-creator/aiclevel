"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Executive portrait with a graceful monogram fallback when an image
 * (for example a custom avatar URL) cannot be loaded.
 */
export function ExecutiveAvatar({
  src,
  shortTitle,
  accent,
  size = 48,
  status,
  className,
  ring = true,
}: {
  src: string | null;
  shortTitle: string;
  accent: string;
  size?: number;
  status?: "AVAILABLE" | "WORKING" | "IN_SESSION" | "OFFLINE";
  className?: string;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(!src);
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className={cn("relative grid size-full place-items-center overflow-hidden rounded-full bg-ink-800", ring && "ring-1 ring-offset-2 ring-offset-ink-950")}
        style={{ ["--tw-ring-color" as string]: `color-mix(in srgb, ${accent} 55%, transparent)`, background: failed ? `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${accent} 35%, #141820), #0b0d12 70%)` : undefined }}
      >
        {!failed && src ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars may be custom remote URLs; next/image would require every host to be allow-listed
          <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
        ) : (
          <span className="font-display font-semibold tracking-wider" style={{ color: accent, fontSize: Math.max(10, size * 0.28) }}>
            {shortTitle}
          </span>
        )}
      </span>
      {status && (
        <span
          aria-label={`Status: ${status.toLowerCase().replace("_", " ")}`}
          className={cn(
            "absolute bottom-0 right-0 size-3 rounded-full border-2 border-ink-950",
            status === "AVAILABLE" && "bg-ok",
            status === "WORKING" && "animate-pulse-soft bg-gold-400",
            status === "IN_SESSION" && "bg-info",
            status === "OFFLINE" && "bg-ivory-faint",
          )}
        />
      )}
    </span>
  );
}
