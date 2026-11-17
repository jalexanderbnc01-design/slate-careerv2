import { UserProfile } from "../types";
import { XelimeWorkspaceState, XelimeOpportunity, XelimeProject, XelimeSkill } from "../types/xelime";
import { defaultXelimeState } from "../data/xelimeDefaults";
import { authFetch } from "../firebase/client";
import { getUserStoreValue, setUserStoreValue } from "./userStore";

export type NotionDomainKey = "profile" | "skills" | "applications" | "portfolio";

export interface NotionStatusResponse {
  configured: boolean;
  enabled: boolean;
  connected: boolean;
  status: "unconfigured" | "disconnected" | "connected" | "error";
  apiVersion: string;
  message: string;
  workspaceName: string | null;
  botName: string | null;
  enforceAllowlist: boolean;
  authorizedIds: string[];
  lastSyncAt: string | null;
  mappingsCount: number;
  linkedRecordsCount: number;
  pendingConflictsCount: number;
}

export interface NotionPropertySchema {
  id: string;
  name: string;
  type: string;
  options?: string[];
}

export interface NotionDocumentSummary {
  id: string;
  objectType: "page" | "database";
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

export interface KnownDocumentMatch {
  key: string;
  canonicalTitle: string;
  description: string;
  preferredDomain: NotionDomainKey | null;
  found: boolean;
  document: NotionDocumentSummary | null;
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
  blocks: { id: string; type: string; text: string; hasChildren: boolean; checked?: boolean }[];
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

export interface SyncStatusResponse {
  lastSyncAt: string | null;
  linkedRecordsCount: number;
  recordLinks: {
    localId: string;
    notionPageId: string;
    domain: NotionDomainKey;
    title: string;
    lastLocalEditedAt: string;
    lastNotionEditedAt: string;
    lastSyncedAt: string;
  }[];
  pendingConflicts: SyncConflict[];
  allConflicts: SyncConflict[];
  history: SyncHistoryEntry[];
  mappings: Partial<Record<NotionDomainKey, NotionDomainMapping>>;
}

export const DOMAIN_FIELD_LABELS: Record<
  NotionDomainKey,
  { label: string; fields: { key: string; label: string }[] }
> = {
  profile: {
    label: "Professional Profile",
    fields: [
      { key: "name", label: "Name" },
      { key: "employmentHistory", label: "Employment History" },
      { key: "education", label: "Education" },
      { key: "verifiedExperience", label: "Verified Experience" },
      { key: "skills", label: "Skills" },
    ],
  },
  skills: {
    label: "Skills Intelligence",
    fields: [
      { key: "existingSkills", label: "Existing Skills" },
      { key: "proficiency", label: "Proficiency" },
      { key: "evidence", label: "Evidence" },
      { key: "developingSkills", label: "Developing Skills" },
      { key: "missingSkills", label: "Missing Skills" },
      { key: "learningPriorities", label: "Learning Priorities" },
    ],
  },
  applications: {
    label: "Job Applications",
    fields: [
      { key: "jobTitle", label: "Job Title" },
      { key: "company", label: "Company" },
      { key: "jobUrl", label: "Job URL" },
      { key: "status", label: "Status" },
      { key: "remoteEligibility", label: "Remote Eligibility" },
      { key: "ohioEligibility", label: "Ohio Eligibility" },
      { key: "applicationDate", label: "Application Date" },
      { key: "followUpDate", label: "Follow-up Date" },
      { key: "salary", label: "Salary" },
      { key: "nextAction", label: "Next Action" },
    ],
  },
  portfolio: {
    label: "Portfolio",
    fields: [
      { key: "projectName", label: "Project Name" },
      { key: "category", label: "Category" },
      { key: "software", label: "Software" },
      { key: "skillsDemonstrated", label: "Skills Demonstrated" },
      { key: "deliverables", label: "Deliverables" },
      { key: "projectStatus", label: "Project Status" },
      { key: "portfolioUrl", label: "Portfolio URL" },
    ],
  },
};

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
    throw new Error(data?.error || `Notion API request failed (${res.status})`);
  }
  return data as T;
}

export function getNotionStatus(): Promise<NotionStatusResponse> {
  return apiJson("/api/notion/status");
}

