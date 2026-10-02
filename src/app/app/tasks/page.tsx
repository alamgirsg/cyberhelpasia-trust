import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { updateTask } from "@/app/actions/assessments";
import { PRIORITIES, TASK_STATUSES } from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Remediation tasks" };

const LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", done: "Done", high: "High", medium: "Medium", low: "Low" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const ctx = await requireCtx();
  const { show } = await searchParams;
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.tasks.id,
      title: schema.tasks.title,
      status: schema.tasks.status,
      priority: schema.tasks.priority,
      dueDate: schema.tasks.dueDate,
      controlId: schema.tasks.controlId,
      assessmentId: schema.tasks.assessmentId,
      assignee: schema.users.name,
    })
    .from(schema.tasks)
    .leftJoin(schema.users, eq(schema.users.id, schema.tasks.assigneeId))
    .where(eq(schema.tasks.tenantId, ctx.tenantId))
    .orderBy(asc(schema.tasks.dueDate));

  const visible = show === "all" ? rows : rows.filter((r) => r.status !== "done");
  const prio = { high: 0, medium: 1, low: 2 } as const;
  visible.sort((a, b) => prio[a.priority] - prio[b.priority] || (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
  const canWrite = ctx.role !== "viewer";

  return (
    <div>
      <PageHeader
        title="Remediation tasks"
        sub="Created automatically from gaps in your assessments."
        action={
          <Link href={show === "all" ? "/app/tasks" : "/app/tasks?show=all"} className="btn-ghost">
            {show === "all" ? "Hide completed" : "Show completed"}
          </Link>
        }
      />
      {!visible.length ? (
        <div className="card p-8 text-center text-sm text-muted">No open tasks. Mark controls as “Not met” or “Partially met” to generate them.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((t) => (
            <div key={t.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.controlId && t.assessmentId && (
                      <Link href={`/app/assessments/${t.assessmentId}`} className="font-mono hover:underline">{t.controlId}</Link>
                    )}
                    {t.assignee ? ` · ${t.assignee}` : ""}
                    {t.dueDate ? ` · due ${t.dueDate}` : ""}
                  </p>
                </div>
                <Badge kind={t.priority}>{LABEL[t.priority]}</Badge>
                <Badge kind={t.status}>{LABEL[t.status]}</Badge>
              </div>
              {canWrite && (
                <form key={`${t.status}-${t.priority}-${t.dueDate ?? ""}`} action={updateTask} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="taskId" value={t.id} />
                  <select name="status" defaultValue={t.status} className="input w-auto" aria-label="Status">
                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                  </select>
                  <select name="priority" defaultValue={t.priority} className="input w-auto" aria-label="Priority">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
                  </select>
                  <input type="date" name="dueDate" defaultValue={t.dueDate ?? ""} className="input w-auto" aria-label="Due date" />
                  <button className="btn-ghost">Update</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
