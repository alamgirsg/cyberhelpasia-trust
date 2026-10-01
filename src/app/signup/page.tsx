"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { Logo } from "@/components/ui";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted">Free during the pilot. No card needed.</p>
        <form action={action} className="mt-5 space-y-4">
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
          {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-semibold text-brand-2">Sign in</Link>
      </p>
    </main>
  );
}
