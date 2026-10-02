"use client";

import { useActionState, useState } from "react";
import { approvePolicy, saveDraft } from "@/app/actions/policies";
import { Markdown } from "@/components/markdown";

export function DraftEditor({
  policyId,
  content,
  canApprove,
  approverName,
  tenantName,
  controls,
}: {
  policyId: string;
  content: string;
  canApprove: boolean;
  approverName: string;
  tenantName: string;
  controls: string[];
}) {
  const [state, action, pending] = useActionState(saveDraft, undefined);
  const [text, setText] = useState(content);
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState(false);
  const placeholders = (text.match(/\[[^\]\n]{2,80}\]/g) ?? []).length;

  return (
    <form action={action}>
      <input type="hidden" name="policyId" value={policyId} />
      <div className="card p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <div className="flex gap-1">
            <button type="button" onClick={() => setPreview(false)} className={`rounded px-2 py-1 ${!preview ? "bg-paper font-semibold text-ink" : ""}`}>Edit</button>
            <button type="button" onClick={() => setPreview(true)} className={`rounded px-2 py-1 ${preview ? "bg-paper font-semibold text-ink" : ""}`}>Preview</button>
          </div>
          <span data-testid="placeholder-count" className={placeholders ? "font-semibold text-warn" : "text-accent"}>
            {placeholders ? `${placeholders} placeholder${placeholders > 1 ? "s" : ""} in [brackets] left to complete` : "No placeholders left"}
          </span>
        </div>
        {/* The textarea stays in the form (hidden in preview) so Save and Approve always submit the current text. */}
        <textarea
          name="content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={28}
          className={`input font-mono text-xs leading-relaxed ${preview ? "hidden" : ""}`}
          aria-label="Policy text"
          maxLength={60000}
        />
        {preview && <div className="rounded-lg border border-line p-5" data-testid="policy-preview"><Markdown source={text} /></div>}
        <p className="mt-2 text-xs text-muted">Markdown: # title, ## section, - bullet, **bold**</p>
        <div className="mt-3 flex items-center gap-3">
          <button className="btn-ghost" disabled={pending}>{pending ? "Saving…" : "Save draft"}</button>
          {state?.error && <p className="text-sm text-bad" role="alert">{state.error}</p>}
          {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
        </div>
      </div>

      {canApprove ? (
        <div className="card mt-6 space-y-3 p-5" data-testid="approve-form">
          <p className="text-sm font-semibold">Approve this policy</p>
          <p className="text-sm text-ink-2">
            Approving saves the text above, freezes this version, and files it as evidence for {controls.join(", ")} in your assessments.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 accent-brand-2" />
            <span>I have read the whole policy, completed or removed every [placeholder], and confirm it reflects how {tenantName} actually works.</span>
          </label>
          {placeholders > 0 && confirmed && <p className="text-sm text-warn">There are still {placeholders} placeholder(s) in the text.</p>}
          <button formAction={approvePolicy} className="btn-primary" disabled={!confirmed}>Approve as {approverName}</button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">An owner or admin must approve this draft before it counts as evidence.</p>
      )}
    </form>
  );
}
