import Link from "next/link";
import { findReset } from "@/lib/password-reset";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await findReset(token);

  return (
    <AuthShell promise="Choose a strong new password and you're back in.">
      <h1 className="text-3xl font-bold tracking-tight">Set a new password</h1>
      {reset ? (
        <ResetForm token={token} />
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          This reset link is invalid or has expired. <Link href="/forgot" className="font-semibold text-brand-2 hover:underline">Request a new one.</Link>
        </p>
      )}
    </AuthShell>
  );
}