export function connectNotionWorkspace(): Promise<{
  connected: boolean;
  botName: string;
  workspaceName: string;
  discoveredCount: number;
}> {
  return apiJson("/api/notion/connect", { method: "POST" });
}

export function disconnectNotionWorkspace(): Promise<{
  connected: boolean;
  enabled: boolean;
}> {
  return apiJson("/api/notion/disconnect", { method: "POST" });
}

export function updateNotionAccessPolicy(params: {
  enforceAllowlist?: boolean;
  authorizedIds?: string[];
}) {
  return apiJson<{ enforceAllowlist: boolean; authorizedIds: string[] }>(
    "/api/notion/access-policy",
    {
      method: "PATCH",
      body: JSON.stringify(params),
    }
  );
}

export function searchNotion(params?: {
  q?: string;
  type?: "page" | "database";
  cursor?: string;
  pageSize?: number;
}): Promise<{
  results: NotionDocumentSummary[];
  hasMore: boolean;
  nextCursor: string | null;
  knownDocuments: KnownDocumentMatch[];
}> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.type) qs.set("type", params.type);
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiJson(`/api/notion/search${suffix}`);
}

export function getNotionPage(id: string): Promise<NotionPageDetail> {
  return apiJson(`/api/notion/pages/${encodeURIComponent(id)}`);
}

export function listNotionDatabases(): Promise<{
  databases: NotionDocumentSummary[];
}> {
  return apiJson("/api/notion/databases");
}

export function getNotionDatabaseRecords(
  databaseId: string,
  params?: { cursor?: string; pageSize?: number }
): Promise<{
  database: NotionDocumentSummary;
  records: NotionDatabaseRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const qs = new URLSearchParams();
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiJson(
    `/api/notion/databases/${encodeURIComponent(databaseId)}/records${suffix}`
  );
}

export function getNotionMappings(): Promise<{
  mappings: Partial<Record<NotionDomainKey, NotionDomainMapping>>;
}> {
  return apiJson("/api/notion/mappings");
}

export function saveNotionMapping(mapping: {
  domain: NotionDomainKey;
  databaseId: string;
  databaseTitle: string;
  fieldToProperty: Record<string, string>;
}): Promise<{
  mappings: Partial<Record<NotionDomainKey, NotionDomainMapping>>;
}> {
  return apiJson("/api/notion/mappings", {
    method: "PUT",
    body: JSON.stringify(mapping),
  });
}

export function autoDetectNotionMappings(): Promise<{
  mappings: Partial<Record<NotionDomainKey, NotionDomainMapping>>;
  databasesCount: number;
}> {
  return apiJson("/api/notion/mappings/auto-detect", { method: "POST" });
}

