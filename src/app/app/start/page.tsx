import { requireCtx } from "@/lib/auth";
import { startAssessment } from "@/app/actions/assessments";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Risk profile" };

const questions: Array<{ name: string; label: string; help?: string; options: [string, string][] }> = [
  { name: "staff", label: "How many people work in your organisation?", options: [["1-10", "1–10"], ["11-50", "11–50"], ["51-200", "51–200"], ["200+", "More than 200"]] },
  { name: "licensedProvider", label: "Do you hold a CSA licence for penetration testing or managed SOC services?", options: [["no", "No"], ["yes", "Yes"]] },
  { name: "sellsToGovOrCii", label: "Do you sell to government agencies, critical infrastructure or large enterprises?", options: [["no", "No"], ["yes", "Yes"]] },
  { name: "sensitiveData", label: "Do you handle sensitive or large volumes of personal data?", help: "For example health, financial or NRIC data.", options: [["no", "No"], ["yes", "Yes"]] },
  { name: "digitalDependence", label: "How much does your business depend on digital systems?", options: [["low", "Low"], ["medium", "Medium"], ["high", "High — we stop if IT stops"]] },
];

export default async function StartPage() {
  await requireCtx();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Your risk profile" sub="We use your answers to recommend the right mark. You can override it." />
      <form action={startAssessment} className="card space-y-6 p-6">
        {questions.map((q) => (
          <fieldset key={q.name}>
            <legend className="font-medium">{q.label}</legend>
            {q.help && <p className="text-xs text-muted">{q.help}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map(([v, l], i) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-brand-2 has-[:checked]:bg-brand-2/5">
                  <input type="radio" name={q.name} value={v} defaultChecked={i === 0} className="accent-brand-2" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend className="font-medium">Target mark</legend>
          <select name="override" className="input mt-2 max-w-xs" defaultValue="auto">
            <option value="auto">Recommend for me</option>
            <option value="CE">Cyber Essentials</option>
            <option value="CTM">Cyber Trust</option>
          </select>
        </fieldset>
        <button className="btn-primary">Create assessment</button>
      </form>
    </div>
  );
}
