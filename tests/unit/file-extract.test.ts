import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { Document, Packer, Paragraph } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { canExtract, extractText } from "@/server/files/extract";

const enc = (s: string) => new TextEncoder().encode(s);

async function zipOf(files: Record<string, string>) {
  const z = new JSZip();
  for (const [name, body] of Object.entries(files)) z.file(name, body);
  return new Uint8Array(await z.generateAsync({ type: "uint8array" }));
}

describe("document text extraction", () => {
  it("reads plain text formats and tidies whitespace", async () => {
    expect(await extractText("md", enc("# Pricing\r\n\r\n\r\n\r\nAnnual only.  \n"))).toBe("# Pricing\n\nAnnual only.");
    expect(await extractText("csv", enc("month,revenue\nJan,120000"))).toContain("Jan,120000");
  });

  it("reads PDF text", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText("Runway policy: keep 18 months of cash.", { x: 50, y: 700, size: 14, font });
    const text = await extractText("pdf", await pdf.save());
    expect(text).toContain("Runway policy: keep 18 months of cash.");
  });

  it("reads Word (DOCX) text", async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph("Enterprise deals need CFO sign-off above $250k."), new Paragraph("Discounts cap at 15%.")] }] });
    const bytes = new Uint8Array(await Packer.toBuffer(doc));
    const text = await extractText("docx", bytes);
    expect(text).toContain("Enterprise deals need CFO sign-off above $250k.");
    expect(text).toContain("Discounts cap at 15%.");
  });

  it("reads PowerPoint (PPTX) slides in order", async () => {
    const slide = (t: string) => `<p:sld><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sld>`;
    const bytes = await zipOf({ "ppt/slides/slide2.xml": slide("Q4 targets &amp; risks"), "ppt/slides/slide1.xml": slide("Board update"), "ppt/slides/slide10.xml": slide("Appendix") });
    expect(await extractText("pptx", bytes)).toBe("Slide 1\nBoard update\n\nSlide 2\nQ4 targets & risks\n\nSlide 3\nAppendix");
  });

  it("reads Excel (XLSX) sheets with shared and inline strings", async () => {
    const bytes = await zipOf({
      "xl/workbook.xml": `<workbook><sheets><sheet name="Model" sheetId="1"/></sheets></workbook>`,
      "xl/sharedStrings.xml": `<sst><si><t>Month</t></si><si><t>Revenue</t></si><si><t>Jan</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>120000</v></c><c r="C2" t="inlineStr"><is><t>base case</t></is></c></row></sheetData></worksheet>`,
    });
    expect(await extractText("xlsx", bytes)).toBe("Sheet: Model\nMonth\tRevenue\nJan\t120000\tbase case");
  });

  it("returns null for formats without text and for unreadable files", async () => {
    expect(canExtract("png")).toBe(false);
    expect(await extractText("png", enc("x"))).toBeNull();
    expect(await extractText("docx", enc("not a zip"))).toBeNull();
    expect(await extractText("pdf", enc("%PDF-broken"))).toBeNull();
  });
});
