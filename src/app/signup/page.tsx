"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <AuthShell promise="Start measuring your readiness today. The first pass takes under an hour.">
      <h1 className="text-3xl font-bold tracking-tight">Create your workspace</h1>
      <p className="mt-2 text-sm text-muted">Free during the pilot. No card needed.</p>
      <form action={action} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="company">Company name</label>
          <input className="input" id="company" name="company" defaultValue={state?.values?.company} required />
        </div>
        <div>
          <label className="label" htmlFor="uen">UEN <span className="font-normal text-muted">(optional)</span></label>
          <input className="input" id="uen" name="uen" defaultValue={state?.values?.uen} />
        </div>
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input className="input" id="name" name="name" defaultValue={state?.values?.name} autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input className="input" id="email" name="email" defaultValue={state?.values?.email} type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" minLength={12} autoComplete="new-password" required />
          <p className="mt-1 text-xs text-muted">At least 12 characters.</p>
        </div>
        {state?.error && <p className="text-sm font-medium text-bad" role="alert">{state.error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</button>
      </form>
      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand-2 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
