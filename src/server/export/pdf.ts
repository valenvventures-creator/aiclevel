import "server-only";
import { LineCapStyle, PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { CREST_PNG_BASE64, CREST_SIZE } from "./brand-assets";
import { AI_DISCLAIMER, type Block, type ExportDocument, type Run } from "./document";

/**
 * Branded PDF export. Uses pdf-lib's built-in standard fonts, so it needs no
 * browser, no font files and no filesystem access — safe on serverless hosts.
 */

const PAGE = { width: 612, height: 792 }; // US Letter
const M = { left: 64, right: 64, top: 92, bottom: 76 };
const CONTENT_W = PAGE.width - M.left - M.right;

const C = {
  ink: rgb(0.07, 0.08, 0.11),
  body: rgb(0.16, 0.17, 0.2),
  muted: rgb(0.42, 0.42, 0.45),
  gold: rgb(0.69, 0.52, 0.04),
  goldSoft: rgb(0.99, 0.95, 0.83),
  rule: rgb(0.86, 0.84, 0.78),
  codeBg: rgb(0.96, 0.96, 0.95),
  warnBg: rgb(1, 0.95, 0.86),
  warn: rgb(0.62, 0.38, 0.05),
};

interface Fonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont; mono: PDFFont }

/* ---------------------- WinAnsi-safe text (standard fonts) ---------------------- */

const SUBSTITUTE: Record<string, string> = {
  "→": "->", "←": "<-", "↑": "^", "↓": "v", "⇒": "=>", "≤": "<=", "≥": ">=", "≈": "~", "≠": "!=", "×": "x", "÷": "/",
  "−": "-", "‐": "-", "‑": "-", "✓": "v", "✔": "v", "✗": "x", "✘": "x", "☐": "[ ]", "☑": "[x]", "☒": "[x]", "★": "*", "☆": "*", "➔": "->", "➜": "->",
  " ": " ", " ": " ", " ": " ", "​": "", "\t": "    ",
};

function makeSanitizer(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return (s: string) => {
    let out = "";
    for (const ch of s) {
      if (SUBSTITUTE[ch] !== undefined) out += SUBSTITUTE[ch];
      else if (supported.has(ch.codePointAt(0)!)) out += ch;
      else if (/\p{Extended_Pictographic}|\p{M}/u.test(ch)) continue; // emoji / combining marks
      else out += ch.normalize("NFKD").replace(/[^\x20-\x7e]/g, "") || "?";
    }
    return out;
  };
}

/**
 * Symbols with no glyph in the standard PDF fonts are drawn as small vector
 * shapes, so they look identical in every PDF viewer (no font substitution).
 * Paths are in a 10×10 box, origin top-left.
 */
type ShapeName = "check" | "cross" | "star" | "arrow" | "box" | "boxChecked";
const SHAPE_FOR: Record<string, ShapeName> = { "✓": "check", "✔": "check", "✅": "check", "✗": "cross", "✘": "cross", "❌": "cross", "★": "star", "☆": "star", "⭐": "star", "→": "arrow", "⇒": "arrow", "➜": "arrow", "➔": "arrow", "☐": "box", "☑": "boxChecked", "☒": "boxChecked" };
const SHAPES: Record<ShapeName, { width: number; paths: { d: string; fill?: boolean }[] }> = {
  check: { width: 0.9, paths: [{ d: "M1.2 5.4 L4 8.4 L8.8 1.6" }] },
  cross: { width: 0.85, paths: [{ d: "M2 2 L8 8 M8 2 L2 8" }] },
  star: { width: 0.95, paths: [{ d: "M5 0.6 L6.3 3.6 L9.5 3.9 L7.1 6 L7.8 9.2 L5 7.5 L2.2 9.2 L2.9 6 L0.5 3.9 L3.7 3.6 Z", fill: true }] },
  arrow: { width: 1.1, paths: [{ d: "M0.8 5 L8.6 5 M5.6 2 L8.8 5 L5.6 8" }] },
  box: { width: 0.9, paths: [{ d: "M1 1 L9 1 L9 9 L1 9 Z" }] },
  boxChecked: { width: 0.9, paths: [{ d: "M1 1 L9 1 L9 9 L1 9 Z" }, { d: "M2.6 5.2 L4.4 7.1 L7.6 2.9" }] },
};

function splitSymbols(text: string, regular: Set<number>): { text: string; shape?: ShapeName }[] {
  const out: { text: string; shape?: ShapeName }[] = [];
  for (const ch of text) {
    const shape = regular.has(ch.codePointAt(0)!) ? undefined : SHAPE_FOR[ch];
    if (shape) out.push({ text: ch, shape });
    else if (out.length && !out[out.length - 1].shape) out[out.length - 1].text += ch;
    else out.push({ text: ch });
  }
  return out;
}

