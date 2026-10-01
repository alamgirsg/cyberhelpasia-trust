import { and, eq, isNull, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb, schema } from "@/db";
import { requireCtx } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { otpauthUrl } from "@/lib/totp";
import { startMfa } from "@/app/actions/mfa";
import { PageHeader } from "@/components/ui";
import { DisableForm, EnrolPanel } from "./forms";
import { SettingsTabs } from "../tabs";

export const metadata = { title: "Security settings" };

export default async function SecurityPage() {
  const ctx = await requireCtx();
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, ctx.userId)).limit(1);
  const [rc] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.mfaRecoveryCodes)
    .where(and(eq(schema.mfaRecoveryCodes.userId, u.id), isNull(schema.mfaRecoveryCodes.usedAt)));

  let setup: { qr: string; secret: string } | null = null;
  if (!u.mfaEnabledAt && u.mfaSecretEnc) {
    const secret = decrypt(u.mfaSecretEnc);
    setup = { secret, qr: await QRCode.toDataURL(otpauthUrl(secret, u.email), { margin: 1, width: 200 }) };
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" sub="Your account and workspace" />
      <SettingsTabs active="security" canManage={ctx.role === "owner" || ctx.role === "admin"} />
      <div className="card p-6">
        <h2 className="text-lg font-semibold">Two-step verification</h2>
        {u.mfaEnabledAt ? (
          <>
            <p className="mt-1 text-sm text-ink-2">
              <span className="font-semibold text-accent">On</span> since {u.mfaEnabledAt.toLocaleDateString("en-SG")}. You have{" "}
              {rc?.n ?? 0} unused recovery codes.
            </p>
            <DisableForm />
          </>
        ) : setup ? (
          <EnrolPanel qr={setup.qr} secret={setup.secret} />
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-2">
              Protect your account with a code from your phone in addition to your password. Strongly recommended for owners and admins.
            </p>
            <form action={startMfa} className="mt-4">
              <button className="btn-primary">Set up two-step verification</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
