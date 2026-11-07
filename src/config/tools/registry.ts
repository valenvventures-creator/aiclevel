/**
 * Tool registry — every tool an A.I. Executive may be granted.
 * Grants live per executive in `ai_executive_model_configs.tool_permissions`
 * (database-driven). `requiresApproval` tools must go through the Human
 * Approval Layer (propose → review → approve → execute).
 */
export interface ToolDefinition {
  key: string;
  label: string;
  description: string;
  kind: "internal" | "mcp" | "provider";
  risk: "read" | "compute" | "external_read" | "external_write";
  requiresApproval: boolean;
  /** Available only once an integration is connected. */
  requiresIntegration?: string;
}

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  search_memory: { key: "search_memory", label: "C-Suite Memory", description: "Search verified organizational intelligence.", kind: "internal", risk: "read", requiresApproval: false },
  search_files: { key: "search_files", label: "File search", description: "Search the organization's document library.", kind: "internal", risk: "read", requiresApproval: false },
  get_project: { key: "get_project", label: "Project context", description: "Read a project workspace.", kind: "internal", risk: "read", requiresApproval: false },
  get_decision: { key: "get_decision", label: "Decision record", description: "Read structured decisions.", kind: "internal", risk: "read", requiresApproval: false },
  get_organization_profile: { key: "get_organization_profile", label: "Organization profile", description: "Read the Organization Constitution.", kind: "internal", risk: "read", requiresApproval: false },
  calculator: { key: "calculator", label: "Calculator", description: "Deterministic arithmetic for financial analysis.", kind: "internal", risk: "compute", requiresApproval: false },
  spreadsheet_analysis: { key: "spreadsheet_analysis", label: "Spreadsheet analysis", description: "Analyze CSV/XLSX data.", kind: "internal", risk: "compute", requiresApproval: false },
  web_research: { key: "web_research", label: "Web research", description: "Provider-hosted web search with citations.", kind: "provider", risk: "external_read", requiresApproval: false },
  market_data: { key: "market_data", label: "Market data", description: "Approved market-data integration.", kind: "mcp", risk: "external_read", requiresApproval: false, requiresIntegration: "market_data" },
  code_tools: { key: "code_tools", label: "Code tools", description: "Sandboxed code execution.", kind: "provider", risk: "compute", requiresApproval: false },
  security_analysis: { key: "security_analysis", label: "Security analysis", description: "Security posture review tooling.", kind: "mcp", risk: "external_read", requiresApproval: false, requiresIntegration: "security" },
  policy_search: { key: "policy_search", label: "Policy search", description: "Governance and policy document search.", kind: "internal", risk: "read", requiresApproval: false },
  send_email: { key: "send_email", label: "Send email", description: "Send external email via Gmail/Outlook.", kind: "mcp", risk: "external_write", requiresApproval: true, requiresIntegration: "email" },
  calendar: { key: "calendar", label: "Calendar", description: "Read or propose calendar events.", kind: "mcp", risk: "external_write", requiresApproval: true, requiresIntegration: "calendar" },
  crm: { key: "crm", label: "CRM", description: "Read or update CRM records.", kind: "mcp", risk: "external_write", requiresApproval: true, requiresIntegration: "crm" },
  accounting: { key: "accounting", label: "Accounting", description: "Read accounting ledgers.", kind: "mcp", risk: "external_read", requiresApproval: false, requiresIntegration: "accounting" },
};

export function isToolGranted(granted: readonly string[], toolKey: string): boolean {
  return granted.includes(toolKey) && toolKey in TOOL_REGISTRY;
}
