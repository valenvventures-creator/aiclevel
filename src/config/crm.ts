import type { CrmActivityKind, CrmDealType, CrmLeadSource, CrmLeadStatus, CrmStage } from "@/types/domain";

/**
 * CRM pipeline stages, in order. Each has a default win probability (used
 * when a deal enters the stage and for the weighted forecast) and a short
 * description of what the stage means, shown on the board.
 */
export interface StageDef {
  key: CrmStage;
  label: string;
  probability: number;
  hint: string;
  /** Won stages: the deal is a customer (post-sale). */
  won: boolean;
  /** Accent for the column header and card edge. */
  accent: string;
}

export const CRM_PIPELINE: readonly StageDef[] = [
  { key: "PROSPECT", label: "Prospect", probability: 10, hint: "Identified and worth pursuing", won: false, accent: "#8aa4c8" },
  { key: "APPROACH_CONTACT", label: "Approach & Contact", probability: 20, hint: "First outreach and conversation", won: false, accent: "#7fb3b0" },
  { key: "PRESENTATION", label: "Presentation", probability: 40, hint: "Demo, pitch or proposal delivered", won: false, accent: "#c9a96a" },
  { key: "FOLLOW_UP", label: "Follow Up", probability: 60, hint: "Questions, objections, next steps", won: false, accent: "#e0b84f" },
  { key: "CLOSE", label: "Close", probability: 80, hint: "Terms agreed, contract out", won: false, accent: "#efba11" },
  { key: "ONBOARD", label: "Onboard", probability: 100, hint: "Won: getting the client started", won: true, accent: "#6fbf8f" },
  { key: "MANAGE", label: "Manage", probability: 100, hint: "Won: ongoing client relationship", won: true, accent: "#4fa77a" },
];

export const STAGE_BY_KEY = Object.fromEntries(CRM_PIPELINE.map((s) => [s.key, s])) as Record<CrmStage, StageDef>;

export const LEAD_SOURCE_LABEL: Record<CrmLeadSource, string> = {
  ADVERTISEMENT: "Advertisement",
  COLD_CALL: "Cold call",
  EMPLOYEE_REFERRAL: "Employee referral",
  EXTERNAL_REFERRAL: "External referral",
  PARTNER: "Partner",
  PUBLIC_RELATIONS: "Public relations",
  SEMINAR: "Seminar / event",
  TRADE_SHOW: "Trade show",
  WEB_FORM: "Web form",
  WEBSITE: "Website",
  SOCIAL_MEDIA: "Social media",
  EMAIL_CAMPAIGN: "Email campaign",
  OTHER: "Other",
};

export const LEAD_STATUS_LABEL: Record<CrmLeadStatus, string> = {
  NEW: "New",
  ATTEMPTED_TO_CONTACT: "Attempted to contact",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  NOT_QUALIFIED: "Not qualified",
  CUSTOMER: "Customer",
  LOST: "Lost",
};

export const LEAD_STATUS_TONE: Record<CrmLeadStatus, "neutral" | "gold" | "ok" | "warn" | "risk"> = {
  NEW: "gold",
  ATTEMPTED_TO_CONTACT: "neutral",
  CONTACTED: "neutral",
  QUALIFIED: "ok",
  NOT_QUALIFIED: "warn",
  CUSTOMER: "ok",
  LOST: "risk",
};

export const DEAL_TYPE_LABEL: Record<CrmDealType, string> = {
  NEW_BUSINESS: "New business",
  EXISTING_BUSINESS: "Existing business",
  RENEWAL: "Renewal",
};

export const ACTIVITY_LABEL: Record<CrmActivityKind, string> = {
  NOTE: "Note",
  CALL: "Call",
  MEETING: "Meeting",
  TASK: "Task",
  EMAIL: "Email",
  STAGE_CHANGE: "Stage change",
};

export const CRM_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "MXN", "JPY", "CHF", "INR", "BRL"] as const;

export const CRM_LIMITS = {
  /** Rows accepted in one import. */
  IMPORT_ROWS: 5000,
  /** Largest spreadsheet accepted for import. */
  IMPORT_BYTES: 5 * 1024 * 1024,
  /** Deals shown per board column before "show more". */
  COLUMN_CARDS: 60,
} as const;

export function formatMoney(amount: number | null, currency = "USD"): string {
  if (amount === null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
  }
}

export function contactName(c: { first_name: string; last_name: string }): string {
  return `${c.first_name} ${c.last_name}`.trim();
}
