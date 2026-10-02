/**
 * Policy catalogue. Each policy lists the sections a draft must cover and the controls
 * an approved version is filed against as evidence.
 */
export type PolicyDef = {
  id: string;
  name: string;
  purpose: string;
  sections: string[];
  controls: string[];
};

export const POLICIES: PolicyDef[] = [
  {
    id: "infosec",
    name: "Information Security Policy",
    purpose: "Top-level policy: management commitment, scope, roles and how security is governed.",
    sections: ["Purpose and scope", "Management commitment", "Roles and responsibilities", "Policy framework", "Risk management", "Compliance and exceptions", "Review"],
    controls: ["CTM-01", "CTM-02", "CTM-03"],
  },
  {
    id: "acceptable-use",
    name: "Acceptable Use Policy",
    purpose: "What staff may and may not do with company devices, accounts, email and internet.",
    sections: ["Purpose and scope", "General use", "Email and messaging", "Internet and cloud services", "Passwords and accounts", "Reporting incidents", "Breaches of this policy", "Review"],
    controls: ["CE-1.1", "CTM-07"],
  },
  {
    id: "access-control",
    name: "Access Control Policy",
    purpose: "How access is requested, approved, reviewed and removed, including MFA and admin rights.",
    sections: ["Purpose and scope", "Principles (least privilege, need to know)", "Joiners, movers and leavers", "Authentication and MFA", "Privileged accounts", "Access reviews", "Review"],
    controls: ["CE-2.2", "CE-2.3", "CTM-15"],
  },
  {
    id: "backup",
    name: "Backup and Recovery Policy",
    purpose: "What is backed up, how often, where copies are kept and how restores are tested.",
    sections: ["Purpose and scope", "Systems and data in scope", "Backup frequency and retention", "Protection of backups", "Restore testing", "Roles and responsibilities", "Review"],
    controls: ["CE-4.1", "CTM-10"],
  },
  {
    id: "patch",
    name: "Patch and Vulnerability Management Policy",
    purpose: "How software is kept up to date and how vulnerabilities are found and fixed on time.",
    sections: ["Purpose and scope", "Asset coverage", "Patching timelines by severity", "Vulnerability scanning", "Exceptions and compensating controls", "Unsupported software", "Review"],
    controls: ["CE-3.1", "CTM-18"],
  },
  {
    id: "incident-response",
    name: "Incident Response Policy",
    purpose: "How incidents are reported, contained, recovered from and notified, including PDPA breach notification.",
    sections: ["Purpose and scope", "What counts as an incident", "Reporting", "Response team and contacts", "Response phases", "Notification (customers, PDPC, others)", "Lessons learned", "Review"],
    controls: ["CE-5.1", "CTM-21"],
  },
  {
    id: "data-protection",
    name: "Data Protection Policy",
    purpose: "How personal and sensitive data is classified, handled and protected in line with the PDPA.",
    sections: ["Purpose and scope", "Data classification", "Collection, use and disclosure", "Storage and encryption", "Retention and disposal", "Data protection officer", "Review"],
    controls: ["CE-1.3", "CTM-09"],
  },
  {
    id: "supplier",
    name: "Supplier Security Policy",
    purpose: "How suppliers with access to systems or data are assessed, contracted and reviewed.",
    sections: ["Purpose and scope", "Supplier risk tiers", "Due diligence", "Contract requirements", "Ongoing review", "Offboarding suppliers", "Review"],
    controls: ["CTM-17"],
  },
  {
    id: "byod",
    name: "Bring Your Own Device Policy",
    purpose: "Minimum security rules for personal phones and laptops used for work.",
    sections: ["Purpose and scope", "Eligible devices", "Minimum security requirements", "Company data on personal devices", "Lost or stolen devices", "Leaving the company", "Review"],
    controls: ["CTM-11"],
  },
];

export const policyById = (id: string) => POLICIES.find((p) => p.id === id);
