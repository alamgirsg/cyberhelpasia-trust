/**
 * Control library — CyberHELP Asia Trust Platform.
 *
 * IMPORTANT (content licensing & accuracy):
 * - All titles and guidance below are CyberHELP's own paraphrased wording. They are NOT the
 *   text of CSA's Cyber Essentials / Cyber Trust standards (SS 712:2025 is a paid standard).
 * - The domain structure follows the publicly described categories of the CSA marks
 *   (Cyber Essentials 2022 categories; Cyber Trust 2022 domains). Before customer use, verify
 *   against the current CSA documents and the official Cyber Trust (2025) ⇄ ISO/IEC 27001:2022
 *   mapping, and add tier applicability per control.
 * - ISO/IEC 27001:2022 references are indicative only.
 */

export type ControlSeed = {
  id: string;
  domain: string;
  ref: string;
  title: string;
  guidance: string;
  evidenceHint: string;
  isoRefs?: string;
};

export type FrameworkSeed = {
  id: string;
  name: string;
  version: string;
  description: string;
  /** Label shown for each control's isoRefs field. */
  refLabel?: string;
  controls: ControlSeed[];
};

const ce: FrameworkSeed = {
  id: "CE",
  name: "Cyber Essentials readiness",
  version: "draft-0.1",
  description:
    "Baseline cyber hygiene for SMEs, organised around the five Cyber Essentials categories: Assets, Secure/Protect, Update, Backup and Respond.",
  controls: [
    {
      id: "CE-1.1", domain: "Assets: People", ref: "1.1",
      title: "Staff know how to spot and report cyber threats",
      guidance: "Run short security awareness sessions at onboarding and at least yearly. Cover phishing, passwords, safe browsing and how to report an incident.",
      evidenceHint: "Training attendance list, slides or LMS completion export.",
      isoRefs: "A.6.3",
    },
    {
      id: "CE-1.2", domain: "Assets: Hardware & software", ref: "1.2",
      title: "Inventory of hardware and software is kept up to date",
      guidance: "List every laptop, server, mobile device, network device and cloud/software service, with an owner. Remove or isolate anything unsupported.",
      evidenceHint: "Asset register (spreadsheet or tool export) with owner and last-review date.",
      isoRefs: "A.5.9",
    },
    {
      id: "CE-1.3", domain: "Assets: Data", ref: "1.3",
      title: "Business-critical and personal data is identified",
      guidance: "Identify where important and personal data is stored and who can access it. Apply PDPA obligations to personal data.",
      evidenceHint: "Data inventory or data map; PDPA notice.",
      isoRefs: "A.5.12, A.5.34",
    },
    {
      id: "CE-2.1", domain: "Secure/Protect: Malware", ref: "2.1",
      title: "Anti-malware is installed and updated on endpoints",
      guidance: "Enable anti-malware on all endpoints and servers with automatic signature updates and real-time scanning.",
      evidenceHint: "Console screenshot showing coverage and update status.",
      isoRefs: "A.8.7",
    },
    {
      id: "CE-2.2", domain: "Secure/Protect: Access control", ref: "2.2",
      title: "Accounts are unique, least-privilege and removed promptly",
      guidance: "Give each person their own account, limit admin rights to those who need them, and disable accounts when people leave.",
      evidenceHint: "User access review record; leaver checklist.",
      isoRefs: "A.5.15, A.5.18, A.8.2",
    },
    {
      id: "CE-2.3", domain: "Secure/Protect: Access control", ref: "2.3",
      title: "Strong authentication protects important accounts",
      guidance: "Enforce strong passwords or passphrases and turn on MFA for email, admin and remote-access accounts.",
      evidenceHint: "Identity provider MFA policy screenshot.",
      isoRefs: "A.5.17, A.8.5",
    },
    {
      id: "CE-2.4", domain: "Secure/Protect: Secure configuration", ref: "2.4",
      title: "Devices and services use secure settings",
      guidance: "Change default passwords, disable unused services and ports, enable firewalls and screen locks, and use a hardened baseline.",
      evidenceHint: "Baseline configuration document; firewall settings screenshot.",
      isoRefs: "A.8.9",
    },
    {
      id: "CE-3.1", domain: "Update", ref: "3.1",
      title: "Software and firmware are patched on time",
      guidance: "Turn on automatic updates where possible and apply critical security patches quickly. Replace software that no longer receives updates.",
      evidenceHint: "Patch status report; update policy.",
      isoRefs: "A.8.8",
    },
    {
      id: "CE-4.1", domain: "Backup", ref: "4.1",
      title: "Essential data is backed up and restores are tested",
      guidance: "Back up essential data regularly, keep at least one copy offline or immutable, and test restoring it.",
      evidenceHint: "Backup schedule; log of a successful test restore.",
      isoRefs: "A.8.13",
    },
    {
      id: "CE-5.1", domain: "Respond", ref: "5.1",
      title: "An incident response plan exists and people know it",
      guidance: "Write a short plan: who to call, how to contain, how to recover and when to notify customers or authorities (including PDPA breach notification).",
      evidenceHint: "Incident response plan; contact list; tabletop exercise notes.",
      isoRefs: "A.5.24, A.5.26",
    },
  ],
};

