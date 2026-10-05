import Link from "next/link";
import { requireWriter } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { AiForm } from "../ai-form";

export const metadata = { title: "Add AI system" };

export default async function NewAiPage() {
  await requireWriter();
  return (
    <div className="max-w-3xl">
      <Link href="/app/ai" className="text-sm text-brand-2 hover:underline">← AI inventory</Link>
      <PageHeader title="Add an AI system" sub="Six questions give an explainable risk rating. You can change answers later." />
      <AiForm />
    </div>
  );
}
