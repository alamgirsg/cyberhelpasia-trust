"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <AuthShell>
      <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Welcome back. Pick up where you left off.</p>
      <form action={action} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input className="input" id="email" name="email" defaultValue={state?.values?.email} type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state?.error && <p className="text-sm font-medium text-bad" role="alert">{state.error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        <p className="text-center text-sm"><Link href="/forgot" className="font-medium text-brand-2 hover:underline">Forgot your password?</Link></p>
      </form>
      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-semibold text-brand-2 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
  );
}
