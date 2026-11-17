export type NotionObjectType = "page" | "database";

export type NotionDomainKey = "profile" | "skills" | "applications" | "portfolio";

export interface KnownNotionDocumentSpec {
  key: string;
  canonicalTitle: string;
  matchTerms: string[];
  preferredDomain?: NotionDomainKey;
  description: string;
}

export const KNOWN_NOTION_DOCUMENTS: KnownNotionDocumentSpec[] = [
  {
    key: "xelimeCareerLaunchSystem",
    canonicalTitle: "Xelime Career Launch System",
    matchTerms: ["xelime career launch system", "xelime career", "career launch system"],
    description: "Master Career Management hub & workspace structure",
  },
  {
    key: "remoteJobApplications",
    canonicalTitle: "Remote Job Applications — Career Launch Tracker",
    matchTerms: [
      "remote job applications",
      "career launch tracker",
      "remote job applications — career launch tracker",
    ],
    preferredDomain: "applications",
    description: "Primary remote job application tracker",
  },
  {
    key: "remoteCadJobTracker",
    canonicalTitle: "Remote CAD Job Tracker",
    matchTerms: ["remote cad job tracker", "cad job tracker"],
    preferredDomain: "applications",
    description: "Remote CAD & drafting application pipeline",
  },
  {
    key: "careerPortfolio",
    canonicalTitle: "Career / Portfolio",
    matchTerms: ["career / portfolio", "career/portfolio", "portfolio"],
    preferredDomain: "portfolio",
    description: "Portfolio deliverables and project showcase",
  },
  {
    key: "resume",
    canonicalTitle: "Resume",
    matchTerms: ["resume"],
    preferredDomain: "profile",
    description: "Primary formatted resume document",
  },
  {
    key: "resumeData",
    canonicalTitle: "Resume Data",
    matchTerms: ["resume data"],
    preferredDomain: "skills",
    description: "Structured resume biography, verified experience & skills data",
  },
  {
    key: "architectureCadPortfolioLab",
    canonicalTitle: "Architecture / CAD Portfolio Lab",
    matchTerms: [
      "architecture / cad portfolio lab",
      "cad portfolio lab",
      "architecture portfolio lab",
    ],
    preferredDomain: "portfolio",
    description: "Architecture and CAD portfolio lab projects",
  },
];

export const DOMAIN_FIELD_SPECS: Record<
  NotionDomainKey,
  {
    label: string;
    fields: { key: string; label: string; aliases: string[]; expectedTypes: string[] }[];
  }
