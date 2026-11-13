import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { DealForm } from "@/components/crm/forms";
import { contactName } from "@/config/crm";
import { db } from "@/server/db/store";
import { crmPageContext } from "@/server/crm/page-context";
import { CRM_STAGES, type CrmStage } from "@/types/domain";

export const metadata: Metadata = { title: "New deal" };

export default async function NewDealPage({ searchParams }: PageProps<"/crm/deals/new">) {
  const { ctx, allowed, canWrite, owners } = await crmPageContext();
  if (!allowed) return null;
  if (!canWrite) return <p className="text-sm text-ivory-muted">Your role can view the CRM but not add deals.</p>;
  const sp = await searchParams;
  const stage = (CRM_STAGES as readonly string[]).includes(String(sp.stage)) ? (sp.stage as CrmStage) : undefined;
  const contactId = typeof sp.contact === "string" ? sp.contact : undefined;
  const contacts = (await db().crmContacts.list(ctx.organization.id)).sort((a, b) => contactName(a).localeCompare(contactName(b)));
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={contactId ? `/crm/contacts/${contactId}` : "/crm"} className="text-xs text-ivory-muted hover:text-ivory">← {contactId ? "Contact" : "Pipeline"}</Link>
      <h2 className="mb-4 mt-2 font-heading text-2xl font-semibold">New deal</h2>
      <Card>
        <DealForm contacts={contacts.map((c) => ({ id: c.id, name: contactName(c), company: c.company }))} owners={owners} meId={ctx.user.id} defaults={{ stage, contact_id: contactId, returnTo: stage ? "board" : undefined }} />
      </Card>
    </div>
  );
}
