"use client";

import { useActionState } from "react";
import { generatePolicy } from "@/app/actions/policies";

const FIELDS: Array<{ name: string; label: string; placeholder: string; max: number; area?: boolean }> = [
  { name: "industry", label: "Industry", placeholder: "e.g. Logistics, healthcare clinic, fintech", max: 80 },
  { name: "staffCount", label: "Number of staff", placeholder: "e.g. 45", max: 20 },
  { name: "itEnvironment", label: "IT environment", placeholder: "e.g. Microsoft 365, laptops managed with Intune, AWS for our app, outsourced IT support", max: 400, area: true },
  { name: "policyOwnerRole", label: "Policy owner (role, not a name)", placeholder: "e.g. Head of IT", max: 80 },
  { name: "reviewFrequency", label: "Review frequency", placeholder: "annually", max: 40 },
  { name: "extraNotes", label: "Anything specific to include", placeholder: "e.g. Staff work from home two days a week", max: 600, area: true },
];

export function GenerateForm({ policyType, companyName, useAi, sections }: { policyType: string; companyName: string; useAi: boolean; sections: string[] }) {
  const [state, action, pending] = useActionState(generatePolicy, undefined);
  const v = state?.values ?? {};
  return (
    <form action={action} className="card space-y-4 p-6">
      <input type="hidden" name="policyType" value={policyType} />
      <div>
        <label className="label" htmlFor="companyName">Organisation name</label>
        <input id="companyName" name="companyName" className="input" defaultValue={v.companyName ?? companyName} required maxLength={120} />
      </div>
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label className="label" htmlFor={f.name}>{f.label}</label>
          {f.area ? (
            <textarea id={f.name} name={f.name} className="input" rows={3} maxLength={f.max} placeholder={f.placeholder} defaultValue={v[f.name]} />
          ) : (
            <input id={f.name} name={f.name} className="input" maxLength={f.max} placeholder={f.placeholder} defaultValue={v[f.name]} />
          )}
        </div>
      ))}
      <div className="rounded-lg bg-paper p-3 text-xs text-ink-2">
        {useAi ? (
          <p><span className="font-semibold">Sent to Claude (Anthropic):</span> only the fields on this form and the policy outline. Do not enter personal data, passwords or secrets.</p>
        ) : (
          <p><span className="font-semibold">Template mode:</span> nothing leaves this server. The draft will contain placeholders for you to complete.</p>
        )}
        <p className="mt-1">Sections: {sections.join(" · ")}</p>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? (useAi ? "Drafting with AI… (up to a minute)" : "Creating…") : useAi ? "Draft with AI" : "Create draft from template"}</button>
    </form>
  );
}