export function importFromNotion(params: {
  sourceType: "page" | "database";
  id: string;
  domain?: NotionDomainKey;
}): Promise<any> {
  return apiJson("/api/notion/import", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function createNotionPage(params: {
  parentDatabaseId?: string;
  parentPageId?: string;
  title?: string;
  contentParagraphs?: string[];
  properties?: Record<string, any>;
  domain?: NotionDomainKey;
  domainRecord?: Record<string, any>;
}): Promise<{
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  normalizedProperties: Record<string, any>;
}> {
  return apiJson("/api/notion/pages", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function updateNotionPage(
  pageId: string,
  params: {
    properties?: Record<string, any>;
    domain?: NotionDomainKey;
    domainRecord?: Record<string, any>;
    appendParagraphs?: string[];
    expectedLastEditedTime?: string;
    forceOverwrite?: boolean;
  }
): Promise<{
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
  normalizedProperties: Record<string, any>;
}> {
  return apiJson(`/api/notion/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export function getNotionSyncStatus(): Promise<SyncStatusResponse> {
  return apiJson("/api/notion/sync/status");
}

export function runNotionSync(params: {
  direction: "pull" | "push" | "bidirectional";
  domains: NotionDomainKey[];
  localData?: Record<string, any[]>;
  forceConflictIds?: string[];
}): Promise<{
  entry: SyncHistoryEntry;
  pulledByDomain: Record<string, any[]>;
  conflicts: SyncConflict[];
  recordLinksCount: number;
}> {
  return apiJson("/api/notion/sync", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function resolveNotionConflict(
  conflictId: string,
  resolution: "keep_notion" | "force_local",
  localRecord?: Record<string, any>
): Promise<{ resolved: SyncConflict; syncStatus: SyncStatusResponse }> {
  return apiJson(
    `/api/notion/sync/conflicts/${encodeURIComponent(conflictId)}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ resolution, localRecord }),
    }
  );
}

const XELIME_STORAGE_KEY = "xelime_xcms_state_v1";

export function loadLocalXelimeState(): XelimeWorkspaceState {
  try {
    const raw = getUserStoreValue(XELIME_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as XelimeWorkspaceState;
  } catch {
    // fallback cleanly
  }
  return defaultXelimeState;
}

export function buildLocalSyncPayload(userProfile: UserProfile) {
  const xelime = loadLocalXelimeState();

  return {
    profile: [
      {
        id: "local-profile-primary",
        name: userProfile.name,
        employmentHistory: userProfile.experience
          .map((e) => `${e.role} @ ${e.company} (${e.period})`)
          .join("; "),
        education: userProfile.education
          .map((ed) => `${ed.degree} — ${ed.school} (${ed.period})`)
          .join("; "),
        verifiedExperience: userProfile.summary,
        skills: [...userProfile.skills, ...userProfile.software],
      },
    ],
    skills: xelime.skills.map((s) => ({
      id: s.id,
      existingSkills: s.name,
      proficiency: `${s.status} (${s.currentProficiency}%)`,
      evidence: s.practiceProjects || s.learningResources,
      developingSkills:
        s.status === "Learning" || s.status === "Practicing" ? [s.name] : [],
      missingSkills: s.status === "Not Started" ? [s.name] : [],
      learningPriorities: s.learningResources,
    })),
    applications: xelime.opportunities.map((o) => ({
      id: o.id,
      jobTitle: o.jobTitle,
      company: o.company,
      jobUrl: o.applicationUrl,
      status: o.applicationStatus,
      remoteEligibility: o.workArrangement === "Remote",
      ohioEligibility: o.location.toLowerCase().includes("oh") || o.workArrangement === "Remote",
      applicationDate: o.dateApplied || "",
      followUpDate: "",
      salary: o.salary,
      nextAction: o.notes || "",
    })),
    portfolio: xelime.projects.map((p) => ({
      id: p.id,
      projectName: p.name,
      category: p.division,
      software: p.software,
      skillsDemonstrated: p.skillsDemonstrated,
      deliverables: p.summary || "",
      projectStatus: p.projectStatus,
      portfolioUrl: p.projectUrl,
    })),
  };
}

export function mergePulledRecordsIntoLocal(pulledByDomain: Record<string, any[]>): {
  mergedApplications: number;
  mergedProjects: number;
  mergedSkills: number;
} {
  const state = loadLocalXelimeState();
  let mergedApplications = 0;
  let mergedProjects = 0;
  let mergedSkills = 0;

  // Merge applications cleanly without duplicates
  const pulledApps = pulledByDomain.applications || [];
  if (pulledApps.length > 0) {
    const nextOpps = [...state.opportunities];
    for (const item of pulledApps) {
      const d = item.data || {};
      const title = String(d.jobTitle || "").trim();
      const company = String(d.company || "").trim();
      if (!title) continue;

      const existingIdx = nextOpps.findIndex(
        (o) =>
          o.jobTitle.toLowerCase().trim() === title.toLowerCase() &&
          o.company.toLowerCase().trim() === company.toLowerCase()
      );
      const mappedOpp: XelimeOpportunity = {
        id:
          existingIdx >= 0
            ? nextOpps[existingIdx].id
            : `opp-notion-${item.notionPageId.slice(0, 8)}`,
        jobTitle: title,
        company: company || "Notion Tracker",
        careerPathId: state.careerPaths[0]?.id || "cp-cad-bim",
        employmentType: "Full-time",
        workArrangement:
          d.workArrangement === "Remote" || d.workArrangement === "Hybrid"
            ? d.workArrangement
            : "On-site",
        salary: Number(d.salary) || 55000,
        salaryLabel: d.salaryLabel || undefined,
        location: String(d.location || "Remote / Ohio"),
        applicationStatus: (d.status || "Discovered") as any,
        requiredSkills: [],
        portfolioMatchIds: [],
        applicationUrl: String(d.jobUrl || ""),
        priority: "Medium",
        dateApplied: String(d.applicationDate || ""),
        notes: String(d.nextAction || ""),
        decisionScores:
          existingIdx >= 0
            ? nextOpps[existingIdx].decisionScores
            : {
                skillAlignment: 80,
                xelimeRelevance: 80,
                incomePotential: 75,
                workFlexibility: d.workArrangement === "Remote" ? 95 : 70,
                professionalDevelopment: 75,
              },
      };

      if (existingIdx >= 0) {
        nextOpps[existingIdx] = { ...nextOpps[existingIdx], ...mappedOpp };
      } else {
        nextOpps.unshift(mappedOpp);
      }
      mergedApplications += 1;
    }
    state.opportunities = nextOpps;
  }

  // Merge portfolio projects
  const pulledPortfolio = pulledByDomain.portfolio || [];
  if (pulledPortfolio.length > 0) {
    const nextProjs = [...state.projects];
    for (const item of pulledPortfolio) {
      const d = item.data || {};
      const name = String(d.projectName || "").trim();
      if (!name) continue;
      const existingIdx = nextProjs.findIndex(
        (p) => p.name.toLowerCase().trim() === name.toLowerCase()
      );
      const mappedProj: XelimeProject = {
        id:
          existingIdx >= 0
            ? nextProjs[existingIdx].id
            : `proj-notion-${item.notionPageId.slice(0, 8)}`,
        name,
        division:
          d.category === "Visualization" || d.category === "Digital"
            ? d.category
            : "Architecture",
        careerPathIds: [state.careerPaths[0]?.id || "cp-cad-bim"],
        software: Array.isArray(d.software) ? d.software : [],
        projectStatus:
          d.projectStatus === "Completed" ||
          d.projectStatus === "Review" ||
          d.projectStatus === "Planned"
            ? d.projectStatus
            : "In Progress",
        skillsDemonstrated: Array.isArray(d.skillsDemonstrated)
          ? d.skillsDemonstrated
          : [],
        portfolioStatus: d.portfolioUrl ? "Published" : "Portfolio Ready",
        projectUrl: String(d.portfolioUrl || ""),
        summary: String(d.deliverables || ""),
      };
      if (existingIdx >= 0) {
        nextProjs[existingIdx] = { ...nextProjs[existingIdx], ...mappedProj };
      } else {
        nextProjs.unshift(mappedProj);
      }
      mergedProjects += 1;
    }
    state.projects = nextProjs;
  }

  // Merge skills
  const pulledSkills = pulledByDomain.skills || [];
  if (pulledSkills.length > 0) {
    const nextSkills = [...state.skills];
    for (const item of pulledSkills) {
      const d = item.data || {};
      const name = String(d.existingSkills || "").trim();
      if (!name) continue;
      const existingIdx = nextSkills.findIndex(
        (s) => s.name.toLowerCase().trim() === name.toLowerCase()
      );
      const mappedSkill: XelimeSkill = {
        id:
          existingIdx >= 0
            ? nextSkills[existingIdx].id
            : `sk-notion-${item.notionPageId.slice(0, 8)}`,
        name,
        category: existingIdx >= 0 ? nextSkills[existingIdx].category : "Architecture",
        status: existingIdx >= 0 ? nextSkills[existingIdx].status : "Practicing",
        currentProficiency:
          existingIdx >= 0 ? nextSkills[existingIdx].currentProficiency : 75,
        targetProficiency:
          existingIdx >= 0 ? nextSkills[existingIdx].targetProficiency : 90,
        learningResources: String(d.learningPriorities || ""),
        practiceProjects: String(d.evidence || ""),
        relatedCareerPathIds: [state.careerPaths[0]?.id || "cp-cad-bim"],
      };
      if (existingIdx >= 0) {
        nextSkills[existingIdx] = { ...nextSkills[existingIdx], ...mappedSkill };
      } else {
        nextSkills.push(mappedSkill);
      }
      mergedSkills += 1;
    }
    state.skills = nextSkills;
  }

  try {
    setUserStoreValue(XELIME_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("xelime-state-updated"));
  } catch {
    // ignore storage quota
  }

  return { mergedApplications, mergedProjects, mergedSkills };
}
