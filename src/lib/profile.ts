export type Profile = {
  staff: "1-10" | "11-50" | "51-200" | "200+";
  licensedProvider: "yes" | "no";
  sellsToGovOrCii: "yes" | "no";
  sensitiveData: "yes" | "no";
  digitalDependence: "low" | "medium" | "high";
};

export type Recommendation = { frameworkId: "CE" | "CTM"; reasons: string[] };

/** Simple, explainable recommendation. CyberHELP consultants can override it. */
export function recommend(p: Profile): Recommendation {
  const reasons: string[] = [];
  if (p.licensedProvider === "yes") {
    reasons.push("Licensed pentest / managed SOC providers must hold Cyber Trust mark Level 3 by 31 Dec 2026.");
    return { frameworkId: "CTM", reasons };
  }
  let ctmSignals = 0;
  if (p.sellsToGovOrCii === "yes") {
    ctmSignals++;
    reasons.push("You sell to government, CII or large enterprises, which increasingly ask for a risk-based mark.");
  }
  if (p.sensitiveData === "yes") {
    ctmSignals++;
    reasons.push("You handle sensitive or large volumes of personal data.");
  }
  if (p.digitalDependence === "high") {
    ctmSignals++;
    reasons.push("Your operations depend heavily on digital systems.");
  }
  if (p.staff === "51-200" || p.staff === "200+") {
    ctmSignals++;
    reasons.push("Your organisation size suits a risk-based programme.");
  }
  if (ctmSignals >= 2) return { frameworkId: "CTM", reasons };
  return {
    frameworkId: "CE",
    reasons: [
      "Cyber Essentials is the right first step: it covers baseline hygiene and is achievable quickly.",
      ...reasons,
      "You can progress to Cyber Trust later; your evidence carries over.",
    ],
  };
}
