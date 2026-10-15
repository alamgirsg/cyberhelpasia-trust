"use client";

import { useActionState } from "react";
import { configureTarget, verifyTarget, runAutomated, type RunState } from "@/app/actions/engagements";

type Target = { url: string | null; reqField: string; resPath: string | null; authHeader: string | null; hasAuthValue: boolean };
type Verification = { token: string | null; url: string | null; verifiedAt: string | null };
type RunRow = { owaspId: string; name: string; status: string; detail: string; severity: string };
type LatestRun = { status: string; summary: string | null; startedAt: string; results: RunRow[] | null } | null;

function Note({ state }: { state: RunState }) {
  if (!state) return null;
  if (state.error) return <p className="mt-2 text-sm font-medium text-bad" role="alert">{state.error}</p>;
  if (state.detail) return <p className="mt-2 text-sm font-medium text-accent" role="status">{state.detail}</p>;
  return null;
}

const STATUS_MARK: Record<string, { mark: string; cls: string }> = {
  pass: { mark: "✓", cls: "text-accent" },
  fail: { mark: "✗", cls: "text-bad" },
  error: { mark: "!", cls: "text-warn" },
};

export function AutomatedPanel({
  engagementId,
  canManage,
  done,
  target,
  verification,
  latestRun,
}: {
  engagementId: string;
  canManage: boolean;
  done: boolean;
  target: Target;
  verification: Verification;
  latestRun: LatestRun;
}) {
  const [cfgState, cfgAction, cfgPending] = useActionState(configureTarget, undefined);
  const [verState, verAction, verPending] = useActionState(verifyTarget, undefined);
  const [runState, runAction, runPending] = useActionState(runAutomated, undefined);

  const verified = !!verification.verifiedAt;
  const hasTarget = !!target.url;

  return (
    <div className="card mb-6 overflow-hidden">
      <div className="border-b border-line bg-paper/60 p-4">
        <h2 className="font-semibold">Automated probes <span className="ml-1 rounded bg-brand-2/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-2">authorised only</span></h2>
        <p className="mt-1 text-sm text-muted">
          Runs benign OWASP-LLM robustness checks against one endpoint you control. You must prove ownership of the
          host first, and the runner only ever calls that one verified URL.
        </p>
      </div>

      {!canManage ? (
        <div className="p-6 text-sm text-muted">Only an owner or admin can configure and run automated testing.</div>
      ) : (
        <div className="divide-y divide-line">
          {/* 1. Target */}
          <form action={cfgAction} className="space-y-3 p-6">
            <input type="hidden" name="engagementId" value={engagementId} />
            <p className="text-sm font-semibold">1. Endpoint to test</p>
            <div>
              <label className="label" htmlFor="targetUrl">Endpoint URL (https)</label>
              <input className="input" id="targetUrl" name="targetUrl" defaultValue={target.url ?? ""} placeholder="https://api.yourcompany.com/assistant" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="reqField">Request field <span className="font-normal text-muted">(prompt goes here)</span></label>
                <input className="input" id="reqField" name="reqField" defaultValue={target.reqField} placeholder="input" />
              </div>
              <div>
                <label className="label" htmlFor="resPath">Response path <span className="font-normal text-muted">(optional)</span></label>
                <input className="input" id="resPath" name="resPath" defaultValue={target.resPath ?? ""} placeholder="output or choices.0.message.content" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="authHeader">Auth header <span className="font-normal text-muted">(optional)</span></label>
                <input className="input" id="authHeader" name="authHeader" defaultValue={target.authHeader ?? ""} placeholder="Authorization" />
              </div>
              <div>
                <label className="label" htmlFor="authValue">Auth value <span className="font-normal text-muted">(stored encrypted)</span></label>
                <input className="input" id="authValue" name="authValue" type="password" autoComplete="off" placeholder={target.hasAuthValue ? "•••• (leave blank to keep)" : "Bearer …"} />
              </div>
            </div>
            <p className="text-xs text-muted">The runner sends <code className="ref">{"{ "}{target.reqField || "input"}: &lt;probe&gt;{" }"}</code> as JSON and reads the reply from the response path.</p>
            <button className="btn-ghost" disabled={cfgPending}>{cfgPending ? "Saving…" : "Save target"}</button>
            <Note state={cfgState} />
          </form>

          {/* 2. Verify ownership */}
          {hasTarget && (
            <div className="p-6">
              <p className="text-sm font-semibold">2. Prove you control this host</p>
              <p className="mt-1 text-sm text-ink-2">Serve this exact text (the token below) at:</p>
              <p className="ref mt-1 break-all text-xs text-brand-2">{verification.url}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-paper p-3 font-mono text-xs" data-testid="verify-token">{verification.token}</pre>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <form action={verAction}>
                  <input type="hidden" name="id" value={engagementId} />
                  <button className="btn-ghost" disabled={verPending}>{verPending ? "Checking…" : verified ? "Re-verify" : "Verify ownership"}</button>
                </form>
                {verified && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Verified
                    {verification.verifiedAt && <span className="font-normal text-muted">· {new Date(verification.verifiedAt).toLocaleDateString("en-SG")}</span>}
                  </span>
                )}
              </div>
              <Note state={verState} />
            </div>
          )}

          {/* 3. Run */}
          {hasTarget && (
            <div className="p-6">
              <p className="text-sm font-semibold">3. Run the probe suite</p>
              <p className="mt-1 text-sm text-muted">
                {done
                  ? "This engagement is completed — reopen it to run again."
                  : verified
                    ? "Ownership is re-checked at run time. Each failed probe is added as a finding below."
                    : "Verify ownership above to enable the run."}
              </p>
              <form action={runAction} className="mt-3">
                <input type="hidden" name="id" value={engagementId} />
                <button className="btn-primary" disabled={runPending || !verified || done}>{runPending ? "Running…" : "Run automated probes"}</button>
              </form>
              <Note state={runState} />
            </div>
          )}

          {/* Latest run results */}
          {latestRun && (
            <div className="p-6">
              <p className="text-sm font-semibold">Last run</p>
              <p className="mt-1 text-sm text-muted">
                {new Date(latestRun.startedAt).toLocaleString("en-SG")} · {latestRun.summary ?? latestRun.status}
              </p>
              {latestRun.results && latestRun.results.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {latestRun.results.map((r, i) => {
                    const m = STATUS_MARK[r.status] ?? STATUS_MARK.error;
                    return (
                      <li key={i} className="flex gap-2">
                        <span className={`font-bold ${m.cls}`} aria-hidden>{m.mark}</span>
                        <span className="ref text-xs text-muted">{r.owaspId}</span>
                        <span className="font-medium">{r.name}</span>
                        {r.status !== "pass" && <span className="text-ink-2">— {r.detail}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
