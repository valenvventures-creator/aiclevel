import { Lock } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { CrmTabs } from "@/components/crm/crm-tabs";
import { crmPageContext } from "@/server/crm/page-context";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const { allowed, canTransfer } = await crmPageContext();
  if (!allowed) {
    return <EmptyState icon={<Lock className="size-5" />} title="The CRM isn't available for your role" body="Customer and pipeline data is visible to Owners, Admins, Executives, Members and Viewers. Ask an Owner or Admin if you need access." />;
  }
  return (
    <div className="min-w-0">
      <PageHeader eyebrow="CRM" title="Clients & pipeline" description="Every prospect, contact and deal in one place — from first approach to a client you manage. Drag deals between stages as they progress." />
      <CrmTabs canTransfer={canTransfer} />
      {children}
    </div>
  );
}