function drawShape(page: PDFPage, shape: ShapeName, x: number, baseline: number, size: number, color: RGB) {
  const scale = (size * 0.78) / 10;
  const top = baseline + size * 0.74;
  for (const p of SHAPES[shape].paths) {
    page.drawSvgPath(p.d, p.fill ? { x, y: top, scale, color } : { x, y: top, scale, borderColor: color, borderWidth: 1.1 / scale, borderLineCap: LineCapStyle.Round });
  }
}

/* ---------------------------------- writer ---------------------------------- */

class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  private regularSet: Set<number>;
  constructor(private pdf: PDFDocument, private f: Fonts, private clean: (s: string) => string, private header: (p: PDFPage) => void) {
    this.regularSet = new Set(f.regular.getCharacterSet());
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.pages.push(this.page);
    this.header(this.page);
    this.y = PAGE.height - M.top;
  }

  ensure(h: number) {
    if (this.y - h < M.bottom) this.newPage();
  }

  fontFor(r: Run): PDFFont {
    if (r.code) return this.f.mono;
    if (r.bold && r.italic) return this.f.boldItalic;
    if (r.bold) return this.f.bold;
    if (r.italic) return this.f.italic;
    return this.f.regular;
  }

  /** Lays out rich runs as wrapped lines; returns the lines without drawing. */
  layout(runs: Run[], size: number, width: number, base: Partial<Run> = {}) {
    type Piece = { text: string; font: PDFFont; w: number; link?: string; shape?: ShapeName };
    const lines: Piece[][] = [[]];
    let lineW = 0;
    const push = (p: Piece) => {
      lines[lines.length - 1].push(p);
      lineW += p.w;
    };
    const segments = runs.flatMap((raw) => {
      const r = { ...base, ...raw };
      return r.code ? [{ r, text: r.text, shape: undefined }] : splitSymbols(r.text, this.regularSet).map((seg) => ({ r, text: seg.text, shape: seg.shape }));
    });
    for (const { r, text, shape } of segments) {
      const font = this.fontFor(r);
      if (shape) {
        const w = SHAPES[shape].width * size;
        if (lineW + w > width && lineW > 0) {
          lines.push([]);
          lineW = 0;
        }
        push({ text: "", font, w, shape, link: r.link });
        continue;
      }
      const parts = this.clean(text).split(/(\n| +)/);
      for (const part of parts) {
        if (!part) continue;
        if (part === "\n") {
          lines.push([]);
          lineW = 0;
          continue;
        }
        const isSpace = /^ +$/.test(part);
        if (isSpace && lineW === 0) continue;
        let w = font.widthOfTextAtSize(part, size);
        if (!isSpace && lineW + w > width && lineW > 0) {
          lines.push([]);
          lineW = 0;
        }
        // Hard-break words longer than the line (URLs, ids).
        let word = part;
        while (!isSpace && w > width) {
          let cut = word.length;
          while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > width - lineW) cut--;
          push({ text: word.slice(0, cut), font, w: font.widthOfTextAtSize(word.slice(0, cut), size), link: r.link });
          lines.push([]);
          lineW = 0;
          word = word.slice(cut);
          w = font.widthOfTextAtSize(word, size);
        }
        if (word) push({ text: word, font, w, link: r.link });
      }
    }
    // Trim trailing spaces.
    for (const l of lines) while (l.length && !l[l.length - 1].shape && /^ +$/.test(l[l.length - 1].text)) l.pop();
    return lines;
  }

  drawLines(lines: ReturnType<Writer["layout"]>, x: number, size: number, color: RGB, lineH: number) {
    for (const line of lines) {
      this.ensure(lineH);
      let cx = x;
      for (const p of line) {
        if (p.shape) {
          drawShape(this.page, p.shape, cx + size * 0.06, this.y - size, size, p.link ? C.gold : color);
          cx += p.w;
          continue;
        }
        this.page.drawText(p.text, { x: cx, y: this.y - size, size, font: p.font, color: p.link ? C.gold : color });
        if (p.link && p.text.trim()) this.page.drawLine({ start: { x: cx, y: this.y - size - 1.5 }, end: { x: cx + p.w, y: this.y - size - 1.5 }, thickness: 0.5, color: C.gold });
        cx += p.w;
      }
      this.y -= lineH;
    }
  }

  text(runs: Run[], opts: { size?: number; color?: RGB; indent?: number; width?: number; lineH?: number; base?: Partial<Run> } = {}) {
    const size = opts.size ?? 10.5;
    const x = M.left + (opts.indent ?? 0);
    const width = opts.width ?? CONTENT_W - (opts.indent ?? 0);
    const lines = this.layout(runs, size, width, opts.base);
    this.drawLines(lines, x, size, opts.color ?? C.body, opts.lineH ?? size * 1.5);
  }

  gap(h: number) {
    this.y -= h;
  }
}

