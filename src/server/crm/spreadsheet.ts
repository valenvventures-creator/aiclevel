import JSZip from "jszip";

/**
 * Minimal spreadsheet reading and writing for CRM import/export:
 * CSV (comma or semicolon), TSV and Excel (.xlsx). Pure functions over
 * rows of strings; no formulas are ever evaluated or written.
 */
export type Rows = string[][];
export type SheetFormat = "csv" | "tsv" | "xlsx";

export const SHEET_MIME: Record<SheetFormat, string> = {
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function formatFromFilename(name: string): SheetFormat | null {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "csv" ? "csv" : ext === "tsv" || ext === "tab" ? "tsv" : ext === "xlsx" ? "xlsx" : ext === "txt" ? "csv" : null;
}

/* ---------------------------------- read ---------------------------------- */

export async function readSheet(format: SheetFormat, bytes: Uint8Array): Promise<Rows> {
  if (format === "xlsx") return readXlsx(bytes);
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  return parseDelimited(text, format === "tsv" ? "\t" : detectDelimiter(text));
}

/** Comma, semicolon or tab — whichever splits the first line into the most columns. */
export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (d: string) => first.split(d).length;
  return [",", ";", "\t"].reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

/** RFC 4180 parsing: quoted fields, escaped quotes ("") and line breaks inside quotes. Blank lines dropped. */
export function parseDelimited(text: string, delimiter = ","): Rows {
  const rows: Rows = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENTITIES[e.toLowerCase()] ?? "",
  );

/** Column index from a cell reference such as "C7" (A = 0). */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** The first worksheet of an .xlsx file as rows of strings (cells placed by their reference). */
export async function readXlsx(bytes: Uint8Array): Promise<Rows> {
  const zip = await JSZip.loadAsync(bytes);
  const read = async (path: string) => (await zip.file(path)?.async("string")) ?? "";
  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => decodeXml(t[1])).join(""));
  // First sheet in workbook order, resolved through the workbook relationships.
  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const firstRid = /<sheet [^>]*r:id="([^"]+)"/.exec(workbook)?.[1];
  const target = firstRid ? new RegExp(`<Relationship [^>]*Id="${firstRid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] ?? new RegExp(`<Relationship [^>]*Target="([^"]+)"[^>]*Id="${firstRid}"`).exec(rels)?.[1] : undefined;
  const sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
  const xml = (await read(sheetPath)) || (await read("xl/worksheets/sheet1.xml"));
  const rows: Rows = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const c of r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const inner = c[2] ?? "";
      const col = columnIndex(/r="([A-Z]+\d+)"/i.exec(attrs)?.[1] ?? `A${row.length + 1}`);
      const v = /<v>([^<]*)<\/v>/.exec(inner)?.[1];
      let value = "";
      if (/t="s"/.test(attrs)) value = v !== undefined ? shared[Number(v)] ?? "" : "";
      else if (/t="inlineStr"/.test(attrs)) value = [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => decodeXml(t[1])).join("");
      else if (/t="b"/.test(attrs)) value = v === "1" ? "TRUE" : "FALSE";
      else value = v !== undefined ? decodeXml(v) : "";
      while (row.length < col) row.push("");
      row[col] = value;
    }
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Excel stores dates as day numbers since 1899-12-30. */
export function excelSerialToDate(n: number): string {
  return new Date(Math.round((n - 25569) * 86_400_000)).toISOString().slice(0, 10);
}

/* ---------------------------------- write --------------------------------- */

/**
 * Neutralizes spreadsheet formula injection: a value starting with = + - @
 * (or a tab/carriage return) is prefixed with an apostrophe so spreadsheet
 * apps show it as text instead of running it. Plain numbers are left alone.
 */
export function safeCell(value: string): string {
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function writeDelimited(rows: Rows, delimiter: "," | "\t"): string {
  const esc = (v: string) => {
    const s = safeCell(v ?? "");
    return delimiter === "\t" ? s.replace(/[\t\r\n]+/g, " ") : /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens UTF-8 CSV correctly.
  return "﻿" + rows.map((r) => r.map(esc).join(delimiter)).join("\r\n") + "\r\n";
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function columnName(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A single-sheet .xlsx with a bold header row. Numbers are written as numbers, everything else as text. */
export async function writeXlsx(rows: Rows, sheetName = "Sheet1"): Promise<Uint8Array> {
  const sheetRows = rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          const ref = `${columnName(ci)}${ri + 1}`;
          const style = ri === 0 ? ' s="1"' : "";
          if (ri > 0 && v !== "" && /^-?\d+(\.\d+)?$/.test(v) && v.length < 16) return `<c r="${ref}"${style}><v>${v}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v ?? "")}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  const name = xmlEsc(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`);
  zip.file("xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${sheetRows}</sheetData></worksheet>`);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function writeSheet(format: SheetFormat, rows: Rows, sheetName: string): Promise<Uint8Array> {
  if (format === "xlsx") return writeXlsx(rows, sheetName);
  return new TextEncoder().encode(writeDelimited(rows, format === "tsv" ? "\t" : ","));
}
