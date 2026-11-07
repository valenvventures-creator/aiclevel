import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { exportFilename, parseMarkdown, plainText, type ExportDocument } from "@/server/export/document";
import { renderPdf } from "@/server/export/pdf";
import { renderDocx } from "@/server/export/docx";

const SAMPLE = `> **Simulated response — demo mode.** No provider.

# Fundraising Strategy

## Recommendation
Raise a **$1.5M** seed extension → close by *Q1*. See [deck](https://example.com/deck).

- Lead with Enterprise traction ✓
  - Nested point 🚀
- Second point
1. First step
2. Second step
- [x] Board approval

| Scenario | Burn | Runway |
|---|---|---|
| Base | $68K | 36 mo |
| Aggressive | $120K | 19 mo |

> Counsel review recommended.

\`\`\`
runway = cash / burn
\`\`\`

---
Final paragraph with “curly quotes” — and an em dash.`;

const meta = (blocksMd: string, simulated = false): ExportDocument => ({
  title: "Investor update for the seed extension",
  subtitle: "Fundraising Strategy · Version 2",
  organization: "Thought Authorities Demo",
  leadExecutive: "Chief Financial Officer",
  contributors: ["Chief Executive Officer", "Chief Communications Officer"],
  createdAt: "2026-11-07T06:00:00.000Z",
  simulated,
  blocks: parseMarkdown(blocksMd),
});

describe("markdown → document model", () => {
  const blocks = parseMarkdown(SAMPLE);

  it("drops the simulated banner (the document carries its own notice)", () => {
    expect(JSON.stringify(blocks)).not.toContain("Simulated response");
  });

  it("produces real headings, rich text, lists, tables, quotes and code", () => {
    expect(blocks.map((b) => b.type)).toEqual(["heading", "heading", "paragraph", "list", "list", "list", "table", "quote", "code", "hr", "paragraph"]);
    const para = blocks[2] as Extract<(typeof blocks)[number], { type: "paragraph" }>;
    expect(para.runs.find((r) => r.text === "$1.5M")?.bold).toBe(true);
    expect(para.runs.find((r) => r.text === "Q1")?.italic).toBe(true);
    expect(para.runs.find((r) => r.link)?.link).toBe("https://example.com/deck");
    const list = blocks[3] as Extract<(typeof blocks)[number], { type: "list" }>;
    expect(list.items.map((i) => i.depth)).toEqual([0, 1, 0]);
    const task = blocks[5] as Extract<(typeof blocks)[number], { type: "list" }>;
    expect(task.items[0].checked).toBe(true);
    const table = blocks[6] as Extract<(typeof blocks)[number], { type: "table" }>;
    expect(table.header.map(plainText)).toEqual(["Scenario", "Burn", "Runway"]);
    expect(table.rows).toHaveLength(2);
  });

  it("makes safe file names", () => {
    expect(exportFilename("Q3: Board / Investor update!", "pdf")).toBe("Q3-Board-Investor-update.pdf");
    expect(exportFilename("???", "docx")).toBe("thought-authorities-report.docx");
  });
});

describe("PDF export", () => {
  it("renders a valid, branded multi-page PDF without failing on unicode", async () => {
    const long = `${SAMPLE}\n\n${Array.from({ length: 60 }, (_, i) => `Paragraph ${i} with enough words to wrap across the full width of the page and test pagination.`).join("\n\n")}`;
    const bytes = await renderPdf(meta(long, true));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("Investor update for the seed extension");
  });
});

describe("Word export", () => {
  it("renders a valid .docx package", async () => {
    const bytes = await renderDocx(meta(SAMPLE));
    expect(bytes[0]).toBe(0x50); // "PK" zip signature
    expect(bytes[1]).toBe(0x4b);
    expect(Buffer.from(bytes).includes(Buffer.from("word/document.xml"))).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(20_000); // includes the embedded crest
  });
});