> = {
  profile: {
    label: "Professional Profile",
    fields: [
      { key: "name", label: "Name", aliases: ["name", "full name", "candidate", "title"], expectedTypes: ["title", "rich_text"] },
      { key: "employmentHistory", label: "Employment History", aliases: ["employment history", "experience", "work history", "roles"], expectedTypes: ["rich_text"] },
      { key: "education", label: "Education", aliases: ["education", "school", "degree"], expectedTypes: ["rich_text"] },
      { key: "verifiedExperience", label: "Verified Experience", aliases: ["verified experience", "verified", "years experience", "proof"], expectedTypes: ["rich_text", "number", "checkbox"] },
      { key: "skills", label: "Skills", aliases: ["skills", "core skills", "software", "capabilities"], expectedTypes: ["multi_select", "rich_text"] },
    ],
  },
  skills: {
    label: "Skills Intelligence",
    fields: [
      { key: "existingSkills", label: "Existing Skills", aliases: ["skill", "name", "existing skills", "existing skill", "title"], expectedTypes: ["title", "multi_select", "rich_text"] },
      { key: "proficiency", label: "Proficiency", aliases: ["proficiency", "level", "rating", "score", "status"], expectedTypes: ["select", "status", "number", "rich_text"] },
      { key: "evidence", label: "Evidence", aliases: ["evidence", "proof", "artifact", "portfolio", "projects"], expectedTypes: ["rich_text", "url", "files"] },
      { key: "developingSkills", label: "Developing Skills", aliases: ["developing skills", "developing", "in progress", "learning"], expectedTypes: ["multi_select", "rich_text", "checkbox", "select", "status"] },
      { key: "missingSkills", label: "Missing Skills", aliases: ["missing skills", "gaps", "gap", "missing"], expectedTypes: ["multi_select", "rich_text", "checkbox"] },
      { key: "learningPriorities", label: "Learning Priorities", aliases: ["learning priorities", "priority", "next step", "resources"], expectedTypes: ["select", "rich_text", "multi_select"] },
    ],
  },
  applications: {
    label: "Job Applications",
    fields: [
      { key: "jobTitle", label: "Job Title", aliases: ["job title", "role", "position", "title", "name"], expectedTypes: ["title", "rich_text"] },
      { key: "company", label: "Company", aliases: ["company", "employer", "organization", "firm"], expectedTypes: ["rich_text", "select", "title"] },
      { key: "jobUrl", label: "Job URL", aliases: ["job url", "url", "link", "posting url", "application url"], expectedTypes: ["url", "rich_text"] },
      { key: "status", label: "Status", aliases: ["status", "stage", "application status", "state"], expectedTypes: ["status", "select", "rich_text"] },
      { key: "remoteEligibility", label: "Remote Eligibility", aliases: ["remote eligibility", "remote", "work arrangement", "work mode"], expectedTypes: ["checkbox", "select", "rich_text"] },
      { key: "ohioEligibility", label: "Ohio Eligibility", aliases: ["ohio eligibility", "ohio", "location", "state"], expectedTypes: ["checkbox", "select", "rich_text"] },
      { key: "applicationDate", label: "Application Date", aliases: ["application date", "date applied", "applied", "date"], expectedTypes: ["date", "rich_text"] },
      { key: "followUpDate", label: "Follow-up Date", aliases: ["follow-up date", "follow up date", "followup", "follow up"], expectedTypes: ["date", "rich_text"] },
      { key: "salary", label: "Salary", aliases: ["salary", "compensation", "pay", "rate"], expectedTypes: ["number", "rich_text"] },
      { key: "nextAction", label: "Next Action", aliases: ["next action", "next step", "notes", "action"], expectedTypes: ["rich_text"] },
    ],
  },
  portfolio: {
    label: "Portfolio",
    fields: [
      { key: "projectName", label: "Project Name", aliases: ["project name", "project", "name", "title"], expectedTypes: ["title", "rich_text"] },
      { key: "category", label: "Category", aliases: ["category", "division", "discipline", "type"], expectedTypes: ["select", "multi_select", "rich_text"] },
      { key: "software", label: "Software", aliases: ["software", "tools", "tech stack", "stack"], expectedTypes: ["multi_select", "rich_text"] },
      { key: "skillsDemonstrated", label: "Skills Demonstrated", aliases: ["skills demonstrated", "skills", "capabilities"], expectedTypes: ["multi_select", "rich_text"] },
      { key: "deliverables", label: "Deliverables", aliases: ["deliverables", "artifacts", "output", "summary", "description"], expectedTypes: ["rich_text"] },
      { key: "projectStatus", label: "Project Status", aliases: ["project status", "status", "portfolio status", "stage"], expectedTypes: ["status", "select", "rich_text"] },
      { key: "portfolioUrl", label: "Portfolio URL", aliases: ["portfolio url", "url", "link", "live url", "project url"], expectedTypes: ["url", "rich_text"] },
    ],
  },
};

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: string;
  options?: string[];
}

export interface NotionDocumentSummary {
  id: string;
  objectType: NotionObjectType;
  title: string;
  url: string;
  lastEditedTime: string;
  createdTime: string;
  parentType?: string;
  parentId?: string;
  recognizedKey?: string;
  recognizedTitle?: string;
  properties?: Record<string, NotionPropertySchema>;
}

export interface NotionBlockItem {
  id: string;
  type: string;
  text: string;
  hasChildren: boolean;
  checked?: boolean;
}

export interface NotionPageDetail {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  createdTime: string;
  parentType?: string;
  parentId?: string;
  properties: Record<string, any>;
  normalizedProperties: Record<string, string | string[] | number | boolean | null>;
  blocks: NotionBlockItem[];
  plainText: string;
  sanitized: true;
}

export interface NotionDatabaseRecord {
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  createdTime: string;
  properties: Record<string, any>;
  normalizedFields: Record<string, string | string[] | number | boolean | null>;
}

export interface NotionDomainMapping {
  domain: NotionDomainKey;
  databaseId: string;
  databaseTitle: string;
  fieldToProperty: Record<string, string>;
  updatedAt: string;
}

export interface RecordSyncMapping {
  localId: string;
  notionPageId: string;
  domain: NotionDomainKey;
  title: string;
  lastLocalEditedAt: string;
  lastNotionEditedAt: string;
  lastSyncedAt: string;
  lastSyncHash: string;
}

export interface SyncConflict {
  id: string;
  domain: NotionDomainKey;
  localId: string;
  notionPageId: string;
  title: string;
  reason: string;
  localUpdatedAt: string;
  notionUpdatedAt: string;
  resolution: "pending" | "keep_notion" | "force_local";
  detectedAt: string;
}

export interface SyncHistoryEntry {
  id: string;
  timestamp: string;
  direction: "pull" | "push" | "bidirectional";
  domains: NotionDomainKey[];
  created: number;
  updated: number;
  skippedDuplicates: number;
  conflicts: number;
  errors: string[];
  status: "success" | "partial" | "error";
  summary: string;
}

export interface NotionRuntimeStore {
  enabled: boolean;
  enforceAllowlist: boolean;
  authorizedIds: string[];
  mappings: Partial<Record<NotionDomainKey, NotionDomainMapping>>;
  recordLinks: RecordSyncMapping[];
  conflicts: SyncConflict[];
  syncHistory: SyncHistoryEntry[];
  lastSyncAt: string | null;
}
