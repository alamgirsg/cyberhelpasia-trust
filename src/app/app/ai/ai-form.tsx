"use client";

import { useActionState, useState } from "react";
import { saveAiSystem } from "@/app/actions/ai";
import { FACTORS, RATING_LABEL, rateAiSystem, validFactors } from "@/lib/ai-risk";

type Initial = {
  id?: string;
  name?: string;
  description?: string | null;
  businessOwner?: string | null;
  vendor?: string | null;
  model?: string | null;
  status?: string;
  factors?: Record<string, string>;
};

const RATING_STYLE = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  high: "border-red-200 bg-red-50 text-red-900",
} as const;

export function AiForm({ initial = {} }: { initial?: Initial }) {
  const [state, action, pending] = useActionState(saveAiSystem, undefined);
  const v = state?.values ?? {};
  const [factors, setFactors] = useState<Record<string, string>>(
    Object.fromEntries(FACTORS.map((f) => [f.key, v[f.key] ?? initial.factors?.[f.key] ?? ""])),
  );
  const preview = validFactors(factors) ? rateAiSystem(factors) : null;
  const val = (k: keyof Initial) => (v[k] as string | undefined) ?? ((initial[k] as string | null | undefined) ?? "");

  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <div className="card grid gap-4 p-6 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" className="input" required maxLength={120} defaultValue={val("name")} placeholder="e.g. Website support chatbot" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">What it does</label>
          <textarea id="description" name="description" className="input" rows={2} maxLength={1000} defaultValue={val("description")} />
        </div>
        <div>
          <label className="label" htmlFor="businessOwner">Business owner (role)</label>
          <input id="businessOwner" name="businessOwner" className="input" maxLength={120} defaultValue={val("businessOwner")} placeholder="e.g. Head of Customer Service" />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="input" defaultValue={val("status") || "proposed"}>
            <option value="proposed">Proposed</option>
            <option value="pilot">Pilot</option>
            <option value="production">In production</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="vendor">Vendor / provider</label>
          <input id="vendor" name="vendor" className="input" maxLength={120} defaultValue={val("vendor")} placeholder="e.g. Built in-house, Microsoft, Anthropic" />
        </div>
        <div>
          <label className="label" htmlFor="model">Model or product</label>
          <input id="model" name="model" className="input" maxLength={120} defaultValue={val("model")} />
        </div>
      </div>

      <div className="card space-y-5 p-6">
        <h2 className="font-semibold">Risk questions</h2>
        {FACTORS.map((f) => (
          <fieldset key={f.key}>
            <legend className="text-sm font-medium">{f.question}</legend>
            {f.help && <p className="text-xs text-muted">{f.help}</p>}
            <div className="mt-2 grid gap-2">
              {f.options.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-brand-2 has-[:checked]:bg-brand-2/5">
                  <input
                    type="radio"
                    name={f.key}
                    value={o.value}
                    checked={factors[f.key] === o.value}
                    onChange={() => setFactors((p) => ({ ...p, [f.key]: o.value }))}
                    className="mt-0.5 accent-brand-2"
                    required
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className={`rounded-xl border p-4 text-sm ${preview ? RATING_STYLE[preview.rating] : "border-line bg-white text-muted"}`} data-testid="risk-preview" aria-live="polite">
        {preview ? (
          <>
            <p className="font-semibold">Risk rating: {RATING_LABEL[preview.rating]}</p>
            <ul className="mt-1 list-disc pl-5">{preview.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </>
        ) : (
          <p>Answer all the questions to see the risk rating.</p>
        )}
      </div>

      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : initial.id ? "Save changes" : "Add to inventory"}</button>
    </form>
  );
}
