"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Logo } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold">Sign in</h1>
        <form action={action} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input className="input" id="email" name="email" defaultValue={state?.values?.email} type="email" autoComplete="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
          <p className="text-center text-sm"><Link href="/forgot" className="text-brand-2 hover:underline">Forgot your password?</Link></p>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        New here? <Link href="/signup" className="font-semibold text-brand-2">Create an account</Link>
      </p>
    </main>
  );
}
