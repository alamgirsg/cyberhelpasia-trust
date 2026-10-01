"use client";

import Link from "next/link";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
      <h1 className="text-lg font-semibold">That action could not be completed</h1>
      <p className="mt-2 text-sm text-ink-2">
        You may not have permission for it (for example, a workspace must always keep at least one owner), or the item no longer
        exists.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <button className="btn-ghost" onClick={() => reset()}>Try again</button>
        <Link href="/app" className="btn-primary">Back to dashboard</Link>
      </div>
    </div>
  );
}
