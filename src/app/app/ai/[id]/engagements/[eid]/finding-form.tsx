"use client";

import { useActionState, useRef } from "react";
import { addFinding, type EngagementState } from "@/app/actions/engagements";
import { SEVERITIES } from "@/db/schema";

export function FindingForm({ engagementId, suggested }: { engagementId: string; suggested: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(async (p: EngagementState, f: FormData) => {
    const r = await addFinding(p, f);
    if (!r?.error) formRef.current?.reset();
    return r;
  }, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="card space-y-3 p-5" data-testid="finding-form" encType="multipart/form-data">
      <h2 className="font-semibold">Add a finding</h2>
      <input type="hidden" name="engagementId" value={engagementId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className="label" htmlFor="f-title">Title</label>
          <input id="f-title" name="title" className="input" required maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="f-sev">Severity</label>
          <select id="f-sev" name="severity" className="input" defaultValue="medium">
            {SEVERITIES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="f-test">Test area <span className="font-normal text-muted">(optional)</span></label>
        <select id="f-test" name="testId" className="input">
          <option value="">— None —</option>
          {suggested.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-detail">What was found</label>
        <textarea id="f-detail" name="detail" className="input" rows={2} maxLength={5000} />
      </div>
      <div>
        <label className="label" htmlFor="f-rem">Remediation</label>
        <textarea id="f-rem" name="remediation" className="input" rows={2} maxLength={5000} />
      </div>
      <div>
        <label className="label" htmlFor="f-file">Evidence <span className="font-normal text-muted">(optional, PDF/PNG/JPG/TXT, 10 MB)</span></label>
        <input id="f-file" name="file" type="file" className="input" accept=".pdf,.png,.jpg,.jpeg,.txt" />
      </div>
      {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add finding"}</button>
    </form>
  );
}
