"use client";

import Link from "next/link";
import { useActionState } from "react";
import { verifyMfaLogin } from "@/app/actions/auth";
import { Logo } from "@/components/ui";

export default function MfaPage() {
  const [state, action, pending] = useActionState(verifyMfaLogin, undefined);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold">Two-step verification</h1>
        <p className="mt-1 text-sm text-muted">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
        <form action={action} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="code">Code</label>
            <input className="input text-lg tracking-widest" id="code" name="code" inputMode="text" autoComplete="one-time-code" autoFocus required maxLength={20} />
          </div>
          {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending ? "Checking…" : "Verify"}</button>
        </form>
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand-2">Back to sign in</Link>
      </p>
    </main>
  );
}
