/**
 * Shared domain types for Thought Authorities — A.I. C-Level.
 * Field names mirror PostgreSQL columns (snake_case) so the data layer needs
 * no mapping between the database and the application.
 */

export type UUID = string;
export type ISODate = string;

/* ------------------------------------------------------------------ */
/* Identity, organizations, membership                                 */
/* ------------------------------------------------------------------ */

export const ROLES = ["OWNER", "ADMIN", "EXECUTIVE", "MEMBER", "ADVISOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const SUBSCRIPTION_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface UserProfile {
  id: UUID;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  email_verified: boolean;
  onboarding_completed: boolean;
  created_at: ISODate;
}

export interface Organization {
  id: UUID;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_id: UUID;
  industry: string | null;
  subscription_status: SubscriptionStatus;
  is_demo: boolean;
  created_at: ISODate;
}

export interface OrganizationMember {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  role: Role;
  title: string | null;
  status: "ACTIVE" | "SUSPENDED";
  created_at: ISODate;
}

export interface Invitation {
  id: UUID;
  organization_id: UUID;
  email: string;
  role: Role;
  token_hash: string;
  invited_by: UUID;
  expires_at: ISODate;
  accepted_at: ISODate | null;
  created_at: ISODate;
}

export interface OrganizationConstitution {
  id: UUID;
  organization_id: UUID;
  mission: string;
  vision: string;
  values: string;
  business_model: string;
  leadership_philosophy: string;
  strategic_priorities: string;
  current_priorities: string;
  risk_tolerance: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";
  brand_voice: string;
  primary_audiences: string;
  financial_objectives: string;
  technology_objectives: string;
  impact_objectives: string;
  key_relationships: string;
  important_restrictions: string;
  decision_principles: string;
  operating_philosophy: string;
  updated_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* A.I. Executives                                                     */
/* ------------------------------------------------------------------ */

export const EXECUTIVE_ROLE_CODES = ["CEO", "CFO", "CCO", "CHRO", "CTO", "CLO", "CIO"] as const;
export type ExecutiveRoleCode = (typeof EXECUTIVE_ROLE_CODES)[number] | `CUSTOM_${string}`;

export type ExecutiveStatus = "AVAILABLE" | "WORKING" | "IN_SESSION" | "OFFLINE";

export interface AIExecutive {
  id: UUID;
  organization_id: UUID;
  role_code: ExecutiveRoleCode;
  slug: string;
  title: string;
  short_title: string;
  display_name: string | null;
  functional_mandate: string;
  description: string;
  avatar_url: string | null;
  accent: string;
  status: ExecutiveStatus;
  is_core: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface AIExecutivePersona {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  north_star: string;
  core_belief: string;
  leadership_promise: string;
  biography: string;
  personality: string;
  communication_style: string;
  decision_style: string;
  primary_question: string;
  system_instructions: string;
  reasoning_guidelines: string;
  output_preferences: string;
  risk_constraints: string;
}

export interface AIExecutiveSkill {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  name: string;
  description: string;
  priority: number;
}

export type ProviderId = "anthropic" | "openai" | "simulated";

export interface AIExecutiveModelConfig {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  primary_provider: ProviderId;
  primary_model: string;
  fallback_provider: ProviderId | null;
  fallback_model: string | null;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  token_budget: number;
  tool_permissions: string[];
  memory_categories: MemoryCategory[] | "ALL";
  prompt_key: string;
}

export interface AIExecutiveVoice {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  provider: string;
  voice_id: string;
  voice_name: string;
  settings_json: { playback_speed: number; [k: string]: unknown };
}

/** Fully resolved executive as returned by the AIExecutiveRegistry. */
export interface ResolvedExecutive extends AIExecutive {
  persona: AIExecutivePersona;
  skills: AIExecutiveSkill[];
  model: AIExecutiveModelConfig;
  voice: AIExecutiveVoice | null;
}

export interface HumanCeoIntelligence {
  id: UUID;
  organization_id: UUID;
  owner_user_id: UUID;
  kind: "PRINCIPLE" | "DECISION" | "WRITING" | "SPEECH" | "INTERVIEW" | "PREFERENCE" | "HISTORY";
  title: string;
  content: string;
  included: boolean;
  created_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* Conversations & Executive Comms                                     */
/* ------------------------------------------------------------------ */

export interface Conversation {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  user_id: UUID;
  project_id: UUID | null;
  title: string;
  created_at: ISODate;
  updated_at: ISODate;
}

export interface Message {
  id: UUID;
  organization_id: UUID;
  conversation_id: UUID;
  role: "user" | "executive";
  content: string;
  provider: ProviderId | null;
  model: string | null;
  prompt_version: string | null;
  simulated: boolean;
  created_at: ISODate;
}

export type CommsFolder = "INBOX" | "SENT" | "DRAFTS" | "ARCHIVED";

export interface Communication {
  id: UUID;
  organization_id: UUID;
  thread_id: UUID;
  subject: string;
  body: string;
  sender_type: "USER" | "EXECUTIVE";
  sender_id: UUID;
  recipient_executive_ids: UUID[];
  recipient_user_ids: UUID[];
  is_draft: boolean;
  starred: boolean;
  archived: boolean;
  read_at: ISODate | null;
  origin_type: "FILE" | "REPORT" | "CONVERSATION" | "SESSION" | "MEMORY" | "PROJECT" | "TEMPLATE" | null;
  origin_id: UUID | null;
  simulated: boolean;
  created_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* C-Level Sessions                                                    */
/* ------------------------------------------------------------------ */

export const SESSION_MODES = [
  "EXECUTIVE_ROUND",
  "CEO_SYNTHESIS",
  "RED_TEAM",
  "EVIDENCE_CHECK",
  "FINANCIAL_REVIEW",
  "RISK_REVIEW",
  "OPERATING_REVIEW",
  "MARKET_REVIEW",
  "IMPACT_REVIEW",
  "CONSENSUS",
  "DISSENT",
  "EXECUTIVE_VOTE",
  "DISCUSS_AND_VOTE",
  "DEEP_DIVE",
  "RAPID_SESSION",
] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export type SessionStatus = "DRAFT" | "ACTIVE" | "RUNNING" | "ADJOURNED" | "FAILED";

/** Progress of one round of a C-Level Session, which runs in bounded steps across requests. */
export interface SessionRunState {
  run_id: string;
  question: string;
  mode: SessionMode;
  participant_ids: string[];
  only_executive_id: string | null;
  vote_options: { id: string; label: string }[] | null;
  attachment_ids: string[];
  /** Index into the bounded stage plan. */
  stage_index: number;
  /** Per-executive progress in the current stage. */
  turns: Record<string, { text: string; done: boolean; attempts: number; empty_steps: number; sources?: { url: string; title: string; cited: boolean }[] }>;
  steps: number;
  lease_until: string | null;
  started_at: string;
}

export interface CSuiteSession {
  id: UUID;
  organization_id: UUID;
  project_id: UUID | null;
  created_by: UUID;
  title: string;
  objective: string;
  mode: SessionMode;
  status: SessionStatus;
  chair_executive_id: UUID | null;
  participant_executive_ids: UUID[];
  created_at: ISODate;
  started_at: ISODate | null;
  ended_at: ISODate | null;
  /** Present while a round is in progress or was interrupted (resumable). */
  run_state?: SessionRunState | null;
}

export interface CSuiteSessionMessage {
  id: UUID;
  organization_id: UUID;
  session_id: UUID;
  speaker_type: "USER" | "EXECUTIVE" | "SYSTEM";
  speaker_id: UUID | null;
  stage: string;
  content: string;
  sequence_number: number;
  provider: ProviderId | null;
  model: string | null;
  prompt_version: string | null;
  simulated: boolean;
  metadata: Record<string, unknown>;
  created_at: ISODate;
}

export interface CSuiteVote {
  id: UUID;
  organization_id: UUID;
  session_id: UUID;
  executive_id: UUID;
  option_id: string;
  /** Score (1–10) the executive gave the option they voted for. */
  score: number;
  reason: string;
  confidence: number;
  /** Every option's score (1–10) from this executive's scoring table. */
  scores_json?: Record<string, number> | null;
  created_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* Decisions                                                           */
/* ------------------------------------------------------------------ */

export interface Decision {
  id: UUID;
  organization_id: UUID;
  project_id: UUID | null;
  session_id: UUID | null;
  title: string;
  question: string;
  options_json: { id: string; label: string }[];
  chosen_option: string | null;
  /** The option the chair recommended after an Executive Vote (null for other modes). */
  recommended_option?: string | null;
  recommendation: string;
  rationale: string;
  risks_json: { risk: string; severity: "LOW" | "MEDIUM" | "HIGH" }[];
  financial_implications_json: Record<string, unknown> | null;
  technology_implications_json: Record<string, unknown> | null;
  people_implications_json: Record<string, unknown> | null;
  impact_implications_json: Record<string, unknown> | null;
  confidence: number;
  status: "PROPOSED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "DEFERRED";
  created_by: UUID;
  created_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* C-Level Memory                                                      */
/* ------------------------------------------------------------------ */

export const MEMORY_CATEGORIES = [
  "COMPANY",
  "PEOPLE",
  "RELATIONSHIPS",
  "PROJECTS",
  "STRATEGY",
  "DECISIONS",
  "FINANCE",
  "MEETINGS",
  "DOCUMENTS",
  "COMMUNICATIONS",
  "TECHNOLOGY",
  "HR",
  "BRAND",
  "GOVERNANCE",
  "IMPACT",
  "RISKS",
  "LESSONS",
  "DEADLINES",
  "PREFERENCES",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_STATUSES = ["PROPOSED", "VERIFIED", "USER_CONFIRMED", "SYSTEM_IMPORTED", "ARCHIVED"] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export type MemorySourceType =
  | "HUMAN_ENTRY"
  | "UPLOADED_DOCUMENT"
  | "EXECUTIVE_CONVERSATION"
  | "CSUITE_SESSION"
  | "REPORT"
  | "EXTERNAL_INTEGRATION"
  | "API"
  | "RESEARCH"
  | "IMPORT";

export interface MemoryRecord {
  id: UUID;
  organization_id: UUID;
  project_id: UUID | null;
  title: string;
  content: string;
  category: MemoryCategory;
  importance: number; // 1..5
  status: MemoryStatus;
  pinned: boolean;
  source_type: MemorySourceType;
  source_id: UUID | null;
  created_by: UUID;
  verified_by: UUID | null;
  confidence: number; // 0..1
  embedding: number[] | null;
  visibility: "ORGANIZATION" | "LEADERSHIP" | "OWNER_ONLY";
  executive_relevance: ExecutiveRoleCode[];
  created_at: ISODate;
  updated_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* Files, reports, projects, studio                                    */
/* ------------------------------------------------------------------ */

export interface FileRecord {
  id: UUID;
  organization_id: UUID;
  project_id: UUID | null;
  uploaded_by: UUID;
  filename: string;
  mime_type: string;
  size: number;
  storage_path: string;
  category: string;
  processing_status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  extracted_text: string | null;
  created_at: ISODate;
}

export const REPORT_TYPES = [
  "CEO Executive Brief",
  "Financial Review",
  "Fundraising Analysis",
  "Investment Analysis",
  "Communications Plan",
  "Marketing Strategy",
  "Sales Strategy",
  "PR Strategy",
  "People Strategy",
  "Operating Review",
  "Technology Review",
  "Research Report",
  "Security Review",
  "Governance Review",
  "Legal/Risk Review",
  "Impact Report",
  "Philanthropy Strategy",
  "Sustainability Report",
  "C-Level Session Minutes",
  "Decision Memo",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface Report {
  id: UUID;
  organization_id: UUID;
  project_id: UUID | null;
  report_type: ReportType;
  title: string;
  summary: string;
  content: string;
  lead_executive_id: UUID;
  contributing_executive_ids: UUID[];
  sources: { label: string; url?: string }[];
  version: number;
  source_session_id: UUID | null;
  simulated: boolean;
  created_by: UUID;
  created_at: ISODate;
}

export interface Project {
  id: UUID;
  organization_id: UUID;
  name: string;
  description: string;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  owner_id: UUID;
  created_at: ISODate;
}

export const PRODUCTION_STATUSES = [
  "DRAFT",
  "QUEUED",
  "ROUTING",
  "IN_PROGRESS",
  "AWAITING_REVIEW",
  "REVISION_REQUESTED",
  "COMPLETED",
  "FAILED",
  "ARCHIVED",
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export interface ProductionJob {
  id: UUID;
  organization_id: UUID;
  project_id: UUID | null;
  requested_by: UUID;
  request: string;
  title: string;
  artifact_type: string;
  capability_key: string;
  lead_executive_id: UUID;
  contributor_executive_ids: UUID[];
  status: ProductionStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  provider: ProviderId | null;
  model: string | null;
  created_at: ISODate;
  started_at: ISODate | null;
  completed_at: ISODate | null;
  metadata: Record<string, unknown>;
}

export interface ProductionArtifact {
  id: UUID;
  organization_id: UUID;
  job_id: UUID;
  version: number;
  artifact_type: string;
  content: string;
  file_id: UUID | null;
  revision_note: string | null;
  simulated: boolean;
  created_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* Platform                                                            */
/* ------------------------------------------------------------------ */

export interface AuditLog {
  id: UUID;
  organization_id: UUID | null;
  actor_id: UUID | null;
  event_type: string;
  entity_type: string;
  entity_id: UUID | null;
  metadata: Record<string, unknown>;
  timestamp: ISODate;
}

export interface Notification {
  id: UUID;
  organization_id: UUID;
  user_id: UUID;
  type: string;
  title: string;
  message: string;
  target_url: string | null;
  read_at: ISODate | null;
  created_at: ISODate;
}

export interface ApprovalRequest {
  id: UUID;
  organization_id: UUID;
  proposed_by_executive_id: UUID;
  action_type: "SEND_EXTERNAL_EMAIL" | "PUBLISH_CONTENT" | "SHARE_FILE" | "FINANCIAL_TRANSACTION" | "CHANGE_PERMISSIONS" | "DELETE_RECORD" | "EXTERNAL_ACCOUNT_ACTION";
  summary: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";
  reviewed_by: UUID | null;
  created_at: ISODate;
}

export interface UsageRecord {
  id: UUID;
  organization_id: UUID;
  user_id: UUID | null;
  executive_id: UUID | null;
  provider: ProviderId;
  model: string;
  request_type: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  correlation_id: string;
  success: boolean;
  created_at: ISODate;
}

export interface ProviderCredential {
  id: UUID;
  organization_id: UUID;
  provider: ProviderId | "elevenlabs";
  /** Encrypted at rest; never returned to the browser. */
  encrypted_secret: string;
  last_four: string;
  preferred_model: string | null;
  fallback_model: string | null;
  monthly_usage_limit_usd: number | null;
  enabled: boolean;
  created_at: ISODate;
}

/* ------------------------------------------------------------------ */
/* Executive learning (feedback → lessons) and the Executive Library    */
/* ------------------------------------------------------------------ */

/** A person's rating of one executive answer. */
export interface ExecutiveFeedback {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  source_type: "CONVERSATION" | "SESSION";
  /** The message rated (messages.id or executive_session_messages.id). */
  source_id: UUID;
  rating: "UP" | "DOWN";
  /** What the answer should have said or done differently. */
  comment: string;
  /** The lesson drafted from this feedback, if any. */
  lesson_id: UUID | null;
  created_by: UUID;
  created_at: ISODate;
}

/**
 * A standing lesson for one executive. Drafted from feedback (by A.I.) or
 * written by a person; only APPROVED lessons are applied to answers.
 */
export interface ExecutiveLesson {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  title: string;
  guidance: string;
  status: "PROPOSED" | "APPROVED" | "ARCHIVED";
  origin: "FEEDBACK" | "MANUAL";
  source_feedback_id: UUID | null;
  created_by: UUID;
  approved_by: UUID | null;
  created_at: ISODate;
  updated_at: ISODate;
}

/** Reference knowledge for one executive: frameworks, playbooks, references and documents. */
export interface ExecutiveLibraryItem {
  id: UUID;
  organization_id: UUID;
  executive_id: UUID;
  kind: "FRAMEWORK" | "PLAYBOOK" | "REFERENCE" | "DOCUMENT";
  title: string;
  content: string;
  /** For DOCUMENT items: the file the text was taken from. */
  file_id: UUID | null;
  /** STARTER items come with the platform (they can be turned off, not deleted). */
  origin: "STARTER" | "ORGANIZATION";
  /** Stable key of a starter item, so it is added only once. */
  starter_key: string | null;
  enabled: boolean;
  embedding: number[] | null;
  created_by: UUID | null;
  created_at: ISODate;
  updated_at: ISODate;
}
