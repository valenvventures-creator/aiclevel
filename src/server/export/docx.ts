import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { CREST_PNG_BASE64, CREST_SIZE } from "./brand-assets";
import { AI_DISCLAIMER, type Block, type ExportDocument, type Run } from "./document";

/** Branded Word (.docx) export with native headings, lists, tables and page numbers. */

const GOLD = "B0850A";
const INK = "12141C";
const MUTED = "6B6B73";
const RULE = "DCD6C7";
const FONT = "Calibri";

function runs(rs: Run[], base: Partial<IRunOptions> = {}): ParagraphChild[] {
  return rs.map((r) => {
    const opts: IRunOptions = {
      ...base,
      text: r.text,
      bold: r.bold || (base.bold as boolean | undefined),
      italics: r.italic || (base.italics as boolean | undefined),
      font: r.code ? "Consolas" : (base.font ?? FONT),
      ...(r.code ? { shading: { type: ShadingType.CLEAR, fill: "F2F2F0", color: "auto" } } : {}),
      ...(r.link ? { color: GOLD, underline: {} } : {}),
    };
    const run = new TextRun(opts);
    return r.link && /^https?:\/\//.test(r.link) ? new ExternalHyperlink({ link: r.link, children: [run] }) : run;
  });
}

const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 } as const;

function blocks(bs: Block[], quote = false): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const b of bs) {
    switch (b.type) {
      case "heading":
        out.push(new Paragraph({ heading: HEADINGS[b.level], children: runs(b.runs) }));
        break;
      case "paragraph":
        out.push(
          new Paragraph({
            children: runs(b.runs, quote ? { italics: true } : {}),
            ...(quote ? { indent: { left: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 10 } } } : {}),
          }),
        );
        break;
      case "list":
        for (const it of b.items) {
          const prefix = it.checked !== undefined ? [new TextRun({ text: it.checked ? "☑ " : "☐ ", font: FONT })] : [];
          out.push(
            new Paragraph({
              children: [...prefix, ...runs(it.runs)],
              numbering: { reference: b.ordered && it.checked === undefined ? "ta-numbers" : "ta-bullets", level: Math.min(it.depth, 2) },
            }),
          );
        }
        break;
      case "table": {
        const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length));
        const cell = (rs: Run[] | undefined, header: boolean) =>
          new TableCell({
            children: [new Paragraph({ children: runs(rs ?? [], header ? { bold: true } : {}), spacing: { before: 40, after: 40 } })],
            shading: header ? { type: ShadingType.CLEAR, fill: "FBF1D0", color: "auto" } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
          });
        out.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: GOLD },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            rows: [
              new TableRow({ tableHeader: true, children: Array.from({ length: cols }, (_, i) => cell(b.header[i], true)) }),
              ...b.rows.map((r) => new TableRow({ children: Array.from({ length: cols }, (_, i) => cell(r[i], false)) })),
            ],
          }),
          new Paragraph({ text: "" }),
        );
        break;
      }
      case "code":
        for (const line of b.text.split("\n")) {
          out.push(new Paragraph({ children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })], shading: { type: ShadingType.CLEAR, fill: "F2F2F0", color: "auto" }, spacing: { before: 0, after: 0 } }));
        }
        out.push(new Paragraph({ text: "" }));
        break;
      case "quote":
        out.push(...blocks(b.blocks, true));
        break;
      case "hr":
        out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } }, children: [] }));
        break;
    }
  }
  return out;
}

export async function renderDocx(doc: ExportDocument): Promise<Uint8Array> {
  const crest = Buffer.from(CREST_PNG_BASE64, "base64");
  const date = new Date(doc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const meta = [doc.leadExecutive && `Lead executive: ${doc.leadExecutive}`, doc.contributors.length ? `Contributors: ${doc.contributors.join(", ")}` : null, date].filter(Boolean).join("   ·   ");

  const title: Paragraph[] = [
    new Paragraph({ children: [new TextRun({ text: doc.subtitle.toUpperCase(), bold: true, color: GOLD, size: 17, font: FONT, characterSpacing: 30 })], spacing: { after: 80 } }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: doc.title })] }),
    new Paragraph({ children: [new TextRun({ text: meta, color: MUTED, size: 18, font: FONT })], spacing: { after: 160 } }),
  ];
  if (doc.simulated) {
    title.push(
      new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: "FFF2DB", color: "auto" },
        spacing: { after: 200 },
        children: [
          new TextRun({ text: "Simulated demo content. ", bold: true, color: "9E610D", font: FONT, size: 18 }),
          new TextRun({ text: "This document was generated from a template in demo mode, not by a live A.I. model. Do not rely on it.", color: "9E610D", font: FONT, size: 18 }),
        ],
      }),
    );
  }
  title.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } }, children: [], spacing: { after: 200 } }));

  const document = new Document({
    title: doc.title,
    subject: doc.subtitle,
    creator: "Thought Authorities — A.I. C-Suite",
    description: AI_DISCLAIMER,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: "282A33" }, paragraph: { spacing: { after: 140, line: 300 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: FONT, size: 46, bold: true, color: INK }, paragraph: { spacing: { after: 100 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: INK }, paragraph: { spacing: { before: 320, after: 120 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 28, bold: true, color: GOLD }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 220, after: 80 }, keepNext: true } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 22, bold: true, color: INK }, paragraph: { spacing: { before: 180, after: 60 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "ta-bullets",
          levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.BULLET, text: level === 1 ? "–" : "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 360, hanging: 260 } }, run: { color: GOLD } } })),
        },
        {
          reference: "ta-numbers",
          levels: [0, 1, 2].map((level) => ({ level, format: level === 1 ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360 + level * 360, hanging: 300 } }, run: { color: GOLD, bold: true } } })),
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1440, bottom: 1300, left: 1260, right: 1260 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 6 } },
                children: [
                  new ImageRun({ type: "png", data: crest, transformation: { width: 46, height: Math.round((46 * CREST_SIZE.height) / CREST_SIZE.width) } }),
                  new TextRun({ text: "   THOUGHT AUTHORITIES", bold: true, color: GOLD, size: 17, font: FONT, characterSpacing: 40 }),
                  new TextRun({ text: `   ·   A.I. C-SUITE   ·   ${doc.organization}`, color: MUTED, size: 15, font: FONT }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({ children: [new TextRun({ text: AI_DISCLAIMER, color: MUTED, size: 14, font: FONT })], spacing: { after: 60 } }),
              new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], color: MUTED, size: 15, font: FONT })] }),
            ],
          }),
        },
        children: [...title, ...blocks(doc.blocks)],
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
