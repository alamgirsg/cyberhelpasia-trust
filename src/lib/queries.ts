import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readiness } from "./score";

export async function listAssessments(tenantId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.assessments.id,
      name: schema.assessments.name,
      frameworkId: schema.assessments.frameworkId,
      createdAt: schema.assessments.createdAt,
      domain: schema.controls.domain,
      status: schema.controlResponses.status,
    })
    .from(schema.assessments)
    .leftJoin(schema.controlResponses, eq(schema.controlResponses.assessmentId, schema.assessments.id))
    .leftJoin(schema.controls, eq(schema.controls.id, schema.controlResponses.controlId))
    .where(eq(schema.assessments.tenantId, tenantId))
    .orderBy(desc(schema.assessments.createdAt));

  const map = new Map<string, { id: string; name: string; frameworkId: string; createdAt: Date; items: { domain: string; status: (typeof rows)[number]["status"] & string }[] }>();
  for (const r of rows) {
    const a = map.get(r.id) ?? { id: r.id, name: r.name, frameworkId: r.frameworkId, createdAt: r.createdAt, items: [] };
    if (r.domain && r.status) a.items.push({ domain: r.domain, status: r.status });
    map.set(r.id, a);
  }
  return [...map.values()].map((a) => ({ ...a, score: readiness(a.items) }));
}

export async function getAssessment(tenantId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [a] = await db
    .select()
    .from(schema.assessments)
    .where(and(eq(schema.assessments.id, id), eq(schema.assessments.tenantId, tenantId)))
    .limit(1);
  if (!a) return null;
  const items = await db
    .select({
      controlId: schema.controls.id,
      domain: schema.controls.domain,
      ref: schema.controls.ref,
      title: schema.controls.title,
      guidance: schema.controls.guidance,
      evidenceHint: schema.controls.evidenceHint,
      isoRefs: schema.controls.isoRefs,
      status: schema.controlResponses.status,
      notes: schema.controlResponses.notes,
      updatedAt: schema.controlResponses.updatedAt,
    })
    .from(schema.controlResponses)
    .innerJoin(schema.controls, eq(schema.controls.id, schema.controlResponses.controlId))
    .where(and(eq(schema.controlResponses.assessmentId, id), eq(schema.controlResponses.tenantId, tenantId)))
    .orderBy(asc(schema.controls.sortOrder));

  const ev = await db
    .select({ controlId: schema.evidence.controlId, n: sql<number>`count(*)::int` })
    .from(schema.evidence)
    .where(and(eq(schema.evidence.tenantId, tenantId), eq(schema.evidence.assessmentId, id)))
    .groupBy(schema.evidence.controlId);
  const evidenceCount = new Map(ev.map((e) => [e.controlId ?? "", e.n]));

  return { assessment: a, items, evidenceCount, score: readiness(items) };
}
