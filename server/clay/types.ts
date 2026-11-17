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
  matchScore: number; // 1 to 10
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

export interface ClayRuntimeConfig {
  minMatchScore: number;
  requireIngestSecretWhenSet: boolean;
}

export interface ClayRuntimeStore {
  config: ClayRuntimeConfig;
  leads: IngestedJobLead[];
  companies: IngestedCompanyRecord[];
  events: ClayPipelineEvent[];
}
