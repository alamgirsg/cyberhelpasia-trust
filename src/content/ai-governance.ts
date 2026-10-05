import type { FrameworkSeed } from "./frameworks";

/**
 * AI governance readiness — CyberHELP's own paraphrased controls.
 *
 * Domains follow the four areas used in MAS's proposed Guidelines on AI Risk Management and its
 * AI Risk Management Toolkit (oversight; risk management; lifecycle controls; enablers). The text is
 * NOT quoted from MAS, IMDA or OWASP. MAS's guidelines were still being finalised at the time of
 * writing: verify domain mapping against the final text before customer use.
 * References name OWASP Top 10 for LLM Applications (2025) categories where a control addresses them.
 */
export const aiGov: FrameworkSeed = {
  id: "AIGOV",
  name: "AI governance readiness",
  version: "draft-0.1",
  description:
    "Governance and security of AI systems, including generative AI and agents: oversight, inventory and risk rating, lifecycle controls and staff capability.",
  refLabel: "References (indicative)",
  controls: [
    // Oversight
    { id: "AIG-01", domain: "Oversight", ref: "1", title: "Senior management owns AI risk",
      guidance: "Name an accountable executive for AI, report material AI risks to the board or management, and set the organisation's appetite for AI risk.",
      evidenceHint: "Board or management minutes; terms of reference naming the accountable executive.", isoRefs: "MAS AIRM: oversight" },
    { id: "AIG-02", domain: "Oversight", ref: "2", title: "An approved AI policy covers acceptable use",
      guidance: "Approve a policy on how AI may be built, bought and used, including staff use of public generative AI tools and what data must never be entered.",
      evidenceHint: "Approved AI policy; staff acknowledgement records.", isoRefs: "MAS AIRM: oversight" },
    { id: "AIG-03", domain: "Oversight", ref: "3", title: "Each AI system has a named owner",
      guidance: "Assign a business owner for every AI system, and make clear who approves deployment and who monitors it.",
      evidenceHint: "AI inventory with owners; RACI or approval records.", isoRefs: "MAS AIRM: oversight" },
    // Risk management
    { id: "AIG-04", domain: "AI risk management", ref: "4", title: "A complete AI inventory is maintained",
      guidance: "Keep an up-to-date inventory of AI systems, including vendor tools and agents, with purpose, data used and status.",
      evidenceHint: "Inventory export from this platform (AI Assurance → Export CSV).", isoRefs: "MAS AIRM: AI identification and inventory" },
    { id: "AIG-05", domain: "AI risk management", ref: "5", title: "Each AI system has a risk-materiality rating",
      guidance: "Rate each system on impact, autonomy, data sensitivity and scale; apply stronger controls to higher ratings; re-rate after material change.",
      evidenceHint: "Risk ratings with reasons and any overrides.", isoRefs: "MAS AIRM: risk materiality" },
    { id: "AIG-06", domain: "AI risk management", ref: "6", title: "Third-party AI is assessed before use",
      guidance: "Check AI vendors and model providers for data handling, retention, security and contractual terms before adoption, and review them periodically.",
      evidenceHint: "Vendor due-diligence records; contract clauses on data use.", isoRefs: "OWASP LLM03 Supply chain" },
    // Lifecycle
    { id: "AIG-07", domain: "Lifecycle controls", ref: "7", title: "Data for AI is governed",
      guidance: "Control the data used to train, fine-tune or ground AI: quality, provenance, minimisation of personal data and PDPA purpose limits.",
      evidenceHint: "Data inventory for AI; data protection impact assessment.", isoRefs: "OWASP LLM04 Data and model poisoning; LLM08 Vector and embedding weaknesses" },
    { id: "AIG-08", domain: "Lifecycle controls", ref: "8", title: "AI is tested before release",
      guidance: "Test accuracy and reliability for the intended use, check fairness where people are affected, and record results and sign-off before release.",
      evidenceHint: "Test plan and results; release approval.", isoRefs: "OWASP LLM09 Misinformation" },
    { id: "AIG-09", domain: "Lifecycle controls", ref: "9", title: "LLM applications are security-tested",
      guidance: "Red-team generative AI before release and after significant change: prompt injection, sensitive data leakage, jailbreaks and unsafe output handling.",
      evidenceHint: "Red-team report and fixes.", isoRefs: "OWASP LLM01 Prompt injection; LLM02 Sensitive information disclosure; LLM05 Improper output handling; LLM07 System prompt leakage" },
    { id: "AIG-10", domain: "Lifecycle controls", ref: "10", title: "Agents are limited and supervised",
      guidance: "Give agents least-privilege tools, require human approval for high-impact actions, log every action, and keep a way to stop them quickly.",
      evidenceHint: "Tool permission list; approval workflow; action logs; kill-switch procedure.", isoRefs: "OWASP LLM06 Excessive agency; LLM10 Unbounded consumption" },
    { id: "AIG-11", domain: "Lifecycle controls", ref: "11", title: "People are told when AI affects them",
      guidance: "Tell customers and staff when they are dealing with AI or when AI informs a decision about them, and give a route to a human.",
      evidenceHint: "User notices; customer communication; escalation path.", isoRefs: "MAS FEAT: transparency" },
    { id: "AIG-12", domain: "Lifecycle controls", ref: "12", title: "AI is monitored in production",
      guidance: "Monitor performance, drift, misuse and incidents; keep logs long enough to investigate; review high-risk systems more often.",
      evidenceHint: "Monitoring dashboard; review records; log retention settings.", isoRefs: "MAS AIRM: lifecycle controls" },
    { id: "AIG-13", domain: "Lifecycle controls", ref: "13", title: "Changes to AI are controlled",
      guidance: "Version models, prompts and data; re-test and re-approve after material changes; keep a record of what changed and why.",
      evidenceHint: "Change log; re-test evidence.", isoRefs: "MAS AIRM: lifecycle controls" },
    { id: "AIG-14", domain: "Lifecycle controls", ref: "14", title: "AI incidents have a response plan",
      guidance: "Cover AI failures and misuse in incident response, including how to pause or roll back a system and when to notify customers or regulators.",
      evidenceHint: "Incident response plan with AI scenarios; exercise notes.", isoRefs: "MAS AIRM: lifecycle controls" },
    // Enablers
    { id: "AIG-15", domain: "Enablers", ref: "15", title: "Staff have the skills to use and govern AI",
      guidance: "Train staff on safe AI use, and train developers and reviewers on AI risks and secure AI engineering.",
      evidenceHint: "Training records and materials.", isoRefs: "MAS AIRM: capabilities and capacity" },
  ],
};
