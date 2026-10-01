import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---------- Tenancy & identity ----------

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  uen: text("uen"),
  plan: text("plan").notNull().default("trial"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
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

// ---------- Framework library (global, not tenant-scoped) ----------

export const frameworks = pgTable("frameworks", {
  id: text("id").primaryKey(), // e.g. "CE", "CTM"
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description").notNull(),
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
