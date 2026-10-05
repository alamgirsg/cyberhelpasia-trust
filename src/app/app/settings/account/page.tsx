import { requireCtx } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "../tabs";
import { NameForm, PasswordForm } from "./forms";

export const metadata = { title: "Account settings" };

export default async function AccountPage() {
  const ctx = await requireCtx();
  const canManage = ctx.role === "owner" || ctx.role === "admin";
  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" sub="Your account and workspace" />
      <SettingsTabs active="account" canManage={canManage} />
      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold">Your details</h2>
          <p className="mt-1 text-sm text-muted">Signed in as {ctx.userEmail}.</p>
          <NameForm name={ctx.userName} />
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold">Change password</h2>
          <PasswordForm />
        </div>
      </div>
    </div>
  );
}
