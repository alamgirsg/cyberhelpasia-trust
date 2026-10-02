import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { policyById } from "@/content/policies";
import { newVersion } from "@/app/actions/policies";
import { Markdown } from "@/components/markdown";
import { Badge, PageHeader } from "@/components/ui";
import { DraftEditor } from "./draft-editor";

export const metadata = { title: "Policy" };

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [p] = await db
    .select({ policy: schema.policies, approver: schema.users.name })
    .from(schema.policies)
    .leftJoin(schema.users, eq(schema.users.id, schema.policies.approvedBy))
    .where(and(eq(schema.policies.id, id), eq(schema.policies.tenantId, ctx.tenantId)))
    .limit(1);
  if (!p) notFound();
  const { policy } = p;
  const def = policyById(policy.policyType);
  const canWrite = ctx.role !== "viewer";
  const canApprove = ctx.role === "owner" || ctx.role === "admin";
  const isDraft = policy.status === "draft";

  return (
    <div className="max-w-3xl">
      <Link href="/app/policies" className="text-sm text-brand-2 hover:underline">← All policies</Link>
      <PageHeader
        title={`${policy.title} · v${policy.version}`}
        sub={
          policy.status === "approved"
            ? `Approved by ${p.approver ?? "—"} on ${policy.approvedAt?.toLocaleDateString("en-SG")}`
            : policy.status === "superseded"
              ? "Superseded by a newer approved version"
              : policy.source === "ai"
                ? `AI first draft (${policy.model}). Review every section before approving.`
                : "Draft. Complete the placeholders in [brackets] before approving."
        }
        action={<Badge kind={isDraft ? "partial" : policy.status === "approved" ? "met" : "na"}>{isDraft ? "Draft" : policy.status === "approved" ? "Approved" : "Superseded"}</Badge>}
      />

      {isDraft && canWrite ? (
        <DraftEditor
          policyId={policy.id}
          content={policy.content}
          canApprove={canApprove}
          approverName={ctx.userName}
          tenantName={ctx.tenantName}
          controls={def?.controls ?? []}
        />
      ) : (
        <article className="card p-6" data-testid="policy-body"><Markdown source={policy.content} /></article>
      )}

      {!isDraft && canWrite && (
        <form action={newVersion} className="mt-4">
          <input type="hidden" name="policyId" value={policy.id} />
          <button className="btn-ghost">Start a new version from this one</button>
        </form>
      )}
    </div>
  );
}
