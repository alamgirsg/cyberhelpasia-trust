"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmMfa, disableMfa } from "@/app/actions/mfa";

export function EnrolPanel({ qr, secret }: { qr: string; secret: string }) {
  const [state, action, pending] = useActionState(confirmMfa, undefined);
  if (state?.codes) {
    return (
      <div className="mt-4 rounded-lg border border-accent/40 bg-accent/5 p-4" data-testid="recovery-codes">
        <p className="font-semibold text-ink">Two-step verification is on.</p>
        <p className="mt-1 text-ink-2">Save these recovery codes somewhere safe. Each works once if you lose your phone. They will not be shown again.</p>
        <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm">
          {state.codes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <Link href="/app/settings/security" className="btn-primary mt-4">I have saved them</Link>
      </div>
    );
  }
  return (
    <div className="mt-3 grid gap-6 sm:grid-cols-[200px_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-lg border border-line" />
      <div className="text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-ink-2">
          <li>Open Google Authenticator, Microsoft Authenticator or 1Password.</li>
          <li>Scan the QR code, or enter this key manually:</li>
        </ol>
        <code className="mt-2 block break-all rounded-lg bg-paper p-2 font-mono text-xs" data-testid="mfa-secret">{secret}</code>
        <form action={action} className="mt-4 space-y-3">
          <label className="label" htmlFor="code">3. Enter the 6-digit code shown in the app</label>
          <div className="flex gap-2">
            <input id="code" name="code" className="input max-w-40 tracking-widest" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" />
            <button className="btn-primary" disabled={pending}>Turn on</button>
          </div>
          {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
        </form>
      </div>
    </div>
  );
}

export function DisableForm() {
  const [state, action, pending] = useActionState(disableMfa, undefined);
  return (
    <form action={action} className="mt-4 space-y-2">
      <label className="label" htmlFor="code">To turn off, enter a current code or a recovery code</label>
      <div className="flex gap-2">
        <input id="code" name="code" className="input max-w-48" required maxLength={20} />
        <button className="btn-ghost" disabled={pending}>Turn off</button>
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      {state?.done && <p className="text-sm text-accent">{state.done}</p>}
    </form>
  );
}
