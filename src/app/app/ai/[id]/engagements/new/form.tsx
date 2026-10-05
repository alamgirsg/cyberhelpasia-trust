"use client";

import { useActionState } from "react";
import { createEngagement } from "@/app/actions/engagements";

export function NewEngagementForm({
  aiSystemId,
  systemName,
  suggested,
}: {
  aiSystemId: string;
  systemName: string;
  suggested: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createEngagement, undefined);
  const v = state?.values ?? {};
  const defaultScope = suggested.length
    ? `Test ${systemName} for: ${suggested.map((t) => `${t.id} ${t.name}`).join(", ")}.`
    : "";
  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="aiSystemId" value={aiSystemId} />
      <div>
        <label className="label" htmlFor="title">Engagement title</label>
        <input id="title" name="title" className="input" required maxLength={160} defaultValue={v.title ?? `Red-team: ${systemName}`} />
      </div>
      <div>
        <label className="label" htmlFor="scopeIn">In scope</label>
        <textarea id="scopeIn" name="scopeIn" className="input" rows={3} required maxLength={2000} defaultValue={v.scopeIn ?? defaultScope} />
      </div>
      <div>
        <label className="label" htmlFor="scopeOut">Out of scope <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="scopeOut" name="scopeOut" className="input" rows={2} maxLength={2000} defaultValue={v.scopeOut} placeholder="e.g. Production customer data; third-party or shared systems; the model provider's own platform." />
      </div>
      <div>
        <label className="label" htmlFor="startedOn">Start date <span className="font-normal text-muted">(optional)</span></label>
        <input id="startedOn" name="startedOn" type="date" className="input max-w-xs" defaultValue={v.startedOn} />
      </div>
      <label className="flex items-start gap-2 rounded-lg bg-paper p-3 text-sm">
        <input type="checkbox" name="authorise" required className="mt-1 accent-brand-2" />
        <span>I confirm that <span className="font-semibold">{systemName}</span> belongs to this organisation and that I am authorised to carry out, or commission, security testing of it within the scope above. My name and the date are recorded.</span>
      </label>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create engagement"}</button>
    </form>
  );
}
