import type { ExecutiveRoleCode, ReportType } from "@/types/domain";

/**
 * C-Level Studio capability registry — "Route to the right executive".
 * Routing is data, not JSX. Each capability names a lead executive, optional
 * contributors, the artifact it produces and the keywords used by the
 * deterministic router (an LLM router may refine the choice when configured).
 */
export interface StudioCapability {
  key: string;
  label: string;
  artifact_type: string;
  lead: ExecutiveRoleCode;
  contributors: ExecutiveRoleCode[];
  keywords: string[];
  report_type?: ReportType;
}

export const STUDIO_CAPABILITIES: readonly StudioCapability[] = [
  { key: "corporate_strategy", label: "Corporate Strategy", artifact_type: "Strategy Document", lead: "CEO", contributors: ["CFO", "CCO"], keywords: ["strategy", "strategic", "vision", "direction", "roadmap", "okr", "plan for the company"], report_type: "CEO Executive Brief" },
  { key: "leadership_plan", label: "Leadership Plan", artifact_type: "Leadership Plan", lead: "CEO", contributors: ["CHRO"], keywords: ["leadership plan", "leadership", "alignment", "offsite"] },
  { key: "executive_report", label: "Executive Report", artifact_type: "Executive Report", lead: "CEO", contributors: [], keywords: ["executive report", "board update", "brief", "summary for the board"], report_type: "CEO Executive Brief" },
  { key: "financial_model", label: "Financial Model", artifact_type: "Financial Model", lead: "CFO", contributors: [], keywords: ["financial model", "forecast", "projection", "p&l", "budget", "cash flow", "three-year", "3-year", "revenue model"], report_type: "Financial Review" },
  { key: "fundraising_strategy", label: "Fundraising Strategy", artifact_type: "Fundraising Strategy", lead: "CFO", contributors: ["CEO", "CCO"], keywords: ["fundraising", "raise", "investor", "seed round", "series a", "capital raise", "pitch deck", "investor presentation"], report_type: "Fundraising Analysis" },
  { key: "investment_analysis", label: "Investment Analysis", artifact_type: "Investment Analysis", lead: "CFO", contributors: ["CLO"], keywords: ["investment", "valuation", "acquisition", "roi", "irr", "due diligence financial"], report_type: "Investment Analysis" },
  { key: "brand_strategy", label: "Brand Strategy", artifact_type: "Brand Strategy", lead: "CCO", contributors: ["CEO"], keywords: ["brand", "positioning", "identity", "messaging"], report_type: "Marketing Strategy" },
  { key: "marketing_campaign", label: "Marketing Campaign", artifact_type: "Campaign Plan", lead: "CCO", contributors: ["CFO"], keywords: ["campaign", "marketing", "launch", "social media", "content calendar", "landing page", "advertising"], report_type: "Marketing Strategy" },
  { key: "sales_material", label: "Sales Material", artifact_type: "Sales Material", lead: "CCO", contributors: [], keywords: ["sales", "one-pager", "proposal", "pitch", "sales deck"], report_type: "Sales Strategy" },
  { key: "public_relations", label: "Public Relations", artifact_type: "PR Plan", lead: "CCO", contributors: ["CLO"], keywords: ["press release", "pr ", "media", "announcement", "crisis communication"], report_type: "PR Strategy" },
  { key: "hr_plan", label: "HR Plan", artifact_type: "HR Plan", lead: "CHRO", contributors: ["CLO"], keywords: ["hr", "hiring", "recruit", "policy", "handbook", "onboarding employees", "compensation", "job description"], report_type: "People Strategy" },
  { key: "operations_plan", label: "Operations Plan", artifact_type: "Operations Plan", lead: "CHRO", contributors: ["CTO"], keywords: ["operations", "sop", "workflow", "process", "execution plan"], report_type: "Operating Review" },
  { key: "management_system", label: "Management System", artifact_type: "Management System", lead: "CHRO", contributors: ["CEO"], keywords: ["management system", "kpi", "accountability", "performance review", "cadence"], report_type: "Operating Review" },
  { key: "technology_strategy", label: "Technology Strategy", artifact_type: "Technology Strategy", lead: "CTO", contributors: ["CFO"], keywords: ["technology", "tech stack", "architecture", "software", "platform", "digital transformation"], report_type: "Technology Review" },
  { key: "ai_automation", label: "AI Automation", artifact_type: "Automation Plan", lead: "CTO", contributors: ["CHRO"], keywords: ["ai ", "automation", "automate", "machine learning", "agent"], report_type: "Technology Review" },
  { key: "research_report", label: "Research Report", artifact_type: "Research Report", lead: "CTO", contributors: [], keywords: ["research", "investigate", "landscape", "market research", "analyze this technology"], report_type: "Research Report" },
  { key: "cybersecurity_review", label: "Cybersecurity Review", artifact_type: "Security Review", lead: "CTO", contributors: ["CLO"], keywords: ["security", "cyber", "breach", "vulnerability", "penetration"], report_type: "Security Review" },
  { key: "governance_review", label: "Governance Review", artifact_type: "Governance Review", lead: "CLO", contributors: ["CEO"], keywords: ["governance", "board", "bylaws", "policy review"], report_type: "Governance Review" },
  { key: "legal_issue_analysis", label: "Legal Issue Analysis", artifact_type: "Legal Issue Analysis", lead: "CLO", contributors: [], keywords: ["contract", "legal", "agreement", "terms", "nda", "liability", "compliance", "regulation"], report_type: "Legal/Risk Review" },
  { key: "risk_review", label: "Risk Review", artifact_type: "Risk Review", lead: "CLO", contributors: ["CFO", "CTO"], keywords: ["risk", "downside", "exposure", "audit"], report_type: "Legal/Risk Review" },
  { key: "charity_strategy", label: "Charity Strategy", artifact_type: "Charity Strategy", lead: "CIO", contributors: ["CFO"], keywords: ["charity", "nonprofit", "donation", "giving"], report_type: "Philanthropy Strategy" },
  { key: "philanthropy_plan", label: "Philanthropy Plan", artifact_type: "Philanthropy Plan", lead: "CIO", contributors: ["CCO"], keywords: ["philanthropy", "foundation", "grant", "donor"], report_type: "Philanthropy Strategy" },
  { key: "sustainability_report", label: "Sustainability Report", artifact_type: "Sustainability Report", lead: "CIO", contributors: ["CLO"], keywords: ["sustainability", "esg", "carbon", "climate", "impact report", "social impact"], report_type: "Sustainability Report" },
];

export const DEFAULT_CAPABILITY_KEY = "executive_report";
