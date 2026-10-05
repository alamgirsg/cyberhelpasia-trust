"use client";

import { useActionState } from "react";
import { changeName, changePassword } from "@/app/actions/account";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(changeName, undefined);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1">
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" className="input" defaultValue={name} required maxLength={80} />
      </div>
      <button className="btn-primary" disabled={pending}>Save</button>
      {state?.error && <p className="w-full text-sm text-bad" role="alert">{state.error}</p>}
      {state?.ok && <p className="w-full text-sm text-accent">{state.ok}</p>}
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="mt-4 space-y-3" key={state?.ok}>
      <div>
        <label className="label" htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" className="input max-w-sm" autoComplete="current-password" required />
      </div>
      <div>
        <label className="label" htmlFor="next">New password</label>
        <input id="next" name="next" type="password" className="input max-w-sm" minLength={12} autoComplete="new-password" required />
        <p className="mt-1 text-xs text-muted">At least 12 characters.</p>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>Change password</button>
        {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
        {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
      </div>
    </form>
  );
}
