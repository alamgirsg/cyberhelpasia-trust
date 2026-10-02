import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireWriter } from "@/lib/auth";
import { policyById } from "@/content/policies";
import { aiConfigured } from "@/lib/policy-ai";
import { PageHeader } from "@/components/ui";
import { GenerateForm } from "./generate-form";

export const metadata = { title: "New policy draft" };

export default async function NewPolicyPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await requireWriter();
  const { type } = await searchParams;
  const def = type ? policyById(type) : undefined;
  if (!def) notFound();
  const db = await getDb();
  const [tenant] = await db.select({ aiEnabled: schema.tenants.aiEnabled }).from(schema.tenants).where(eq(schema.tenants.id, ctx.tenantId)).limit(1);
  const useAi = tenant.aiEnabled && aiConfigured();

  return (
    <div className="max-w-2xl">
      <PageHeader title={`New draft: ${def.name}`} sub={def.purpose} />
      <GenerateForm policyType={def.id} companyName={ctx.tenantName} useAi={useAi} sections={def.sections} />
    </div>
  );
}
