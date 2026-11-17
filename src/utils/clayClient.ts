import { UserProfile } from "../types";
import { XelimeOpportunity, XelimeWorkspaceState } from "../types/xelime";
import { defaultXelimeState } from "../data/xelimeDefaults";
import { authFetch } from "../firebase/client";
import { getUserStoreValue, setUserStoreValue } from "./userStore";

export type IngestedLeadStatus =
  | "New"
  | "Reviewing"
  | "Ready to Apply"
  | "Applied"
  | "Archived";

export type IngestedCompanyStatus =
  | "Prospect"
  | "Openings Found"
  | "Pitched"
  | "Applied"
  | "Archived";

export interface ClayEnrichedContact {
  name: string;
  title: string;
  email: string;
  linkedinUrl: string;
  phone: string;
}

export interface IngestedJobLead {
  id: string;
  company: string;
  title: string;
  applyUrl: string;
  location: string;
  workArrangement: "Remote" | "Hybrid" | "On-site" | "Unspecified";
  salary: string;
  matchScore: number;
  rawScore?: number;
  missingSkills: string[];
  matchedSkills: string[];
  description: string;
  summary: string;
  contact: ClayEnrichedContact;
  source: string;
  clayTableId?: string;
  clayRowId?: string;
  notes?: string;
  status: IngestedLeadStatus;
  ingestedAt: string;
  updatedAt: string;
}

export interface IngestedCompanyRecord {
  id: string;
  name: string;
  domain: string;
  websiteUrl: string;
  industry: string;
  size: string;
  location: string;
  jobOpeningsSummary: string;
  careersUrl: string;
  openingsCount: number;
  news: string;
  competitors: string[];
  funding: string;
  fitScore?: number;
  missingSkills: string[];
  matchedSkills: string[];
  contact: ClayEnrichedContact;
  source: string;
  clayTableId?: string;
  clayRowId?: string;
  notes?: string;
  status: IngestedCompanyStatus;
  ingestedAt: string;
  updatedAt: string;
}

export interface ClayPipelineEvent {
  id: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  status: "success" | "filtered" | "error";
  summary: string;
  company?: string;
  jobTitle?: string;
  score?: number;
}

