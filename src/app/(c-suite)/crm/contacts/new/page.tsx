import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { ContactForm } from "@/components/crm/forms";
import { crmPageContext } from "@/server/crm/page-context";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage() {
  const { ctx, allowed, canWrite, owners } = await crmPageContext();
  if (!allowed) return null;
  if (!canWrite) return <p className="text-sm text-ivory-muted">Your role can view the CRM but not add contacts.</p>;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/crm/contacts" className="text-xs text-ivory-muted hover:text-ivory">← Contacts</Link>
      <h2 className="mb-4 mt-2 font-heading text-2xl font-semibold">New contact</h2>
      <Card>
        <ContactForm owners={owners} meId={ctx.user.id} />
      </Card>
    </div>
  );
}
