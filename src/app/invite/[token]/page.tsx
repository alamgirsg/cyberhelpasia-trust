import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { findInvite } from "@/lib/invites";
import { Logo } from "@/components/ui";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Join workspace", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findInvite(token);

  if (!found) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <Link href="/" className="mb-8"><Logo /></Link>
        <div className="card p-6">
          <h1 className="text-xl font-bold">Invitation not valid</h1>
          <p className="mt-2 text-sm text-ink-2">This link has expired, was revoked, or has already been used. Ask your workspace admin for a new one.</p>
        </div>
      </main>
    );
  }

  const db = await getDb();
  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, found.invite.email)).limit(1);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8"><Logo /></Link>
      <div className="card p-6">
        <h1 className="text-xl font-bold">Join {found.tenantName}</h1>
        <p className="mt-1 text-sm text-muted">
          You were invited as <span className="font-semibold">{found.invite.role}</span> ({found.invite.email}).
        </p>
        <AcceptForm token={token} existing={Boolean(existing)} />
      </div>
    </main>
  );
}