const ctmDomains: Array<[string, string, string, string, string]> = [
  // [domain, title, guidance, evidenceHint, isoRefs]
  ["Governance", "Leadership owns cybersecurity", "Assign a named person accountable for cybersecurity and report risk to management at a set frequency.", "Appointment letter; management meeting minutes.", "A.5.2, A.5.4"],
  ["Policies & procedures", "Security policies are approved and reviewed", "Maintain a policy set covering acceptable use, access, data, incidents and suppliers. Review it at least yearly.", "Approved policy documents with version and review dates.", "A.5.1"],
  ["Risk management", "Cyber risks are assessed and treated", "Keep a risk register, rate likelihood and impact, and track treatment decisions and owners.", "Risk register; risk treatment plan.", "Clause 6.1, 8.2"],
  ["Cyber strategy", "Security plan aligns with business goals", "Set a multi-year improvement plan with priorities, budget and milestones.", "Cyber strategy or roadmap document.", "Clause 6.2"],
  ["Compliance", "Legal and contractual duties are tracked", "Identify obligations such as PDPA, sector rules and customer contracts, and check compliance regularly.", "Compliance register; review records.", "A.5.31, A.5.36"],
  ["Audit", "Security controls are independently reviewed", "Plan internal or external audits of key controls and follow up findings to closure.", "Audit plan; audit report; finding tracker.", "Clause 9.2, A.5.35"],
  ["Training & awareness", "Role-based security training is delivered", "Give all staff awareness training and give admins and developers role-specific training.", "Training records and materials.", "A.6.3"],
  ["Asset management", "Assets are inventoried with owners", "Keep a complete inventory of hardware, software, cloud services and data with owners and classification.", "Asset register.", "A.5.9, A.5.12"],
  ["Data protection & privacy", "Personal and sensitive data is protected", "Classify data, restrict access, encrypt where needed and meet PDPA obligations.", "Data classification scheme; DPO appointment; encryption settings.", "A.5.34, A.8.24"],
  ["Backups", "Backups are protected and restorable", "Back up critical systems on a schedule, protect copies from ransomware and test restores.", "Backup policy; restore test log.", "A.8.13"],
  ["Bring your own device", "Personal devices meet minimum security", "Define BYOD rules (screen lock, encryption, updates) and enforce them with device management where possible.", "BYOD policy; MDM enrolment report.", "A.8.1, A.6.7"],
  ["System security", "Systems are hardened and monitored", "Apply secure baselines, remove unneeded services and keep security logs.", "Hardening baseline; log settings.", "A.8.9, A.8.15"],
  ["Anti-virus / anti-malware", "Malware protection covers all endpoints", "Deploy managed anti-malware or EDR with central visibility of coverage and alerts.", "EDR console coverage report.", "A.8.7"],
  ["Secure software development lifecycle", "Software is built and bought securely", "Include security requirements, code review and testing in development, and check security of acquired software.", "SDLC procedure; code review or SAST evidence.", "A.8.25, A.8.28, A.8.29"],
  ["Access control", "Access is least-privilege and reviewed", "Approve access requests, use MFA for privileged and remote access, and review access periodically.", "Access review records; MFA policy.", "A.5.15, A.5.18, A.8.2, A.8.5"],
  ["Cyber threat management", "Threats are monitored and acted on", "Collect and review security events and threat intelligence relevant to the business.", "Monitoring procedure; alert review records.", "A.5.7, A.8.16"],
  ["Third-party risk & oversight", "Suppliers are assessed and managed", "Assess suppliers with access to systems or data, include security terms in contracts and review them.", "Supplier register; due diligence questionnaires; contract clauses.", "A.5.19, A.5.20, A.5.22"],
  ["Vulnerability assessment", "Vulnerabilities are found and fixed", "Scan systems regularly, test key applications, and fix findings within defined timelines.", "Scan reports; remediation tracker; pentest report.", "A.8.8"],
  ["Physical & environmental security", "Premises and equipment are protected", "Control physical access to offices and server rooms and protect equipment from damage.", "Access control records; site photos or checklist.", "A.7.1, A.7.2"],
  ["Network security", "Networks are segmented and protected", "Use firewalls, segment sensitive systems, secure Wi-Fi and protect remote access.", "Network diagram; firewall rule review.", "A.8.20, A.8.22"],
  ["Incident response", "Incidents are handled through a tested process", "Maintain an incident response plan with roles, playbooks and notification steps, and exercise it.", "IR plan; exercise report; incident log.", "A.5.24, A.5.25, A.5.26"],
  ["Business continuity / disaster recovery", "Critical services can be recovered", "Identify critical services, set recovery objectives, and test continuity and recovery plans.", "BCP/DR plan; test results.", "A.5.29, A.5.30"],
];

const ctm: FrameworkSeed = {
  id: "CTM",
  name: "Cyber Trust readiness",
  version: "draft-0.1",
  description:
    "Risk-based readiness for the Cyber Trust mark across 22 domains. Tier applicability per control must be added after verification against SS 712:2025.",
  controls: ctmDomains.map(([domain, title, guidance, evidenceHint, isoRefs], i) => ({
    id: `CTM-${String(i + 1).padStart(2, "0")}`,
    domain,
    ref: String(i + 1),
    title,
    guidance,
    evidenceHint,
    isoRefs,
  })),
};

import { aiGov } from "./ai-governance";

export const FRAMEWORKS: FrameworkSeed[] = [ce, ctm, aiGov];
