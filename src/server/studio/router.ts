import { DEFAULT_CAPABILITY_KEY, STUDIO_CAPABILITIES, type StudioCapability } from "@/config/studio/capabilities";

/**
 * Deterministic Studio router: scores the request against the capability
 * registry. Multi-word keyword matches weigh more. Returns the best
 * capability plus runners-up so the user can override ("Route to a different
 * executive"). An LLM router (studio_router template) may refine this when a
 * provider is configured; this function is the safe, testable baseline.
 */
export interface RouteResult {
  capability: StudioCapability;
  score: number;
  alternatives: StudioCapability[];
}

export function routeStudioRequest(request: string): RouteResult {
  const text = ` ${request.toLowerCase()} `;
  const scored = STUDIO_CAPABILITIES.map((c) => {
    let score = 0;
    for (const k of c.keywords) if (text.includes(k)) score += k.trim().includes(" ") ? 3 : 2;
    if (text.includes(c.label.toLowerCase())) score += 4;
    return { c, score };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0]?.score > 0 ? scored[0] : { c: STUDIO_CAPABILITIES.find((c) => c.key === DEFAULT_CAPABILITY_KEY)!, score: 0 };
  return {
    capability: best.c,
    score: best.score,
    alternatives: scored.filter((s) => s.c.key !== best.c.key && s.score > 0).slice(0, 3).map((s) => s.c),
  };
}

export function deriveTitle(request: string): string {
  const first = request.trim().split(/[.\n]/)[0].replace(/^(please\s+)?(create|build|draft|write|develop|research|analyze|make|prepare)\s+(a|an|our|the|my)?\s*/i, "");
  const t = first.charAt(0).toUpperCase() + first.slice(1);
  return t.length > 80 ? `${t.slice(0, 77)}…` : t || "Untitled request";
}
