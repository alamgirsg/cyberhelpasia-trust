import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  date,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Tenancy & identity ----------

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  uen: text("uen"),
  plan: text("plan").notNull().default("trial"),
  /** Opt-in: when false, policy drafts come from built-in templates and nothing is sent to an AI provider. */
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** AES-256-GCM encrypted TOTP secret (see src/lib/crypto.ts). Null until enrolment starts. */
    mfaSecretEnc: text("mfa_secret_enc"),
    mfaEnabledAt: timestamp("mfa_enabled_at", { withTimezone: true }),
    /** Last accepted TOTP time-step, to block code replay. */
    mfaLastStep: integer("mfa_last_step"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const mfaRecoveryCodes = pgTable(
  "mfa_recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [index("recovery_user_idx").on(t.userId)],
);

export const ROLES = ["owner", "admin", "contributor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull().default("contributor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_tenant_user_uq").on(t.tenantId, t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<Role>().notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invites_token_uq").on(t.tokenHash), index("invites_tenant_idx").on(t.tenantId)],
);

// ---------- Framework library (global, not tenant-scoped) ----------

export const frameworks = pgTable("frameworks", {
  id: text("id").primaryKey(), // e.g. "CE", "CTM"
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description").notNull(),
  /** Label for controls.isoRefs in this framework, e.g. "ISO/IEC 27001:2022 (indicative)". */
  refLabel: text("ref_label").notNull().default("ISO/IEC 27001:2022 (indicative)"),
});

export const controls = pgTable(
  "controls",
  {
    id: text("id").primaryKey(), // e.g. "CE-1.1"
    frameworkId: text("framework_id").notNull().references(() => frameworks.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    ref: text("ref").notNull(),
    title: text("title").notNull(),
    guidance: text("guidance").notNull(),
    evidenceHint: text("evidence_hint").notNull(),
    isoRefs: text("iso_refs"),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("controls_framework_idx").on(t.frameworkId)],
);

// ---------- Assessments ----------

export const RESPONSE_STATUSES = ["not_started", "not_met", "partial", "met", "na"] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    frameworkId: text("framework_id").notNull().references(() => frameworks.id),
    name: text("name").notNull(),
    profile: jsonb("profile").$type<Record<string, string>>(),
    status: text("status").notNull().default("in_progress"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assessments_tenant_idx").on(t.tenantId)],
);

export const controlResponses = pgTable(
  "control_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
    controlId: text("control_id").notNull().references(() => controls.id),
    status: text("status").$type<ResponseStatus>().notNull().default("not_started"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("responses_assessment_control_uq").on(t.assessmentId, t.controlId),
    index("responses_tenant_idx").on(t.tenantId),
  ],
);

// ---------- Remediation tasks ----------

export const TASK_STATUSES = ["open", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "cascade" }),
    controlId: text("control_id").references(() => controls.id),
    title: text("title").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date"),
    priority: text("priority").$type<Priority>().notNull().default("medium"),
    status: text("status").$type<TaskStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_tenant_idx").on(t.tenantId)],
);

// ---------- Evidence vault ----------

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "set null" }),
    controlId: text("control_id").references(() => controls.id),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    description: text("description"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("evidence_tenant_idx").on(t.tenantId)],
);

// ---------- Policies ----------

export const POLICY_STATUSES = ["draft", "approved", "superseded"] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const policies = pgTable(
  "policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    policyType: text("policy_type").notNull(),
    title: text("title").notNull(),
    version: integer("version").notNull(),
    status: text("status").$type<PolicyStatus>().notNull().default("draft"),
    content: text("content").notNull(),
    /** "ai" or "template" */
    source: text("source").notNull(),
    model: text("model"),
    inputs: jsonb("inputs").$type<Record<string, string>>(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    /** Stored copy of the approved text, so it can be filed as evidence in assessments created later. */
    fileKey: text("file_key"),
    fileSha256: text("file_sha256"),
    fileSize: integer("file_size"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("policies_tenant_idx").on(t.tenantId),
    uniqueIndex("policies_type_version_uq").on(t.tenantId, t.policyType, t.version),
  ],
);

// ---------- AI Assurance: AI system inventory ----------

export const AI_STATUSES = ["proposed", "pilot", "production", "retired"] as const;
export type AiStatus = (typeof AI_STATUSES)[number];
export const RISK_RATINGS = ["low", "medium", "high"] as const;
export type RiskRating = (typeof RISK_RATINGS)[number];

export const aiSystems = pgTable(
  "ai_systems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    businessOwner: text("business_owner"),
    vendor: text("vendor"),
    model: text("model"),
    status: text("status").$type<AiStatus>().notNull().default("proposed"),
    /** Risk-factor answers (see src/lib/ai-risk.ts). */
    factors: jsonb("factors").$type<Record<string, string>>().notNull(),
    computedRating: text("computed_rating").$type<RiskRating>().notNull(),
    /** A person may override the computed rating, with a written reason. */
    overrideRating: text("override_rating").$type<RiskRating>(),
    overrideReason: text("override_reason"),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_systems_tenant_idx").on(t.tenantId)],
);

// ---------- AI Assurance: manual red-team engagements ----------

export const ENGAGEMENT_STATUSES = ["planned", "in_progress", "completed"] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];
export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const FINDING_STATUSES = ["open", "fixed", "accepted"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/**
 * A manual, authorised red-team engagement against ONE AI system the tenant owns.
 * authorisedBy / authorisedAt record who confirmed authorisation; an engagement cannot exist without it.
 */
export const engagements = pgTable(
  "engagements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    aiSystemId: uuid("ai_system_id").notNull().references(() => aiSystems.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    scopeIn: text("scope_in").notNull(),
    scopeOut: text("scope_out"),
    status: text("status").$type<EngagementStatus>().notNull().default("planned"),
    authorisedBy: uuid("authorised_by").references(() => users.id, { onDelete: "set null" }),
    authorisedByName: text("authorised_by_name").notNull(),
    authorisedAt: timestamp("authorised_at", { withTimezone: true }).notNull().defaultNow(),
    startedOn: date("started_on"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("engagements_tenant_idx").on(t.tenantId), index("engagements_system_idx").on(t.aiSystemId)],
);

export const findings = pgTable(
  "findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    engagementId: uuid("engagement_id").notNull().references(() => engagements.id, { onDelete: "cascade" }),
    testId: text("test_id"),
    title: text("title").notNull(),
    severity: text("severity").$type<Severity>().notNull(),
    status: text("status").$type<FindingStatus>().notNull().default("open"),
    detail: text("detail"),
    remediation: text("remediation"),
    evidenceId: uuid("evidence_id").references(() => evidence.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("findings_engagement_idx").on(t.engagementId)],
);

// ---------- Audit log ----------

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_tenant_idx").on(t.tenantId, t.createdAt)],
);
