"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset } from "@/app/actions/password-reset";
import { Logo } from "@/components/ui";

export default function ForgotPage() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold">Reset your password</h1>
        {state?.done ? (
          <p className="mt-3 text-sm text-ink-2">
            If an account exists for that email, we&apos;ve sent a reset link. It works once and expires in 1 hour. Check your inbox and spam folder.
          </p>
        ) : (
          <form action={action} className="mt-5 space-y-4">
            <p className="text-sm text-muted">Enter your email and we&apos;ll send a link to set a new password.</p>
            <div>
              <label className="label" htmlFor="email">Work email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
          </form>
        )}
      </div>
      <p className="mt-4 text-center text-sm text-muted"><Link href="/login" className="font-semibold text-brand-2">Back to sign in</Link></p>
    </main>
  );
}
