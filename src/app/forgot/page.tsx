"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset } from "@/app/actions/password-reset";
import { AuthShell } from "@/components/auth-shell";

export default function ForgotPage() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  return (
    <AuthShell promise="Locked out? We'll get you back into your workspace.">
      <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
      {state?.done ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          If an account exists for that email, we&apos;ve sent a reset link. It works once and expires in 1 hour. Check your inbox and spam folder.
        </p>
      ) : (
        <form action={action} className="mt-8 space-y-4">
          <p className="text-sm text-muted">Enter your email and we&apos;ll send a link to set a new password.</p>
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <p className="mt-8 border-t border-line pt-6 text-center text-sm"><Link href="/login" className="font-semibold text-brand-2 hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
