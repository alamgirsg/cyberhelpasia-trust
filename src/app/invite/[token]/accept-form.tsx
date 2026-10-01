"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions/team";

export function AcceptForm({ token, existing }: { token: string; existing: boolean }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="token" value={token} />
      {existing ? (
        <p className="text-sm text-ink-2">You already have an account. Enter your password to join this workspace.</p>
      ) : (
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" name="name" className="input" required autoComplete="name" defaultValue={state?.values?.name} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="password">{existing ? "Password" : "Choose a password"}</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          required
          minLength={existing ? undefined : 12}
          autoComplete={existing ? "current-password" : "new-password"}
        />
        {!existing && <p className="mt-1 text-xs text-muted">At least 12 characters.</p>}
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Joining…" : "Join workspace"}</button>
    </form>
  );
}
