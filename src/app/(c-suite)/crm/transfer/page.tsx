import type { Metadata } from "next";
import { Download, FileSpreadsheet } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { ImportWizard } from "@/components/crm/import-wizard";
import { db } from "@/server/db/store";
import { crmPageContext } from "@/server/crm/page-context";

export const metadata: Metadata = { title: "CRM Import & Export" };

const FORMATS = [
  { key: "xlsx", label: "Excel (.xlsx)" },
  { key: "csv", label: "CSV" },
  { key: "tsv", label: "TSV" },
] as const;

export default async function CrmTransferPage() {
  const { ctx, allowed, canTransfer } = await crmPageContext();
  if (!allowed) return null;
  if (!canTransfer) return <p className="text-sm text-ivory-muted">Importing and exporting the CRM is available to Owners, Admins and Executives.</p>;
  const [contacts, deals] = await Promise.all([db().crmContacts.list(ctx.organization.id), db().crmDeals.list(ctx.organization.id)]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card className="min-w-0">
        <SectionTitle>Import from a spreadsheet</SectionTitle>
        <ImportWizard />
      </Card>
      <aside className="space-y-4">
        {([["contacts", "Contacts", contacts.length], ["deals", "Deals (pipeline)", deals.length]] as const).map(([entity, label, count]) => (
          <Card key={entity}>
            <SectionTitle>Export {label.toLowerCase()}</SectionTitle>
            <p className="mb-3 text-xs text-ivory-muted">{count} {count === 1 ? "record" : "records"}. Downloads include every field{entity === "deals" ? ", the stage, the status (open, won or lost) and the linked contact" : " and the owner's email"}.</p>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <a key={f.key} href={`/api/crm/export?entity=${entity}&format=${f.key}`} download className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs hover:border-line-gold hover:text-gold-200">
                  <Download className="size-3.5" aria-hidden /> {f.label}
                </a>
              ))}
            </div>
          </Card>
        ))}
        <Card>
          <SectionTitle>Blank templates</SectionTitle>
          <p className="mb-3 text-xs text-ivory-muted">Start from the CRM&apos;s own column names, fill them in, then import.</p>
          <div className="space-y-2 text-xs">
            {(["contacts", "deals"] as const).map((entity) => (
              <p key={entity} className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="size-3.5 text-gold-300" aria-hidden /> <span className="w-16 capitalize">{entity}</span>
                <a href={`/api/crm/export?entity=${entity}&format=xlsx&template=1`} download className="text-gold-300 hover:text-gold-200">Excel</a>
                <a href={`/api/crm/export?entity=${entity}&format=csv&template=1`} download className="text-gold-300 hover:text-gold-200">CSV</a>
              </p>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}
