import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { suggestedTests } from "@/lib/ai-risk";
import { PageHeader } from "@/components/ui";
import { NewEngagementForm } from "./form";

export const metadata = { title: "New red-team engagement" };

export default async function NewEngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect(`/app/ai/${id}`);
  const db = await getDb();
  const [sys] = await db
    .select()
    .from(schema.aiSystems)
    .where(and(eq(schema.aiSystems.id, id), eq(schema.aiSystems.tenantId, ctx.tenantId)))
    .limit(1);
  if (!sys) notFound();
  const tests = suggestedTests(sys.factors);

  return (
    <div className="max-w-2xl">
      <Link href={`/app/ai/${id}`} className="text-sm text-brand-2 hover:underline">← {sys.name}</Link>
      <PageHeader title="Authorise a red-team engagement" sub="Record what will be tested and confirm you are authorised. The platform does not run any test itself." />
      <NewEngagementForm aiSystemId={id} systemName={sys.name} suggested={tests} />
    </div>
  );
}
