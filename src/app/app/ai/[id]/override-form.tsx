"use client";

import { useActionState } from "react";
import { setOverride } from "@/app/actions/ai";

export function OverrideForm({ id, hasOverride, computed }: { id: string; hasOverride: boolean; computed: string }) {
  const [state, action, pending] = useActionState(setOverride, undefined);
  return (
    <details className="card mb-6 p-0" data-testid="override-panel">
      <summary className="cursor-pointer p-4 text-sm font-semibold">Override the rating (owners and admins)</summary>
      <div className="border-t border-line p-4">
        <form key={JSON.stringify(state?.values ?? null) + (state?.ok ?? "")} action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-wrap gap-2">
            {(["low", "medium", "high"] as const)
              .filter((r) => r !== computed)
              .map((r) => (
                <label key={r} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-brand-2">
                  <input type="radio" name="rating" value={r} required className="accent-brand-2" defaultChecked={state?.values?.rating === r} />
                  {r[0].toUpperCase() + r.slice(1)}
                </label>
              ))}
          </div>
          <textarea name="reason" defaultValue={state?.values?.reason} className="input" rows={3} maxLength={1000} placeholder="Why the computed rating does not fit (at least 20 characters). This is recorded in the activity log." aria-label="Override reason" />
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={pending}>Save override</button>
            {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
            {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
          </div>
        </form>
        {hasOverride && (
          <form action={action} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="clear" value="1" />
            <button className="text-xs font-semibold text-bad hover:underline">Remove override</button>
          </form>
        )}
      </div>
    </details>
  );
}
