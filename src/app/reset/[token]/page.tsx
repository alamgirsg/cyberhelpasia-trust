import Link from "next/link";
import { findReset } from "@/lib/password-reset";
import { Logo } from "@/components/ui";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Set a new password", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await findReset(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold">Set a new password</h1>
        {reset ? (
          <ResetForm token={token} />
        ) : (
          <p className="mt-3 text-sm text-ink-2">
            This reset link is invalid or has expired. <Link href="/forgot" className="font-semibold text-brand-2">Request a new one.</Link>
          </p>
        )}
      </div>
    </main>
  );
}