export interface ClayStatusResponse {
  webhookConfigured: boolean;
  apiKeyConfigured: boolean;
  ingestSecretConfigured: boolean;
  config: {
    minMatchScore: number;
    requireIngestSecretWhenSet: boolean;
  };
  counts: {
    totalLeads: number;
    newLeads: number;
    readyToApply: number;
    applied: number;
    totalCompanies: number;
    companiesWithOpenings: number;
    eventsCount: number;
  };
  leads: IngestedJobLead[];
  companies: IngestedCompanyRecord[];
  events: ClayPipelineEvent[];
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Clay pipeline request failed (${res.status})`);
  }
  return data as T;
}

export function getClayStatus(): Promise<ClayStatusResponse> {
  return apiJson("/api/clay/status");
}

export function updateClayConfig(patch: {
  minMatchScore?: number;
  requireIngestSecretWhenSet?: boolean;
}) {
  return apiJson<{ config: ClayStatusResponse["config"] }>("/api/clay/config", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function updateIngestedLead(
  id: string,
  patch: { status?: IngestedLeadStatus; notes?: string }
): Promise<{ lead: IngestedJobLead }> {
  return apiJson(`/api/jobs/ingested/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteIngestedLead(id: string): Promise<{ deleted: boolean }> {
  return apiJson(`/api/jobs/ingested/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function updateIngestedCompany(
  id: string,
  patch: { status?: IngestedCompanyStatus; notes?: string }
): Promise<{ company: IngestedCompanyRecord }> {
  return apiJson(`/api/clay/companies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteIngestedCompany(id: string): Promise<{ deleted: boolean }> {
  return apiJson(`/api/clay/companies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function pushJobsToClay(jobs: Record<string, any>[]): Promise<{
  pushed: number;
  failed: number;
  errors: string[];
}> {
  return apiJson("/api/clay/push-to-clay", {
    method: "POST",
    body: JSON.stringify({ jobs }),
  });
}

export function sendTestIngestLead(payload?: Record<string, any>): Promise<{
  ingested: boolean;
  filtered?: boolean;
  deduplicated?: boolean;
  reason?: string;
  lead?: IngestedJobLead;
}> {
  return apiJson("/api/clay/test-ingest", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export function sendTestCompanyIngest(payload?: Record<string, any>): Promise<{
  ingested: boolean;
  filtered?: boolean;
  deduplicated?: boolean;
  reason?: string;
  company?: IngestedCompanyRecord;
  leadsCreated?: number;
}> {
  return apiJson("/api/clay/test-company-ingest", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

const XELIME_STORAGE_KEY = "xelime_xcms_state_v1";

export function addIngestedLeadToXelime(lead: IngestedJobLead): {
  added: boolean;
  message: string;
} {
  let state: XelimeWorkspaceState = defaultXelimeState;
  try {
    const raw = getUserStoreValue(XELIME_STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as XelimeWorkspaceState;
  } catch {
    state = defaultXelimeState;
  }

  const exists = state.opportunities.some(
    (o) =>
      o.company.toLowerCase() === lead.company.toLowerCase() &&
      o.jobTitle.toLowerCase() === lead.title.toLowerCase()
  );

  if (exists) {
    return {
      added: false,
      message: `${lead.title} @ ${lead.company} is already tracked in XELIME System.`,
    };
  }

  const salaryDigits = Number(String(lead.salary || "").replace(/[^\d]/g, ""));
  const normalizedSalary =
    salaryDigits > 10000 && salaryDigits < 500000 ? salaryDigits : 70000;
  const score10 = Math.min(10, Math.max(1, lead.matchScore || 8));

  const newOpp: XelimeOpportunity = {
    id: `opp-clay-${Date.now()}`,
    jobTitle: lead.title,
    company: lead.company,
    careerPathId: "cp-cad-bim",
    employmentType: "Full-time",
    workArrangement:
      lead.workArrangement === "Unspecified" ? "Remote" : lead.workArrangement,
    salary: normalizedSalary,
    salaryLabel: lead.salary || undefined,
    location: lead.location || "Remote",
    applicationStatus:
      lead.status === "Applied" ? "Applied" : "Qualified",
    requiredSkills: lead.matchedSkills,
    portfolioMatchIds: [],
    applicationUrl: lead.applyUrl,
    priority: score10 >= 9 ? "High" : "Medium",
    dateApplied: "",
    notes: [
      `Ingested via Clay (${score10}/10).`,
      lead.contact.name
        ? `Contact: ${lead.contact.name}${
            lead.contact.title ? ` (${lead.contact.title})` : ""
          }${lead.contact.email ? ` · ${lead.contact.email}` : ""}`
        : "",
      lead.missingSkills.length > 0
        ? `Gaps flagged: ${lead.missingSkills.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" | "),
    decisionScores: {
      skillAlignment: Math.round(score10 * 10),
      xelimeRelevance: 80,
      incomePotential: 75,
      workFlexibility: lead.workArrangement === "Remote" ? 95 : 70,
      professionalDevelopment: 80,
    },
  };

  const nextState: XelimeWorkspaceState = {
    ...state,
    opportunities: [newOpp, ...state.opportunities],
  };

  setUserStoreValue(XELIME_STORAGE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent("xelime-state-updated"));

  return {
    added: true,
    message: `Added "${lead.title}" at ${lead.company} to XELIME Opportunities.`,
  };
}

export function addIngestedCompanyToXelime(company: IngestedCompanyRecord): {
  added: boolean;
  message: string;
} {
  let state: XelimeWorkspaceState = defaultXelimeState;
  try {
    const raw = getUserStoreValue(XELIME_STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as XelimeWorkspaceState;
  } catch {
    state = defaultXelimeState;
  }

  const targetTitle = company.jobOpeningsSummary
    ? `Design / CAD Role — ${company.name}`
    : `Direct Studio Pitch — ${company.name}`;

  const exists = state.opportunities.some(
    (o) => o.company.toLowerCase() === company.name.toLowerCase()
  );

  if (exists) {
    return {
      added: false,
      message: `${company.name} is already tracked in XELIME System Opportunities.`,
    };
  }

  const score10 = company.fitScore || 8;
  const newOpp: XelimeOpportunity = {
    id: `opp-clay-co-${Date.now()}`,
    jobTitle: targetTitle,
    company: company.name,
    careerPathId: "cp-cad-bim",
    employmentType: "Full-time",
    workArrangement: "Hybrid",
    salary: 70000,
    location: company.location || "Columbus, OH",
    applicationStatus: company.openingsCount > 0 ? "Qualified" : "Researching",
    requiredSkills: company.matchedSkills,
    portfolioMatchIds: [],
    applicationUrl: company.careersUrl || company.websiteUrl,
    priority: score10 >= 9 ? "High" : "Medium",
    dateApplied: "",
    notes: [
      `From Columbus Design Companies (Clay): ${company.industry}${company.size ? ` · ${company.size}` : ""}.`,
      company.jobOpeningsSummary ? `Openings: ${company.jobOpeningsSummary}` : "",
      company.news ? `News: ${company.news}` : "",
    ]
      .filter(Boolean)
      .join(" | "),
    decisionScores: {
      skillAlignment: Math.round(score10 * 10),
      xelimeRelevance: 85,
      incomePotential: 75,
      workFlexibility: 75,
      professionalDevelopment: 85,
    },
  };

  const nextState: XelimeWorkspaceState = {
    ...state,
    opportunities: [newOpp, ...state.opportunities],
  };

  setUserStoreValue(XELIME_STORAGE_KEY, JSON.stringify(nextState));
  window.dispatchEvent(new CustomEvent("xelime-state-updated"));

  return {
    added: true,
    message: `Added ${company.name} to XELIME Opportunities.`,
  };
}

export function buildClaygentPrompt(profile: UserProfile): string {
  return [
    `Evaluate the incoming job posting ({{Title}} at {{Company}}) against the candidate's verified profile below.`,
    ``,
    `CANDIDATE VERIFIED PROFILE (${profile.name}):`,
    `- Verified Skills: ${profile.skills.join(", ")}`,
    `- Verified Software: ${profile.software.join(", ")}`,
    `- Experience: ${profile.experience.map((e) => `${e.role} @ ${e.company} (${e.period})`).join("; ")}`,
    `- Education: ${profile.education.map((ed) => `${ed.degree} - ${ed.school}`).join("; ")}`,
    ``,
    `STRICT RULES:`,
    `- Do NOT assume licenses (e.g., PE, Registered Architect) the candidate does not hold.`,
    `- Score realistically from 1 to 10 based on CAD, Civil 3D, BIM, drafting, visualization, or adjacent creative tech fit.`,
    ``,
    `RETURN JSON WITH EXACT KEYS:`,
    `{`,
    `  "matchScore": <integer 1-10>,`,
    `  "matchedSkills": ["<verified overlapping skills>"],`,
    `  "missingSkills": ["<missing skills or license gaps to flag before applying>"],`,
    `  "hiringManager": "<name if found or empty>",`,
    `  "hiringManagerTitle": "<role if found or empty>",`,
    `  "recruiterEmail": "<enriched email if found or empty>",`,
    `  "recruiterLinkedin": "<LinkedIn URL if found or empty>"`,
    `}`,
  ].join("\n");
}

export function buildCompanyClaygentPrompt(profile: UserProfile): string {
  return [
    `Evaluate the company {{Name}} ({{Domain}} — Industry: {{Industry}}, Size: {{Size}}) and its Job Openings ({{Job Openings}}) against the candidate's verified profile below.`,
    ``,
    `CANDIDATE VERIFIED PROFILE (${profile.name}):`,
    `- Verified Skills: ${profile.skills.join(", ")}`,
    `- Verified Software: ${profile.software.join(", ")}`,
    `- Location: ${profile.location}`,
    ``,
    `TASKS:`,
    `1. Score company fit (1-10) for CAD drafting, Architectural BIM/Revit, 3D visualization, or creative production opportunities.`,
    `2. Inspect {{Job Openings}} for CAD/BIM/Design openings and flag any skill gaps.`,
    `3. Identify the best Hiring Manager, BIM/CAD Manager, or Recruiter contact if public.`,
    ``,
    `RETURN JSON WITH EXACT KEYS:`,
    `{`,
    `  "fitScore": <integer 1-10>,`,
    `  "matchedSkills": ["<relevant software/skills>"],`,
    `  "missingSkills": ["<missing credentials or tools>"],`,
    `  "hiringManager": "<name or empty>",`,
    `  "hiringManagerTitle": "<role or empty>",`,
    `  "recruiterEmail": "<email or empty>"`,
    `}`,
  ].join("\n");
}

export function buildClayHttpPayloadTemplate(): string {
  return JSON.stringify(
    {
      company: "{{Company}}",
      title: "{{Title}}",
      applyUrl: "{{Apply URL}}",
      location: "{{Location}}",
      salary: "{{Salary}}",
      matchScore: "{{Claygent.matchScore}}",
      matchedSkills: "{{Claygent.matchedSkills}}",
      missingSkills: "{{Claygent.missingSkills}}",
      description: "{{Job Description}}",
      contact: {
        name: "{{Claygent.hiringManager}}",
        title: "{{Claygent.hiringManagerTitle}}",
        email: "{{Claygent.recruiterEmail}}",
        linkedinUrl: "{{Claygent.recruiterLinkedin}}",
      },
      source: "Clay Pipeline",
      clayRowId: "{{Clay Row ID}}",
    },
    null,
    2
  );
}

export function buildColumbusCompaniesPayloadTemplate(): string {
  return JSON.stringify(
    {
      name: "{{Name}}",
      domain: "{{Domain}}",
      industry: "{{Industry}}",
      size: "{{Size}}",
      location: "Columbus, OH",
      jobOpenings: "{{Job Openings}}",
      news: "{{News}}",
      competitors: "{{Competitors}}",
      funding: "{{Funding}}",
      fitScore: "{{Claygent.fitScore}}",
      matchedSkills: "{{Claygent.matchedSkills}}",
      missingSkills: "{{Claygent.missingSkills}}",
      contact: {
        name: "{{Claygent.hiringManager}}",
        title: "{{Claygent.hiringManagerTitle}}",
        email: "{{Claygent.recruiterEmail}}",
      },
      source: "Columbus Design Companies",
    },
    null,
    2
  );
}
