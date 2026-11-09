import type { TaskType, WebSource } from "./gateway/types";

/**
 * Web research policy. An executive may search the web only when their
 * Executive Profile grants the "web_research" tool, and only for tasks where
 * outside facts help. Searches are bounded per answer. Search runs on the
 * provider (Claude's server-side web search); results are untrusted data and
 * every answer that used them lists its sources.
 */
export const WEB_RESEARCH_MAX_USES: Partial<Record<TaskType, number>> = {
  executive_conversation: 5,
  studio_production: 3, // a few targeted searches leave time in the first step to start writing
  session_position: 3,
  session_review: 2,
};

export function webResearchFor(exec: { model: { tool_permissions: readonly string[] } }, taskType: TaskType, opts: { continuing?: boolean } = {}): { maxUses: number } | undefined {
  // A continuation only finishes writing; the searching was done in the first part.
  if (opts.continuing) return undefined;
  const maxUses = WEB_RESEARCH_MAX_USES[taskType];
  if (!maxUses || !exec.model.tool_permissions.includes("web_research")) return undefined;
  return { maxUses };
}

/** Merges source updates by URL; a page stays cited once any update cites it. */
export function mergeSources(into: WebSource[], incoming: readonly WebSource[] | undefined): WebSource[] {
  const byUrl = new Map(into.map((s) => [s.url, s]));
  for (const s of incoming ?? []) {
    if (!/^https?:\/\//i.test(s.url)) continue;
    const prev = byUrl.get(s.url);
    byUrl.set(s.url, { url: s.url, title: (s.title || prev?.title || s.url).slice(0, 200), cited: Boolean(prev?.cited || s.cited) });
  }
  return [...byUrl.values()];
}

const mdText = (s: string) => s.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();

/**
 * The "Sources" section appended to an answer that used web research: cited
 * pages first; if the answer cites none, the pages that were consulted.
 */
export function sourcesMarkdown(sources: readonly WebSource[], max = 10): string {
  if (!sources.length) return "";
  const cited = sources.filter((s) => s.cited);
  const list = (cited.length ? cited : sources).slice(0, max);
  const heading = cited.length ? "**Sources (web research)**" : "**Sources consulted (web research)**";
  return `\n\n---\n${heading}\n${list.map((s, i) => `${i + 1}. [${mdText(s.title) || s.url}](${s.url})`).join("\n")}`;
}

/** Removes a previously appended Sources section (e.g. before a revision rewrites the text). */
export function stripSourcesSection(text: string): string {
  return text.replace(/\n*---\n\*\*Sources(?: consulted)? \(web research\)\*\*\n[\s\S]*$/, "").trimEnd();
}
