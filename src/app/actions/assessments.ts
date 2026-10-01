"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { requireWriter } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { recommend, type Profile } from "@/lib/profile";
import { RESPONSE_STATUSES, TASK_STATUSES, PRIORITIES } from "@/db/schema";

const profileSchema = z.object({
  staff: z.enum(["1-10", "11-50", "51-200", "200+"]),
  licensedProvider: z.enum(["yes", "no"]),
  sellsToGovOrCii: z.enum(["yes", "no"]),
  sensitiveData: z.enum(["yes", "no"]),
  digitalDependence: z.enum(["low", "medium", "high"]),
  override: z.enum(["auto", "CE", "CTM"]).default("auto"),
});

/** Creates an assessment from the risk-profile wizard, with one response row per control. */
export async function startAssessment(form: FormData) {
  const ctx = await requireWriter();
  const parsed = profileSchema.parse(Object.fromEntries(form));
  const { override, ...profile } = parsed;
  const rec = recommend(profile as Profile);
  const frameworkId = override === "auto" ? rec.frameworkId : override;

  const db = await getDb();
  const [fw] = await db.select().from(schema.frameworks).where(eq(schema.frameworks.id, frameworkId)).limit(1);
  if (!fw) throw new Error("Framework not found. Run the seed script.");
  const ctrls = await db.select({ id: schema.controls.id }).from(schema.controls).where(eq(schema.controls.frameworkId, frameworkId));

  const id = await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(schema.assessments)
      .values({ tenantId: ctx.tenantId, frameworkId, name: fw.name, profile: { ...profile, recommended: rec.frameworkId } })
      .returning({ id: schema.assessments.id });
    if (ctrls.length) {
      await tx.insert(schema.controlResponses).values(
        ctrls.map((c) => ({ tenantId: ctx.tenantId, assessmentId: a.id, controlId: c.id })),
      );
    }
    return a.id;
  });
  await audit(ctx.tenantId, ctx.userId, "assessment.created", "assessment", id, { frameworkId });
  redirect(`/app/assessments/${id}`);
}

const responseSchema = z.object({
  assessmentId: z.string().uuid(),
  controlId: z.string().min(1),
  status: z.enum(RESPONSE_STATUSES),
  notes: z.string().max(4000).optional(),
});

/**
 * Saves a gap-assessment answer. Remediation is automatic:
 * not met / partial → an open task is created (if none open); met / n.a. → open tasks are closed.
 */
export async function saveResponse(form: FormData) {
  const ctx = await requireWriter();
  const data = responseSchema.parse(Object.fromEntries(form));
  const db = await getDb();

  const [resp] = await db
    .select({ id: schema.controlResponses.id, status: schema.controlResponses.status, title: schema.controls.title })
    .from(schema.controlResponses)
    .innerJoin(schema.controls, eq(schema.controls.id, schema.controlResponses.controlId))
    .where(
      and(
        eq(schema.controlResponses.tenantId, ctx.tenantId),
        eq(schema.controlResponses.assessmentId, data.assessmentId),
        eq(schema.controlResponses.controlId, data.controlId),
      ),
    )
    .limit(1);
  if (!resp) throw new Error("Not found");

  await db
    .update(schema.controlResponses)
    .set({ status: data.status, notes: data.notes ?? null, ownerId: ctx.userId, updatedAt: new Date() })
    .where(eq(schema.controlResponses.id, resp.id));

  const taskScope = and(
    eq(schema.tasks.tenantId, ctx.tenantId),
    eq(schema.tasks.assessmentId, data.assessmentId),
    eq(schema.tasks.controlId, data.controlId),
    ne(schema.tasks.status, "done"),
  );

  if (data.status === "not_met" || data.status === "partial") {
    const open = await db.select({ id: schema.tasks.id }).from(schema.tasks).where(taskScope).limit(1);
    if (!open.length) {
      const due = new Date(Date.now() + (data.status === "not_met" ? 30 : 60) * 864e5).toISOString().slice(0, 10);
      await db.insert(schema.tasks).values({
        tenantId: ctx.tenantId,
        assessmentId: data.assessmentId,
        controlId: data.controlId,
        title: `Close gap: ${resp.title}`,
        priority: data.status === "not_met" ? "high" : "medium",
        dueDate: due,
        assigneeId: ctx.userId,
      });
    }
  } else if (data.status === "met" || data.status === "na") {
    await db.update(schema.tasks).set({ status: "done" }).where(taskScope);
  }

  await audit(ctx.tenantId, ctx.userId, "response.updated", "control", data.controlId, {
    assessmentId: data.assessmentId,
    from: resp.status,
    to: data.status,
  });
  revalidatePath(`/app/assessments/${data.assessmentId}`);
  revalidatePath("/app");
  revalidatePath("/app/tasks");
}

const taskSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
});

export async function updateTask(form: FormData) {
  const ctx = await requireWriter();
  const data = taskSchema.parse(Object.fromEntries(form));
  const db = await getDb();
  const res = await db
    .update(schema.tasks)
    .set({ status: data.status, priority: data.priority, dueDate: data.dueDate || null })
    .where(and(eq(schema.tasks.id, data.taskId), eq(schema.tasks.tenantId, ctx.tenantId)))
    .returning({ id: schema.tasks.id });
  if (res.length) await audit(ctx.tenantId, ctx.userId, "task.updated", "task", data.taskId, data);
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

export async function deleteAssessment(form: FormData) {
  const ctx = await requireWriter();
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Only owners and admins can delete assessments.");
  const id = z.string().uuid().parse(form.get("assessmentId"));
  const db = await getDb();
  await db.delete(schema.tasks).where(and(eq(schema.tasks.tenantId, ctx.tenantId), inArray(schema.tasks.assessmentId, [id])));
  await db.delete(schema.assessments).where(and(eq(schema.assessments.id, id), eq(schema.assessments.tenantId, ctx.tenantId)));
  await audit(ctx.tenantId, ctx.userId, "assessment.deleted", "assessment", id);
  redirect("/app");
}
