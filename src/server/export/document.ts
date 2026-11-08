import { Lexer, type Token, type Tokens } from "marked";

/**
 * Format-neutral document model shared by the PDF and Word exporters.
 * Executive output is Markdown; this turns it into structured blocks so each
 * exporter renders real headings, lists and tables rather than raw "#" and "|".
 */

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  link?: string;
}

export type Block =
  | { type: "heading"; level: 1 | 2 | 3 | 4; runs: Run[] }
  | { type: "paragraph"; runs: Run[] }
  | { type: "list"; ordered: boolean; start: number; items: { runs: Run[]; depth: number; checked?: boolean }[] }
  | { type: "table"; header: Run[][]; rows: Run[][][] }
  | { type: "code"; text: string }
  | { type: "quote"; blocks: Block[] }
  | { type: "hr" };

export interface ExportDocument {
  title: string;
  /** e.g. "Fundraising Analysis · Version 2" */
  subtitle: string;
  organization: string;
  leadExecutive: string | null;
  contributors: string[];
  createdAt: string;
  simulated: boolean;
  blocks: Block[];
}

export const AI_DISCLAIMER =
  "Prepared by the A.I. Executives of Thought Authorities A.I. C-Level. This is A.I.-generated analysis, not professional legal, financial, tax or accounting advice. Review before relying on it.";

const decode = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e] ?? _);

function inline(tokens: Token[] | undefined, style: Omit<Run, "text"> = {}): Run[] {
  const out: Run[] = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case "strong":
        out.push(...inline((t as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        out.push(...inline((t as Tokens.Em).tokens, { ...style, italic: true }));
        break;
      case "del":
        out.push(...inline((t as Tokens.Del).tokens, style));
        break;
      case "codespan":
        out.push({ ...style, code: true, text: decode((t as Tokens.Codespan).text) });
        break;
      case "link": {
        const l = t as Tokens.Link;
        out.push(...inline(l.tokens, { ...style, link: l.href }));
        break;
      }
      case "br":
        out.push({ ...style, text: "\n" });
        break;
      case "text": {
        const tt = t as Tokens.Text;
        if (tt.tokens?.length) out.push(...inline(tt.tokens, style));
        else out.push({ ...style, text: decode(tt.text) });
        break;
      }
      case "escape":
        out.push({ ...style, text: decode((t as Tokens.Escape).text) });
        break;
      case "html":
        break; // raw HTML from a model is never rendered
      default:
        if ("text" in t && typeof t.text === "string") out.push({ ...style, text: decode(t.text) });
    }
  }
  return out.filter((r) => r.text.length > 0);
}

function listItems(list: Tokens.List, depth: number): { runs: Run[]; depth: number; checked?: boolean }[] {
  const items: { runs: Run[]; depth: number; checked?: boolean }[] = [];
  for (const item of list.items) {
    const runs: Run[] = [];
    const nested: Tokens.List[] = [];
    for (const child of item.tokens) {
      if (child.type === "list") nested.push(child as Tokens.List);
      else if (child.type === "checkbox") continue;
      else if (child.type === "text" || child.type === "paragraph") {
        if (runs.length) runs.push({ text: " " });
        runs.push(...inline((child as Tokens.Text).tokens ?? [child]));
      }
    }
    items.push({ runs, depth, checked: item.task ? Boolean(item.checked) : undefined });
    for (const n of nested) items.push(...listItems(n, depth + 1));
  }
  return items;
}

function blocks(tokens: Token[]): Block[] {
  const out: Block[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "heading": {
        const h = t as Tokens.Heading;
        out.push({ type: "heading", level: Math.min(4, Math.max(1, h.depth)) as 1 | 2 | 3 | 4, runs: inline(h.tokens) });
        break;
      }
      case "paragraph":
        out.push({ type: "paragraph", runs: inline((t as Tokens.Paragraph).tokens) });
        break;
      case "text":
        out.push({ type: "paragraph", runs: inline((t as Tokens.Text).tokens ?? [t]) });
        break;
      case "list": {
        const l = t as Tokens.List;
        out.push({ type: "list", ordered: l.ordered, start: typeof l.start === "number" ? l.start : 1, items: listItems(l, 0) });
        break;
      }
      case "table": {
        const tb = t as Tokens.Table;
        out.push({ type: "table", header: tb.header.map((c) => inline(c.tokens)), rows: tb.rows.map((r) => r.map((c) => inline(c.tokens))) });
        break;
      }
      case "code":
        out.push({ type: "code", text: (t as Tokens.Code).text });
        break;
      case "blockquote":
        out.push({ type: "quote", blocks: blocks((t as Tokens.Blockquote).tokens) });
        break;
      case "hr":
        out.push({ type: "hr" });
        break;
      default:
        break; // space, html, def
    }
  }
  return out;
}

export function parseMarkdown(markdown: string): Block[] {
  // The leading "Simulated response" banner is represented by the document's own simulated notice.
  const md = markdown.replace(/^>\s*\*\*Simulated response[^\n]*\n+/i, "");
  return blocks(new Lexer({ gfm: true }).lex(md));
}

export function plainText(runs: Run[]): string {
  return runs.map((r) => r.text).join("");
}

export function exportFilename(title: string, ext: "pdf" | "docx" | "md"): string {
  const base = title.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "thought-authorities-report";
  return `${base}.${ext}`;
}
