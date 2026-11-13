/**
 * Spreadsheet columns for CRM import and export. Each column maps to a CRM
 * field; on import, headers are matched to these names and aliases
 * (including Zoho CRM export headers).
 */
export type CrmEntity = "contacts" | "deals";

export interface ColumnDef {
  key: string;
  header: string;
  /** Other header names recognized on import (compared without case, spaces or punctuation). */
  aliases: string[];
  required?: boolean;
}

export const CONTACT_COLUMNS: ColumnDef[] = [
  { key: "first_name", header: "First Name", aliases: ["firstname", "given name", "forename"] },
  { key: "last_name", header: "Last Name", aliases: ["lastname", "surname", "family name"], required: true },
  { key: "full_name", header: "Full Name", aliases: ["name", "contact name", "full name"] },
  { key: "email", header: "Email", aliases: ["email address", "e-mail", "primary email", "work email"] },
  { key: "phone", header: "Phone", aliases: ["phone number", "work phone", "telephone", "office phone"] },
  { key: "mobile", header: "Mobile", aliases: ["mobile phone", "cell", "cell phone"] },
  { key: "title", header: "Title", aliases: ["job title", "position", "designation", "role"] },
  { key: "company", header: "Company", aliases: ["account name", "account", "organization", "organisation", "company name", "business"] },
  { key: "website", header: "Website", aliases: ["web site", "url", "site"] },
  { key: "industry", header: "Industry", aliases: ["sector"] },
  { key: "lead_source", header: "Lead Source", aliases: ["source"] },
  { key: "lead_status", header: "Lead Status", aliases: ["status", "contact status"] },
  { key: "owner", header: "Owner Email", aliases: ["owner", "contact owner", "lead owner", "owner email"] },
  { key: "street", header: "Street", aliases: ["mailing street", "address", "address line 1", "street address"] },
  { key: "city", header: "City", aliases: ["mailing city", "town"] },
  { key: "state", header: "State", aliases: ["mailing state", "province", "region", "county"] },
  { key: "postal_code", header: "Postal Code", aliases: ["mailing zip", "zip", "zip code", "postcode", "mailing code"] },
  { key: "country", header: "Country", aliases: ["mailing country"] },
  { key: "linkedin", header: "LinkedIn", aliases: ["linkedin url", "linkedin profile"] },
  { key: "tags", header: "Tags", aliases: ["tag", "labels"] },
  { key: "description", header: "Description", aliases: ["notes", "note", "comments", "about"] },
  { key: "email_opt_out", header: "Email Opt Out", aliases: ["unsubscribed", "opt out", "do not email"] },
];

export const DEAL_COLUMNS: ColumnDef[] = [
  { key: "name", header: "Deal Name", aliases: ["deal", "opportunity", "opportunity name", "potential name", "name"], required: true },
  { key: "stage", header: "Stage", aliases: ["deal stage", "pipeline stage", "sales stage"] },
  { key: "amount", header: "Amount", aliases: ["value", "deal value", "revenue", "expected revenue"] },
  { key: "currency", header: "Currency", aliases: ["currency code"] },
  { key: "probability", header: "Probability (%)", aliases: ["probability", "win probability", "likelihood"] },
  { key: "expected_close", header: "Expected Close", aliases: ["closing date", "close date", "expected close date", "closed date"] },
  { key: "deal_type", header: "Type", aliases: ["deal type", "business type"] },
  { key: "lead_source", header: "Lead Source", aliases: ["source"] },
  { key: "next_step", header: "Next Step", aliases: ["next action"] },
  { key: "description", header: "Description", aliases: ["notes", "comments"] },
  { key: "company", header: "Company", aliases: ["account name", "account", "organization", "company name"] },
  { key: "contact_email", header: "Contact Email", aliases: ["email", "contact e-mail"] },
  { key: "contact_name", header: "Contact Name", aliases: ["contact", "primary contact"] },
  { key: "owner", header: "Owner Email", aliases: ["owner", "deal owner", "owner email"] },
  { key: "status", header: "Status", aliases: ["deal status"] },
  { key: "lost_reason", header: "Lost Reason", aliases: ["reason for loss", "loss reason"] },
];

