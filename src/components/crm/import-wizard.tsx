"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Label, Select } from "@/components/ui/primitives";
import { CONTACT_COLUMNS, DEAL_COLUMNS, type CrmEntity } from "@/config/crm-columns";
import { cn } from "@/lib/utils";

type Preview = { entity: CrmEntity; filename: string; headers: string[]; rows: string[][]; total: number; truncated: boolean; mapping: string[] };
type Result = { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] };

/**
 * Import contacts or deals from CSV, TSV or Excel in three steps: choose a
 * file, check how its columns match CRM fields, then import.
 */
export function ImportWizard() {
  const router = useRouter();
  const [entity, setEntity] = useState<CrmEntity>("contacts");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<"skip" | "update">("skip");
  const [busy, setBusy] = useState<"reading" | "importing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [over, setOver] = useState(false);

  const columns = (preview?.entity ?? entity) === "contacts" ? CONTACT_COLUMNS : DEAL_COLUMNS;
  const mapped = useMemo(() => new Set(mapping.filter(Boolean)), [mapping]);
  const hasRequired = (preview?.entity ?? entity) === "contacts" ? mapped.has("last_name") || mapped.has("full_name") : mapped.has("name");

  async function read(file: File) {
    setError(null);
    setResult(null);
    setBusy("reading");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("entity", entity);
      const res = await fetch("/api/crm/import/preview", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as Preview & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That file could not be read.");
      setPreview(json);
      setMapping(json.mapping);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file could not be read.");
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!preview) return;
    setError(null);
    setBusy("importing");
    try {
      const res = await fetch("/api/crm/import/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity: preview.entity, headers: preview.headers, rows: preview.rows, mapping, duplicates }),
      });
      const json = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "The import failed.");
      setResult(json);
      setPreview(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The import failed.");
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f && !busy) void read(f);
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Alert tone={result.created + result.updated > 0 ? "ok" : "warn"}>
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4" aria-hidden /> Import finished: {result.created} added{result.updated ? `, ${result.updated} updated` : ""}{result.skipped ? `, ${result.skipped} skipped` : ""}.</span>
        </Alert>
        {result.errors.length > 0 && (
          <div className="rounded-xl border border-line p-4">
            <p className="mb-2 text-sm font-medium">Rows that were skipped</p>
            <ul className="max-h-56 space-y-1 overflow-y-auto text-xs text-ivory-muted">
              {result.errors.map((e) => <li key={`${e.row}-${e.message}`}><span className="font-mono text-ivory-faint">Row {e.row}:</span> {e.message}</li>)}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={entity === "contacts" ? "/crm/contacts" : "/crm"} className="text-sm text-gold-300 hover:text-gold-200">View {entity === "contacts" ? "contacts" : "the pipeline"} →</Link>
          <button type="button" onClick={() => setResult(null)} className="text-sm text-ivory-muted hover:text-ivory">Import another file</button>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="space-y-4">
        {error && <Alert tone="risk">{error}</Alert>}
        <fieldset>
          <legend className="mb-2 text-sm">What are you importing?</legend>
          <div className="flex flex-wrap gap-2">
            {(["contacts", "deals"] as const).map((e) => (
              <label key={e} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm", entity === e ? "border-line-gold bg-gold-400/[0.08] text-gold-100" : "border-line text-ivory-muted")}>
                <input type="radio" name="entity" value={e} checked={entity === e} onChange={() => setEntity(e)} className="accent-gold-400" /> {e === "contacts" ? "Contacts" : "Deals (pipeline)"}
              </label>
            ))}
          </div>
        </fieldset>
        <label
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition focus-within:ring-2 focus-within:ring-gold-400/40", over ? "border-gold-300 bg-gold-400/[0.06]" : "border-line-strong hover:border-line-gold")}
        >
          {busy === "reading" ? <Loader2 className="size-6 animate-spin text-gold-300" aria-hidden /> : <Upload className="size-6 text-gold-300" aria-hidden />}
          <span className="text-sm">{busy === "reading" ? "Reading your spreadsheet…" : <>Drop a spreadsheet here or <span className="text-gold-300">choose a file</span></>}</span>
          <span className="text-xs text-ivory-faint">CSV, TSV or Excel (.xlsx) · first row = column names · up to 5,000 rows</span>
          <input type="file" accept=".csv,.tsv,.tab,.txt,.xlsx" className="sr-only" disabled={busy !== null} aria-label={`Choose a spreadsheet of ${entity} to import`} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void read(f); }} />
        </label>
        <p className="text-xs text-ivory-faint">Exports from other CRMs (including Zoho CRM) usually match automatically. {entity === "deals" ? "Deals are linked to existing contacts by Contact Email or Contact Name, so import contacts first." : "Contacts are matched to existing ones by email."}</p>
      </div>
    );
  }

  const sample = (i: number) => preview.rows.slice(0, 2).map((r) => r[i]).filter(Boolean).join(" · ");
  return (
    <div className="space-y-5">
      {error && <Alert tone="risk">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FileSpreadsheet className="size-4 text-gold-300" aria-hidden />
        <span className="font-medium">{preview.filename}</span>
        <span className="text-ivory-faint">· {preview.total} {preview.total === 1 ? "row" : "rows"} of {preview.entity}</span>
        <button type="button" onClick={() => setPreview(null)} className="ml-auto text-xs text-ivory-muted hover:text-ivory">Choose another file</button>
      </div>
      {preview.truncated && <Alert tone="warn">Only the first 5,000 rows will be imported. Split larger files and import them one at a time.</Alert>}

      <div>
        <p className="mb-2 text-sm">Match each column to a CRM field. Columns set to “Don’t import” are ignored.</p>
        <div className="divide-y divide-line rounded-2xl border border-line">
          {preview.headers.map((h, i) => (
            <div key={`${h}-${i}`} className="grid items-center gap-2 p-3 sm:grid-cols-[1fr_1fr_14rem]">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{h || `Column ${i + 1}`}</p></div>
              <p className="min-w-0 truncate text-xs text-ivory-faint">{sample(i) || "(empty)"}</p>
              <div>
                <Label htmlFor={`map-${i}`} className="sr-only">CRM field for {h}</Label>
                <Select
                  id={`map-${i}`}
                  value={mapping[i] ?? ""}
                  onChange={(e) => setMapping((m) => m.map((v, j) => (j === i ? e.target.value : v === e.target.value && e.target.value ? "" : v)))}
                  className={mapping[i] ? "border-line-gold" : undefined}
                >
                  <option value="">Don’t import</option>
                  {columns.map((c) => <option key={c.key} value={c.key}>{c.header}{c.required ? " *" : ""}</option>)}
                </Select>
              </div>
            </div>
          ))}
        </div>
        {!hasRequired && <p className="mt-2 text-xs text-risk">{preview.entity === "contacts" ? "Match a column to Last Name (or Full Name) to continue." : "Match a column to Deal Name to continue."}</p>}
      </div>

      {preview.entity === "contacts" && (
        <fieldset>
          <legend className="mb-2 text-sm">If a contact with the same email already exists</legend>
          <div className="flex flex-wrap gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="radio" name="dups" checked={duplicates === "skip"} onChange={() => setDuplicates("skip")} className="accent-gold-400" /> Skip it</label>
            <label className="flex items-center gap-2"><input type="radio" name="dups" checked={duplicates === "update"} onChange={() => setDuplicates("update")} className="accent-gold-400" /> Update it with the spreadsheet&apos;s values</label>
          </div>
        </fieldset>
      )}

      <Button type="button" onClick={commit} disabled={!hasRequired || busy !== null}>
        {busy === "importing" && <Loader2 className="size-4 animate-spin" />} Import {Math.min(preview.total, 5000)} {preview.entity === "contacts" ? "contacts" : "deals"}
      </Button>
    </div>
  );
}
