"use client";

import { useActionState } from "react";
import { completeReset } from "@/app/actions/password-reset";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(completeReset, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input className="input" id="password" name="password" type="password" minLength={12} autoComplete="new-password" required />
        <p className="mt-1 text-xs text-muted">At least 12 characters.</p>
      </div>
      {state?.error && <p className="text-sm font-medium text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Saving…" : "Set password"}</button>
    </form>
  );
}
