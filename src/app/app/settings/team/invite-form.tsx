"use client";

import { useActionState, useState } from "react";
import { createInvite } from "@/app/actions/team";

export function InviteForm({ roles }: { roles: readonly string[] }) {
  const [state, action, pending] = useActionState(createInvite, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <div className="card p-5">
      <h2 className="font-semibold">Invite a teammate</h2>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <label className="label" htmlFor="invite-email">Email</label>
          <input id="invite-email" name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="invite-role">Role</label>
          <select id="invite-role" name="role" defaultValue="contributor" className="input">
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={pending}>{pending ? "Creating…" : "Create invite link"}</button>
      </form>
      {state?.error && <p className="mt-2 text-sm text-bad" role="alert">{state.error}</p>}
      {state?.link && (
        <div className="mt-4 rounded-lg bg-paper p-3 text-sm">
          <p className="text-ink-2">Send this link to <span className="font-semibold">{state.email}</span>. It works once and expires in 7 days.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={state.link} className="input font-mono text-xs" data-testid="invite-link" onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigator.clipboard.writeText(state.link!).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