/* --------------------------------- blocks --------------------------------- */

function renderBlocks(w: Writer, f: Fonts, blocks: Block[], indent = 0) {
  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        const size = { 1: 18, 2: 14.5, 3: 12.5, 4: 11 }[b.level];
        w.gap(b.level <= 2 ? 10 : 6);
        w.ensure(size * 3.2); // keep headings with following text
        w.text(b.runs, { size, color: b.level === 2 ? C.gold : C.ink, indent, base: { bold: true }, lineH: size * 1.3 });
        w.gap(4);
        break;
      }
      case "paragraph":
        w.text(b.runs, { indent });
        w.gap(7);
        break;
      case "list": {
        let n = b.start;
        for (const it of b.items) {
          const ind = indent + 6 + it.depth * 16;
          const lines = w.layout(it.runs, 10.5, CONTENT_W - ind - 16);
          w.ensure(15.75);
          if (it.checked !== undefined) drawShape(w.page, it.checked ? "boxChecked" : "box", M.left + ind, w.y - 10.5, 10.5, C.gold);
          else {
            const marker = b.ordered && it.depth === 0 ? `${n++}.` : it.depth % 2 ? "-" : "•";
            w.page.drawText(marker, { x: M.left + ind, y: w.y - 10.5, size: 10.5, font: f.bold, color: C.gold });
          }
          w.drawLines(lines, M.left + ind + 16, 10.5, C.body, 15.75);
          w.gap(2);
        }
        w.gap(6);
        break;
      }
      case "table":
        renderTable(w, f, b, indent);
        w.gap(10);
        break;
      case "code": {
        const lines = b.text.split("\n").flatMap((l) => w.layout([{ text: l || " ", code: true }], 8.8, CONTENT_W - indent - 16));
        const lh = 12.5;
        let i = 0;
        while (i < lines.length) {
          w.ensure(lh + 12);
          const fit = Math.max(1, Math.min(lines.length - i, Math.floor((w.y - M.bottom - 12) / lh)));
          const h = fit * lh + 12;
          w.page.drawRectangle({ x: M.left + indent, y: w.y - h, width: CONTENT_W - indent, height: h, color: C.codeBg });
          w.gap(6);
          w.drawLines(lines.slice(i, i + fit), M.left + indent + 8, 8.8, C.ink, lh);
          w.gap(6);
          i += fit;
        }
        w.gap(8);
        break;
      }
      case "quote": {
        const startPage = w.page;
        const top = w.y;
        renderBlocks(w, f, b.blocks.map((x) => (x.type === "paragraph" ? { ...x, runs: x.runs.map((r) => ({ ...r, italic: true })) } : x)), indent + 14);
        if (w.page === startPage) w.page.drawRectangle({ x: M.left + indent, y: w.y + 6, width: 2.5, height: top - w.y - 6, color: C.gold });
        break;
      }
      case "hr":
        w.ensure(16);
        w.gap(6);
        w.page.drawLine({ start: { x: M.left, y: w.y }, end: { x: PAGE.width - M.right, y: w.y }, thickness: 0.6, color: C.rule });
        w.gap(10);
        break;
    }
  }
}

function renderTable(w: Writer, f: Fonts, t: Extract<Block, { type: "table" }>, indent: number) {
  const cols = Math.max(t.header.length, ...t.rows.map((r) => r.length));
  if (!cols) return;
  const width = CONTENT_W - indent;
  const len = (cells: Run[][], i: number) => (cells[i] ?? []).reduce((n, r) => n + r.text.length, 0);
  const weights = Array.from({ length: cols }, (_, i) => Math.min(40, Math.max(6, len(t.header, i), ...t.rows.map((r) => len(r, i)))));
  const total = weights.reduce((a, b) => a + b, 0);
  const colW = weights.map((x) => (x / total) * width);
  const pad = 5;
  const size = 9.2;
  const lh = 12.5;

  const drawRow = (cells: Run[][], header: boolean) => {
    const laid = colW.map((cw, i) => w.layout(cells[i] ?? [], size, cw - pad * 2, header ? { bold: true } : {}));
    const h = Math.max(...laid.map((l) => l.length)) * lh + pad * 2;
    w.ensure(h);
    const top = w.y;
    let x = M.left + indent;
    if (header) w.page.drawRectangle({ x, y: top - h, width, height: h, color: C.goldSoft });
    laid.forEach((lines, i) => {
      const saveY = w.y;
      w.y = top - pad + (lh - size) / 2 - 1;
      w.drawLines(lines, x + pad, size, header ? C.ink : C.body, lh);
      w.y = saveY;
      x += colW[i];
    });
    w.page.drawLine({ start: { x: M.left + indent, y: top - h }, end: { x: M.left + indent + width, y: top - h }, thickness: header ? 0.9 : 0.4, color: header ? C.gold : C.rule });
    w.y = top - h;
  };

  drawRow(t.header, true);
  for (const r of t.rows) {
    if (w.y - lh * 2 < M.bottom) {
      w.newPage();
      drawRow(t.header, true); // repeat header on a new page
    }
    drawRow(r, false);
  }
}

