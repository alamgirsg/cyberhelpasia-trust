"use client";

import { useActionState } from "react";
import { uploadEvidence } from "@/app/actions/evidence";

type Opt = { id: string; name?: string; title?: string };

export function UploadForm({
  assessments,
  controls,
  defaultAssessment,
  defaultControl,
}: {
  assessments: Opt[];
  controls: Opt[];
  defaultAssessment: string;
  defaultControl: string;
}) {
  const [state, action, pending] = useActionState(uploadEvidence, undefined);
  return (
    <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="assessmentId">Assessment</label>
        <select id="assessmentId" name="assessmentId" defaultValue={defaultAssessment} className="input">
          <option value="">— None —</option>
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="controlId">Control</label>
        <select id="controlId" name="controlId" defaultValue={defaultControl} className="input">
          <option value="">— General —</option>
          {controls.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="file">File (max 10 MB)</label>
        <input id="file" name="file" type="file" required className="input" accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.docx,.xlsx" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <input id="description" name="description" className="input" placeholder="e.g. Backup restore test, Sept 2026" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Uploading…" : "Upload evidence"}</button>
        {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
        {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
      </div>
    </form>
  );
}