/* --------------------------------- export --------------------------------- */

export async function renderPdf(doc: ExportDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  pdf.setAuthor("Thought Authorities — A.I. C-Suite");
  pdf.setSubject(doc.subtitle);
  pdf.setCreator("Thought Authorities A.I. C-Suite");
  pdf.setProducer("Thought Authorities A.I. C-Suite");
  pdf.setCreationDate(new Date(doc.createdAt));

  const f: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };
  const clean = makeSanitizer(f.regular);
  const crest = await pdf.embedPng(Buffer.from(CREST_PNG_BASE64, "base64"));
  const crestW = 34;
  const crestH = (crestW * CREST_SIZE.height) / CREST_SIZE.width;

  const header = (p: PDFPage) => {
    const y = PAGE.height - 44;
    p.drawImage(crest, { x: M.left, y: y - crestH / 2 + 3, width: crestW, height: crestH });
    p.drawText("THOUGHT AUTHORITIES", { x: M.left + crestW + 10, y: y + 2, size: 8.5, font: f.bold, color: C.gold });
    p.drawText("A.I. C-SUITE", { x: M.left + crestW + 10, y: y - 8, size: 6.5, font: f.regular, color: C.muted });
    const org = clean(doc.organization).toUpperCase();
    p.drawText(org, { x: PAGE.width - M.right - f.regular.widthOfTextAtSize(org, 7), y: y - 3, size: 7, font: f.regular, color: C.muted });
    p.drawLine({ start: { x: M.left, y: y - 18 }, end: { x: PAGE.width - M.right, y: y - 18 }, thickness: 0.8, color: C.gold });
  };

  const w = new Writer(pdf, f, clean, header);

  // Title block
  w.text([{ text: doc.subtitle.toUpperCase() }], { size: 8.5, color: C.gold, base: { bold: true } });
  w.gap(4);
  w.text([{ text: doc.title }], { size: 23, color: C.ink, base: { bold: true }, lineH: 28 });
  w.gap(4);
  const meta = [doc.leadExecutive && `Lead executive: ${doc.leadExecutive}`, doc.contributors.length ? `Contributors: ${doc.contributors.join(", ")}` : null, new Date(doc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })].filter(Boolean).join("   ·   ");
  w.text([{ text: meta }], { size: 8.8, color: C.muted });
  w.gap(10);
  if (doc.simulated) {
    const lines = w.layout([{ text: "Simulated demo content. ", bold: true }, { text: "This document was generated from a template in demo mode, not by a live A.I. model. Do not rely on it." }], 8.8, CONTENT_W - 20);
    const h = lines.length * 12.5 + 14;
    w.ensure(h);
    w.page.drawRectangle({ x: M.left, y: w.y - h, width: CONTENT_W, height: h, color: C.warnBg });
    w.gap(7);
    w.drawLines(lines, M.left + 10, 8.8, C.warn, 12.5);
    w.gap(14);
  }
  w.page.drawLine({ start: { x: M.left, y: w.y }, end: { x: PAGE.width - M.right, y: w.y }, thickness: 0.5, color: C.rule });
  w.gap(14);

  renderBlocks(w, f, doc.blocks);

  // Footers with page numbers (drawn last, when the page count is known).
  const n = w.pages.length;
  const disclaimer = w.layout([{ text: AI_DISCLAIMER }], 6.6, CONTENT_W - 70);
  w.pages.forEach((p, i) => {
    let y = 46;
    p.drawLine({ start: { x: M.left, y: y + 10 }, end: { x: PAGE.width - M.right, y: y + 10 }, thickness: 0.4, color: C.rule });
    for (const line of disclaimer) {
      let x = M.left;
      for (const piece of line) {
        p.drawText(piece.text, { x, y, size: 6.6, font: piece.font, color: C.muted });
        x += piece.w;
      }
      y -= 8.5;
    }
    const label = `Page ${i + 1} of ${n}`;
    p.drawText(label, { x: PAGE.width - M.right - f.regular.widthOfTextAtSize(label, 7.5), y: 46, size: 7.5, font: f.regular, color: C.muted });
  });

  return pdf.save();
}
