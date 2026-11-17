import crypto from "crypto";
import {
  FirestoreActor,
  actorDeleteDoc,
  actorGetDoc,
  actorListCollection,
  actorUpsertDoc,
  sanitizeFirestoreId,
} from "../firebaseStore";
import {
  ClayPipelineEvent,
  ClayRuntimeConfig,
  ClayRuntimeStore,
  IngestedCompanyRecord,
  IngestedCompanyStatus,
  IngestedJobLead,
  IngestedLeadStatus,
} from "./types";

const DEFAULT_CONFIG: ClayRuntimeConfig = {
  minMatchScore: 8,
  requireIngestSecretWhenSet: true,
};

interface ClayRuntimeSettingsData {
  config: ClayRuntimeConfig;
  events: ClayPipelineEvent[];
}

function stripUndefinedDeep<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (val && typeof val === "object" && !(val instanceof Date)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, any>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return val;
}

async function loadClaySettings(actor: FirestoreActor): Promise<ClayRuntimeSettingsData> {
  const doc = await actorGetDoc(`users/${actor.uid}/settings/clay_runtime`, actor);
  const data = (doc?.data || {}) as Partial<ClayRuntimeSettingsData>;
  return {
    config: {
      minMatchScore:
        typeof data.config?.minMatchScore === "number"
          ? Math.min(10, Math.max(1, data.config.minMatchScore))
          : DEFAULT_CONFIG.minMatchScore,
      requireIngestSecretWhenSet:
        typeof data.config?.requireIngestSecretWhenSet === "boolean"
          ? data.config.requireIngestSecretWhenSet
          : DEFAULT_CONFIG.requireIngestSecretWhenSet,
    },
    events: Array.isArray(data.events) ? data.events.slice(0, 150) : [],
  };
}

async function saveClaySettings(actor: FirestoreActor, settings: ClayRuntimeSettingsData) {
  await actorUpsertDoc(`users/${actor.uid}/settings/clay_runtime`, actor, {
    kind: "clay_runtime",
    data: stripUndefinedDeep({
      config: settings.config,
      events: settings.events.slice(0, 150),
    }),
  });
}

function docToIngestedLead(doc: Record<string, any> & { _id: string }): IngestedJobLead | null {
  if (doc.recordType !== "clay_lead") return null;
  if (doc.payload && typeof doc.payload === "object") {
    return {
      ...(doc.payload as IngestedJobLead),
      id: doc._id,
      status: (doc.status || doc.payload.status || "New") as IngestedLeadStatus,
      notes: doc.notes ?? doc.payload.notes,
    };
  }
  return {
    id: doc._id,
    company: String(doc.company || ""),
    title: String(doc.title || "Untitled Role"),
    applyUrl: String(doc.applyUrl || ""),
    location: String(doc.location || "Remote / Unspecified"),
    workArrangement: "Unspecified",
    salary: String(doc.pay || ""),
    matchScore: typeof doc.matchScore === "number" ? doc.matchScore : 8,
    missingSkills: Array.isArray(doc.missingSkills) ? doc.missingSkills : [],
    matchedSkills: Array.isArray(doc.matchedSkills) ? doc.matchedSkills : [],
    description: String(doc.notes || ""),
    summary: String(doc.notes || ""),
    contact: { name: "", title: "", email: "", linkedinUrl: "", phone: "" },
    source: String(doc.source || "Clay Pipeline"),
    notes: typeof doc.notes === "string" ? doc.notes : undefined,
    status: (doc.status || "New") as IngestedLeadStatus,
    ingestedAt: String(doc.createdAt || new Date().toISOString()),
    updatedAt: String(doc.updatedAt || new Date().toISOString()),
  };
}

function docToIngestedCompany(doc: Record<string, any> & { _id: string }): IngestedCompanyRecord | null {
  if (doc.recordType !== "clay_company") return null;
  if (doc.payload && typeof doc.payload === "object") {
    return {
      ...(doc.payload as IngestedCompanyRecord),
      id: doc._id,
      status: (doc.status || doc.payload.status || "Prospect") as IngestedCompanyStatus,
      notes: doc.notes ?? doc.payload.notes,
    };
  }
  return {
    id: doc._id,
    name: String(doc.company || doc.title || "Company"),
    domain: "",
    websiteUrl: String(doc.applyUrl || ""),
    industry: "Design / Architecture / Engineering",
    size: "",
    location: String(doc.location || "Columbus, OH"),
    jobOpeningsSummary: "",
    careersUrl: String(doc.applyUrl || ""),
    openingsCount: 0,
    news: "",
    competitors: [],
    funding: "",
    fitScore: typeof doc.matchScore === "number" ? doc.matchScore : undefined,
    missingSkills: Array.isArray(doc.missingSkills) ? doc.missingSkills : [],
    matchedSkills: Array.isArray(doc.matchedSkills) ? doc.matchedSkills : [],
    contact: { name: "", title: "", email: "", linkedinUrl: "", phone: "" },
    source: String(doc.source || "Columbus Design Companies (Clay)"),
    notes: typeof doc.notes === "string" ? doc.notes : undefined,
    status: (doc.status || "Prospect") as IngestedCompanyStatus,
    ingestedAt: String(doc.createdAt || new Date().toISOString()),
    updatedAt: String(doc.updatedAt || new Date().toISOString()),
  };
}

async function saveLeadToFirestore(actor: FirestoreActor, lead: IngestedJobLead) {
  const safeId = sanitizeFirestoreId(lead.id, "clay_lead");
  const normalizedLead: IngestedJobLead = { ...lead, id: safeId };
  await actorUpsertDoc(`users/${actor.uid}/leads/${safeId}`, actor, {
    recordType: "clay_lead",
    title: sanitizeClayText(normalizedLead.title, 240) || "Untitled Role",
    company: sanitizeClayText(normalizedLead.company, 240),
    status: sanitizeClayText(normalizedLead.status, 100) || "New",
    location: sanitizeClayText(normalizedLead.location, 240),
    pay: sanitizeClayText(normalizedLead.salary, 120),
    applyUrl: sanitizeClayText(normalizedLead.applyUrl, 2000),
    source: sanitizeClayText(normalizedLead.source, 160),
    matchScore: Math.min(100, Math.max(0, Number(normalizedLead.matchScore) || 0)),
    notes: sanitizeClayText(normalizedLead.notes || "", 12000),
    matchedSkills: (normalizedLead.matchedSkills || []).slice(0, 60).map((s) => sanitizeClayText(s, 120)),
    missingSkills: (normalizedLead.missingSkills || []).slice(0, 60).map((s) => sanitizeClayText(s, 120)),
    payload: stripUndefinedDeep(normalizedLead),
  });
  return normalizedLead;
}

async function saveCompanyToFirestore(actor: FirestoreActor, company: IngestedCompanyRecord) {
  const safeId = sanitizeFirestoreId(company.id, "clay_co");
  const normalizedCompany: IngestedCompanyRecord = { ...company, id: safeId };
  await actorUpsertDoc(`users/${actor.uid}/leads/${safeId}`, actor, {
    recordType: "clay_company",
    title: sanitizeClayText(normalizedCompany.name, 240) || "Target Company",
    company: sanitizeClayText(normalizedCompany.name, 240),
    status: sanitizeClayText(normalizedCompany.status, 100) || "Prospect",
    location: sanitizeClayText(normalizedCompany.location, 240),
    pay: "",
    applyUrl: sanitizeClayText(normalizedCompany.careersUrl || normalizedCompany.websiteUrl, 2000),
    source: sanitizeClayText(normalizedCompany.source, 160),
    matchScore: Math.min(100, Math.max(0, Number(normalizedCompany.fitScore) || 0)),
    notes: sanitizeClayText(normalizedCompany.notes || "", 12000),
    matchedSkills: (normalizedCompany.matchedSkills || []).slice(0, 60).map((s) => sanitizeClayText(s, 120)),
    missingSkills: (normalizedCompany.missingSkills || []).slice(0, 60).map((s) => sanitizeClayText(s, 120)),
    payload: stripUndefinedDeep(normalizedCompany),
  });
  return normalizedCompany;
}

export async function loadClayStore(actor: FirestoreActor): Promise<ClayRuntimeStore> {
  const [settings, allLeadDocs] = await Promise.all([
    loadClaySettings(actor),
    actorListCollection(`users/${actor.uid}/leads`, actor),
  ]);

  const leads: IngestedJobLead[] = [];
  const companies: IngestedCompanyRecord[] = [];
  for (const doc of allLeadDocs) {
    if (doc.recordType === "clay_lead") {
      const l = docToIngestedLead(doc);
      if (l) leads.push(l);
    } else if (doc.recordType === "clay_company") {
      const c = docToIngestedCompany(doc);
      if (c) companies.push(c);
    }
  }

  leads.sort((a, b) => (b.ingestedAt || "").localeCompare(a.ingestedAt || ""));
  companies.sort((a, b) => (b.ingestedAt || "").localeCompare(a.ingestedAt || ""));

  return {
    config: settings.config,
    leads,
    companies,
    events: settings.events,
  };
}

export function sanitizeClayText(input: unknown, maxLen = 4000): string {
  return String(input ?? "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function sanitizeHttpUrl(input: unknown): string {
  const s = sanitizeClayText(input, 800);
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : "";
}

function sanitizeStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return Array.from(
      new Set(input.map((v) => sanitizeClayText(v, 120)).filter(Boolean))
    ).slice(0, 30);
  }
  if (typeof input === "string" && input.trim()) {
    const trimmed = input.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return sanitizeStringArray(parsed);
        }
      } catch {
        // Fall through
      }
    }
    return Array.from(
      new Set(
        trimmed
          .split(/[,;\n|]+/)
          .map((v) => sanitizeClayText(v, 120))
          .filter(Boolean)
      )
    ).slice(0, 30);
  }
  return [];
}

function normalizeMatchScore(raw: unknown): { score: number; rawScore?: number } {
  if (raw === undefined || raw === null || raw === "") {
    return { score: 0 };
  }
  let num = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) {
    return { score: 0 };
  }
  const rawScore = num;
  if (num > 10 && num <= 100) {
    num = Math.round((num / 10) * 10) / 10;
  }
  const clamped = Math.min(10, Math.max(1, Math.round(num * 10) / 10));
  return { score: clamped, rawScore };
}

function inferArrangement(
  val: unknown,
  location: string
): IngestedJobLead["workArrangement"] {
  const combined = `${String(val ?? "")} ${location}`.toLowerCase();
  if (combined.includes("remote")) return "Remote";
  if (combined.includes("hybrid")) return "Hybrid";
  if (combined.includes("on-site") || combined.includes("onsite")) return "On-site";
  return "Unspecified";
}

function pushEvent(
  settings: ClayRuntimeSettingsData,
  ev: Omit<ClayPipelineEvent, "id" | "timestamp">
) {
  const entry: ClayPipelineEvent = {
    id: `clay-ev-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    timestamp: new Date().toISOString(),
    ...ev,
  };
  settings.events = [entry, ...settings.events].slice(0, 150);
  return entry;
}

export function getClayEnvStatus() {
  const webhookUrl = (process.env.CLAY_WEBHOOK_URL || "").trim();
  const apiKey = (process.env.CLAY_API_KEY || "").trim();
  const ingestSecret = (process.env.CLAY_INGEST_SECRET || "").trim();

  const webhookConfigured = Boolean(
    webhookUrl && /^https?:\/\//i.test(webhookUrl) && !webhookUrl.includes("MY_CLAY")
  );
  const apiKeyConfigured = Boolean(apiKey && apiKey.length >= 6 && !apiKey.includes("MY_CLAY"));
  const ingestSecretConfigured = Boolean(ingestSecret && ingestSecret.length >= 6);

  return {
    webhookUrl,
    apiKey,
    ingestSecret,
    webhookConfigured,
    apiKeyConfigured,
    ingestSecretConfigured,
  };
}

export async function getClayStatusSummary(actor: FirestoreActor) {
  const store = await loadClayStore(actor);
  const env = getClayEnvStatus();

  return {
    webhookConfigured: env.webhookConfigured,
    apiKeyConfigured: env.apiKeyConfigured,
    ingestSecretConfigured: env.ingestSecretConfigured,
    config: store.config,
    counts: {
      totalLeads: store.leads.length,
      newLeads: store.leads.filter((l) => l.status === "New").length,
      readyToApply: store.leads.filter((l) => l.status === "Ready to Apply").length,
      applied: store.leads.filter((l) => l.status === "Applied").length,
      totalCompanies: store.companies.length,
      companiesWithOpenings: store.companies.filter(
        (c) => c.openingsCount > 0 || Boolean(c.jobOpeningsSummary)
      ).length,
      eventsCount: store.events.length,
    },
    leads: store.leads,
    companies: store.companies,
    events: store.events.slice(0, 50),
  };
}

export async function updateClayConfig(
  actor: FirestoreActor,
  patch: Partial<ClayRuntimeConfig>
) {
  const settings = await loadClaySettings(actor);
  if (typeof patch.minMatchScore === "number" && Number.isFinite(patch.minMatchScore)) {
    settings.config.minMatchScore = Math.min(10, Math.max(1, Math.round(patch.minMatchScore)));
  }
  if (typeof patch.requireIngestSecretWhenSet === "boolean") {
    settings.config.requireIngestSecretWhenSet = patch.requireIngestSecretWhenSet;
  }
  await saveClaySettings(actor, settings);
  return settings.config;
}

export async function verifyIngestAuthorization(
  headers: Record<string, any>,
  actor?: FirestoreActor
): Promise<boolean> {
  const env = getClayEnvStatus();
  let requireWhenSet = true;
  if (actor) {
    try {
      const settings = await loadClaySettings(actor);
      requireWhenSet = settings.config.requireIngestSecretWhenSet;
    } catch {
      requireWhenSet = true;
    }
  }
  if (!env.ingestSecretConfigured || !requireWhenSet) {
    return true;
  }
  const authHeader = String(headers.authorization || headers.Authorization || "");
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const custom = String(headers["x-clay-secret"] || headers["X-Clay-Secret"] || "").trim();
  return bearer === env.ingestSecret || custom === env.ingestSecret;
}

function extractContactFromPayload(payload: Record<string, any>) {
  let contactObj: Record<string, any> = {};
  let fallbackContactText = "";

  if (payload.contact && typeof payload.contact === "object") {
    contactObj = payload.contact;
  } else if (typeof payload.contact === "string" && payload.contact.trim()) {
    const trimmed = payload.contact.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
          contactObj = parsed;
        }
      } catch {
        fallbackContactText = trimmed;
      }
    } else {
      fallbackContactText = trimmed;
    }
  }

  const emailInTextMatch = fallbackContactText.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );
  const extractedEmail = emailInTextMatch ? emailInTextMatch[0] : "";
  const cleanedNameFromText = fallbackContactText
    ? fallbackContactText
        .replace(extractedEmail, "")
        .trim()
        .replace(/[<>|(),-]+$/g, "")
        .trim()
    : "";

  return {
    name: sanitizeClayText(
      contactObj.name ??
        contactObj.hiringManager ??
        payload.contactName ??
        payload.hiringManager ??
        payload.hiring_manager ??
        payload.recruiterName ??
        payload.recruiter_name ??
        cleanedNameFromText,
      140
    ),
    title: sanitizeClayText(
      contactObj.title ??
        contactObj.hiringManagerTitle ??
        payload.contactTitle ??
        payload.hiringManagerTitle ??
        payload.recruiterTitle ??
        payload.recruiter_title,
      140
    ),
    email: sanitizeClayText(
      contactObj.email ??
        contactObj.recruiterEmail ??
        payload.contactEmail ??
        payload.recruiterEmail ??
        payload.recruiter_email ??
        payload.email ??
        extractedEmail,
      180
    ),
    linkedinUrl: sanitizeHttpUrl(
      contactObj.linkedinUrl ??
        contactObj.linkedin ??
        contactObj.recruiterLinkedin ??
        payload.contactLinkedin ??
        payload.recruiterLinkedin ??
        payload.linkedin
    ),
    phone: sanitizeClayText(
      contactObj.phone ?? payload.contactPhone ?? payload.phone,
      60
    ),
  };
}

function isCompanyFocusedPayload(payload: Record<string, any>): boolean {
  const hasTitle = Boolean(
    payload.title ?? payload.position ?? payload.jobTitle ?? payload.job_title ?? payload.role
  );
  if (hasTitle) return false;

  return Boolean(
    payload.domain ??
      payload.Domain ??
      payload.industry ??
      payload.Industry ??
      payload.size ??
      payload.Size ??
      payload.jobOpenings ??
      payload.job_openings ??
      payload["Job Openings"] ??
      payload.news ??
      payload.News ??
      payload.funding ??
      payload.Funding ??
      payload.latestFunding ??
      payload.latest_funding ??
      payload["Latest Funding"] ??
      payload.competitors ??
      payload.Competitors ??
      payload.name ??
      payload.Name
  );
}

function summarizeJobOpenings(rawOpenings: unknown): {
  items: { title: string; url: string; location: string; description: string }[];
  summaryText: string;
  careersUrl: string;
} {
  if (typeof rawOpenings === "string") {
    const trimmed = rawOpenings.trim();
    if (
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.startsWith("{") && trimmed.endsWith("}"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return summarizeJobOpenings(parsed);
      } catch {
        // Fall through
      }
    }
  }
  if (Array.isArray(rawOpenings)) {
    const items = rawOpenings
      .map((item: any) => {
        if (typeof item === "string") {
          return { title: sanitizeClayText(item, 180), url: "", location: "", description: "" };
        }
        if (item && typeof item === "object") {
          return {
            title: sanitizeClayText(item.title || item.position || item.role || item.name, 180),
            url: sanitizeHttpUrl(item.url || item.applyUrl || item.link),
            location: sanitizeClayText(item.location || "", 120),
            description: sanitizeClayText(item.description || item.summary || "", 1200),
          };
        }
        return null;
      })
      .filter((x): x is { title: string; url: string; location: string; description: string } =>
        Boolean(x && x.title)
      )
      .slice(0, 15);

    return {
      items,
      summaryText: items.map((i) => i.title).join("; "),
      careersUrl: items.find((i) => i.url)?.url || "",
    };
  }

  if (rawOpenings && typeof rawOpenings === "object") {
    const obj = rawOpenings as Record<string, any>;
    const nested = obj.openings || obj.jobs || obj.results || obj.data;
    if (Array.isArray(nested)) {
      return summarizeJobOpenings(nested);
    }
    const text = sanitizeClayText(
      obj.summary || obj.title || obj.text || JSON.stringify(obj),
      2000
    );
    return {
      items: [],
      summaryText: text,
      careersUrl: sanitizeHttpUrl(obj.url || obj.careersUrl || obj.link),
    };
  }

  const str = sanitizeClayText(rawOpenings, 2500);
  const urlMatch = str.match(/https?:\/\/[^\s,]+/i);
  return {
    items: [],
    summaryText: str,
    careersUrl: urlMatch ? sanitizeHttpUrl(urlMatch[0]) : "",
  };
}

export async function ingestClayCompanyPayload(
  actor: FirestoreActor,
  payload: Record<string, any>,
  options: { bypassThreshold?: boolean } = {}
): Promise<{
  ingested: boolean;
  mode: "company";
  filtered?: boolean;
  deduplicated?: boolean;
  reason?: string;
  company?: IngestedCompanyRecord;
  leadsCreated?: number;
}> {
  const store = await loadClayStore(actor);
  const settings: ClayRuntimeSettingsData = { config: store.config, events: store.events };

  const name = sanitizeClayText(
    payload.name ??
      payload.Name ??
      payload.company ??
      payload.Company ??
      payload.companyName ??
      payload.company_name,
    180
  );
  if (!name) {
    throw new Error("Company 'name' (or 'company') is required.");
  }

  const domain = sanitizeClayText(
    payload.domain ?? payload.Domain ?? payload.website ?? payload.Website,
    180
  )
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");

  const websiteUrl =
    sanitizeHttpUrl(payload.websiteUrl ?? payload.website ?? payload.url) ||
    (domain ? `https://${domain}` : "");

  const industry = sanitizeClayText(payload.industry ?? payload.Industry, 140) || "Design / Architecture / Engineering";
  const size = sanitizeClayText(payload.size ?? payload.Size ?? payload.companySize ?? payload.employees, 80);
  const location = sanitizeClayText(payload.location ?? payload.Location ?? payload.city, 160) || "Columbus, OH";

  const rawOpenings =
    payload.jobOpenings ??
    payload.job_openings ??
    payload["Job Openings"] ??
    payload.openings;
  const parsedOpenings = summarizeJobOpenings(rawOpenings);
  const careersUrl =
    sanitizeHttpUrl(payload.careersUrl ?? payload.applyUrl ?? payload.jobUrl) ||
    parsedOpenings.careersUrl ||
    websiteUrl;

  const news = sanitizeClayText(payload.news ?? payload.News, 1500);
  const competitors = sanitizeStringArray(payload.competitors ?? payload.Competitors);
  const funding = sanitizeClayText(
    payload.funding ??
      payload.Funding ??
      payload.latestFunding ??
      payload.latest_funding ??
      payload["Latest Funding"],
    300
  );

  const { score } = normalizeMatchScore(
    payload.fitScore ??
      payload.matchScore ??
      payload.match_score ??
      payload.score ??
      payload.claygentScore
  );

  if (score > 0 && !options.bypassThreshold && score < store.config.minMatchScore) {
    pushEvent(settings, {
      direction: "inbound",
      status: "filtered",
      summary: `Filtered company ${name} (score ${score}/10 < minimum ${store.config.minMatchScore}/10).`,
      company: name,
      score,
    });
    await saveClaySettings(actor, settings);
    return {
      ingested: false,
      mode: "company",
      filtered: true,
      reason: `Company fit score ${score}/10 is below configured threshold (${store.config.minMatchScore}/10).`,
    };
  }

  const matchedSkills = sanitizeStringArray(
    payload.matchedSkills ?? payload.verifiedMatches ?? payload.skills
  );
  const missingSkills = sanitizeStringArray(
    payload.missingSkills ?? payload.missing_skills ?? payload.gaps
  );
  const contact = extractContactFromPayload(payload);
  const clayTableId = sanitizeClayText(payload.clayTableId ?? payload.tableId, 120) || undefined;
  const clayRowId = sanitizeClayText(payload.clayRowId ?? payload.rowId, 120) || undefined;
  const source = sanitizeClayText(payload.source, 100) || "Columbus Design Companies (Clay)";
  const notes = sanitizeClayText(payload.notes, 1000) || undefined;
  const openingsCount =
    parsedOpenings.items.length > 0
      ? parsedOpenings.items.length
      : parsedOpenings.summaryText && !/^none|0|no openings/i.test(parsedOpenings.summaryText)
      ? 1
      : 0;

  const now = new Date().toISOString();
  const existing = store.companies.find(
    (c) =>
      (clayRowId && c.clayRowId === clayRowId) ||
      (domain && c.domain && c.domain.toLowerCase() === domain.toLowerCase()) ||
      c.name.toLowerCase() === name.toLowerCase()
  );

  let savedCompany: IngestedCompanyRecord;
  let deduplicated = false;

  if (existing) {
    deduplicated = true;
    savedCompany = {
      ...existing,
      domain: domain || existing.domain,
      websiteUrl: websiteUrl || existing.websiteUrl,
      industry: industry || existing.industry,
      size: size || existing.size,
      location: location || existing.location,
      jobOpeningsSummary: parsedOpenings.summaryText || existing.jobOpeningsSummary,
      careersUrl: careersUrl || existing.careersUrl,
      openingsCount: openingsCount || existing.openingsCount,
      news: news || existing.news,
      competitors: competitors.length > 0 ? competitors : existing.competitors,
      funding: funding || existing.funding,
      fitScore: score > 0 ? score : existing.fitScore,
      missingSkills: missingSkills.length > 0 ? missingSkills : existing.missingSkills,
      matchedSkills: matchedSkills.length > 0 ? matchedSkills : existing.matchedSkills,
      contact: {
        name: contact.name || existing.contact.name,
        title: contact.title || existing.contact.title,
        email: contact.email || existing.contact.email,
        linkedinUrl: contact.linkedinUrl || existing.contact.linkedinUrl,
        phone: contact.phone || existing.contact.phone,
      },
      source,
      clayTableId: clayTableId || existing.clayTableId,
      clayRowId: clayRowId || existing.clayRowId,
      notes: notes || existing.notes,
      status: openingsCount > 0 && existing.status === "Prospect" ? "Openings Found" : existing.status,
      updatedAt: now,
    };
  } else {
    savedCompany = {
      id: `clay_co_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      name,
      domain,
      websiteUrl,
      industry,
      size,
      location,
      jobOpeningsSummary: parsedOpenings.summaryText,
      careersUrl,
      openingsCount,
      news,
      competitors,
      funding,
      fitScore: score > 0 ? score : undefined,
      missingSkills,
      matchedSkills,
      contact,
      source,
      clayTableId,
      clayRowId,
      notes,
      status: openingsCount > 0 ? "Openings Found" : "Prospect",
      ingestedAt: now,
      updatedAt: now,
    };
  }

  savedCompany = await saveCompanyToFirestore(actor, savedCompany);

  pushEvent(settings, {
    direction: "inbound",
    status: "success",
    summary: `${deduplicated ? "Updated" : "Ingested"} company ${name}${domain ? ` (${domain})` : ""}${openingsCount > 0 ? " · openings detected" : ""}.`,
    company: name,
    score: score > 0 ? score : undefined,
  });
  await saveClaySettings(actor, settings);

  let leadsCreated = 0;
  if (parsedOpenings.items.length > 0) {
    for (const op of parsedOpenings.items) {
      const leadRes = await ingestClayJobPayload(
        actor,
        {
          company: name,
          title: op.title,
          applyUrl: op.url || careersUrl,
          location: op.location || location,
          matchScore: score > 0 ? score : store.config.minMatchScore,
          matchedSkills,
          missingSkills,
          contact,
          description: [
            op.description,
            `Company: ${name} (${industry}${size ? ` · ${size}` : ""})`,
            news ? `Recent News: ${news}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          source,
          clayTableId,
        },
        { bypassThreshold: true }
      );
      if (leadRes.ingested) leadsCreated += 1;
    }
  } else if (openingsCount > 0 && parsedOpenings.summaryText) {
    const leadRes = await ingestClayJobPayload(
      actor,
      {
        company: name,
        title: `Open Role(s) at ${name}`,
        applyUrl: careersUrl,
        location,
        matchScore: score > 0 ? score : store.config.minMatchScore,
        matchedSkills,
        missingSkills,
        contact,
        description: [
          `Job Openings Waterfall Output: ${parsedOpenings.summaryText}`,
          `Industry: ${industry}${size ? ` · Size: ${size}` : ""}`,
          news ? `News: ${news}` : "",
          funding ? `Funding: ${funding}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        source,
        clayTableId,
      },
      { bypassThreshold: true }
    );
    if (leadRes.ingested) leadsCreated += 1;
  }

  return {
    ingested: true,
    mode: "company",
    deduplicated,
    company: savedCompany,
    leadsCreated,
  };
}

export async function ingestClayJobPayload(
  actor: FirestoreActor,
  payload: Record<string, any>,
  options: { bypassThreshold?: boolean } = {}
): Promise<{
  ingested: boolean;
  mode?: "job" | "company";
  filtered?: boolean;
  deduplicated?: boolean;
  reason?: string;
  lead?: IngestedJobLead;
  company?: IngestedCompanyRecord;
  leadsCreated?: number;
}> {
  if (isCompanyFocusedPayload(payload)) {
    return ingestClayCompanyPayload(actor, payload, options);
  }

  const store = await loadClayStore(actor);
  const settings: ClayRuntimeSettingsData = { config: store.config, events: store.events };

  const company = sanitizeClayText(
    payload.company ?? payload.companyName ?? payload.company_name ?? payload.employer,
    180
  );
  const title = sanitizeClayText(
    payload.title ??
      payload.position ??
      payload.jobTitle ??
      payload.job_title ??
      payload.role,
    200
  );

  if (!company || !title) {
    pushEvent(settings, {
      direction: "inbound",
      status: "error",
      summary: "Rejected Clay payload missing required company/name or job title/position.",
      company: company || undefined,
      jobTitle: title || undefined,
    });
    await saveClaySettings(actor, settings);
    throw new Error(
      "Payload must include either ('company' + 'title'/'position') for a job lead, or company fields ('name'/'domain'/'industry'/'jobOpenings') for a company row."
    );
  }

  const { score, rawScore } = normalizeMatchScore(
    payload.matchScore ??
      payload.match_score ??
      payload.score ??
      payload.claygentScore ??
      payload.claygent_score ??
      8
  );

  const effectiveScore = score > 0 ? score : 8;

  if (!options.bypassThreshold && effectiveScore < store.config.minMatchScore) {
    pushEvent(settings, {
      direction: "inbound",
      status: "filtered",
      summary: `Filtered out ${title} @ ${company} (score ${effectiveScore}/10 < minimum ${store.config.minMatchScore}/10).`,
      company,
      jobTitle: title,
      score: effectiveScore,
    });
    await saveClaySettings(actor, settings);
    return {
      ingested: false,
      mode: "job",
      filtered: true,
      reason: `Match score ${effectiveScore}/10 is below configured threshold (${store.config.minMatchScore}/10).`,
    };
  }

  const applyUrl = sanitizeHttpUrl(
    payload.applyUrl ??
      payload.applicationUrl ??
      payload.application_link ??
      payload.apply_link ??
      payload.jobUrl ??
      payload.job_url ??
      payload.url
  );
  const location =
    sanitizeClayText(payload.location ?? payload.city ?? payload.region, 160) ||
    "Remote / Unspecified";
  const salary = sanitizeClayText(payload.salary ?? payload.salaryRange ?? payload.compensation, 120);
  const workArrangement = inferArrangement(
    payload.workArrangement ?? payload.remote ?? payload.workType,
    location
  );

  const missingSkills = sanitizeStringArray(
    payload.missingSkills ?? payload.missing_skills ?? payload.gaps ?? payload.skillGaps
  );
  const matchedSkills = sanitizeStringArray(
    payload.matchedSkills ?? payload.verifiedMatches ?? payload.skills
  );

  const contact = extractContactFromPayload(payload);

  const description = sanitizeClayText(
    payload.description ?? payload.jobDescription ?? payload.job_description ?? payload.summary,
    8000
  );
  const summary =
    sanitizeClayText(payload.summary, 400) ||
    (description ? description.slice(0, 220) : `${title} opportunity at ${company}`);

  const clayTableId = sanitizeClayText(payload.clayTableId ?? payload.tableId, 120) || undefined;
  const clayRowId = sanitizeClayText(payload.clayRowId ?? payload.rowId, 120) || undefined;
  const source = sanitizeClayText(payload.source, 80) || "Clay Pipeline";
  const notes = sanitizeClayText(payload.notes, 1000) || undefined;

  const now = new Date().toISOString();

  const existing = store.leads.find(
    (l) =>
      (clayRowId && l.clayRowId === clayRowId) ||
      (applyUrl && l.applyUrl && l.applyUrl === applyUrl) ||
      (l.company.toLowerCase() === company.toLowerCase() &&
        l.title.toLowerCase() === title.toLowerCase())
  );

  let savedLead: IngestedJobLead;
  let deduplicated = false;

  if (existing) {
    deduplicated = true;
    savedLead = {
      ...existing,
      applyUrl: applyUrl || existing.applyUrl,
      location: location !== "Remote / Unspecified" ? location : existing.location,
      workArrangement: workArrangement !== "Unspecified" ? workArrangement : existing.workArrangement,
      salary: salary || existing.salary,
      matchScore: effectiveScore,
      rawScore: rawScore ?? existing.rawScore,
      missingSkills: missingSkills.length > 0 ? missingSkills : existing.missingSkills,
      matchedSkills: matchedSkills.length > 0 ? matchedSkills : existing.matchedSkills,
      description: description || existing.description,
      summary: summary || existing.summary,
      contact: {
        name: contact.name || existing.contact.name,
        title: contact.title || existing.contact.title,
        email: contact.email || existing.contact.email,
        linkedinUrl: contact.linkedinUrl || existing.contact.linkedinUrl,
        phone: contact.phone || existing.contact.phone,
      },
      source,
      clayTableId: clayTableId || existing.clayTableId,
      clayRowId: clayRowId || existing.clayRowId,
      notes: notes || existing.notes,
      updatedAt: now,
    };
  } else {
    savedLead = {
      id: `clay_lead_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      company,
      title,
      applyUrl,
      location,
      workArrangement,
      salary,
      matchScore: effectiveScore,
      rawScore,
      missingSkills,
      matchedSkills,
      description,
      summary,
      contact,
      source,
      clayTableId,
      clayRowId,
      notes,
      status: "New",
      ingestedAt: now,
      updatedAt: now,
    };
  }

  savedLead = await saveLeadToFirestore(actor, savedLead);

  pushEvent(settings, {
    direction: "inbound",
    status: "success",
    summary: `${deduplicated ? "Updated" : "Ingested"} ${title} @ ${company} (${effectiveScore}/10).`,
    company,
    jobTitle: title,
    score: effectiveScore,
  });
  await saveClaySettings(actor, settings);

  return {
    ingested: true,
    mode: "job",
    deduplicated,
    lead: savedLead,
  };
}

export async function updateIngestedLead(
  actor: FirestoreActor,
  id: string,
  patch: { status?: IngestedLeadStatus; notes?: string }
): Promise<IngestedJobLead> {
  const safeId = sanitizeFirestoreId(id, "clay_lead");
  const doc = await actorGetDoc(`users/${actor.uid}/leads/${safeId}`, actor);
  if (!doc || doc.recordType !== "clay_lead") {
    throw new Error("Ingested job lead not found.");
  }
  const current = docToIngestedLead(doc);
  if (!current) {
    throw new Error("Ingested job lead not found.");
  }
  const allowedStatuses: IngestedLeadStatus[] = [
    "New",
    "Reviewing",
    "Ready to Apply",
    "Applied",
    "Archived",
  ];
  const updated: IngestedJobLead = {
    ...current,
    status:
      patch.status && allowedStatuses.includes(patch.status)
        ? patch.status
        : current.status,
    notes:
      typeof patch.notes === "string"
        ? sanitizeClayText(patch.notes, 1000)
        : current.notes,
    updatedAt: new Date().toISOString(),
  };
  return saveLeadToFirestore(actor, updated);
}

export async function deleteIngestedLead(actor: FirestoreActor, id: string): Promise<boolean> {
  const safeId = sanitizeFirestoreId(id, "clay_lead");
  return actorDeleteDoc(`users/${actor.uid}/leads/${safeId}`, actor);
}

export async function updateIngestedCompany(
  actor: FirestoreActor,
  id: string,
  patch: { status?: IngestedCompanyStatus; notes?: string }
): Promise<IngestedCompanyRecord> {
  const safeId = sanitizeFirestoreId(id, "clay_co");
  const doc = await actorGetDoc(`users/${actor.uid}/leads/${safeId}`, actor);
  if (!doc || doc.recordType !== "clay_company") {
    throw new Error("Ingested company record not found.");
  }
  const current = docToIngestedCompany(doc);
  if (!current) {
    throw new Error("Ingested company record not found.");
  }
  const allowed: IngestedCompanyStatus[] = [
    "Prospect",
    "Openings Found",
    "Pitched",
    "Applied",
    "Archived",
  ];
  const updated: IngestedCompanyRecord = {
    ...current,
    status:
      patch.status && allowed.includes(patch.status)
        ? patch.status
        : current.status,
    notes:
      typeof patch.notes === "string"
        ? sanitizeClayText(patch.notes, 1000)
        : current.notes,
    updatedAt: new Date().toISOString(),
  };
  return saveCompanyToFirestore(actor, updated);
}

export async function deleteIngestedCompany(actor: FirestoreActor, id: string): Promise<boolean> {
  const safeId = sanitizeFirestoreId(id, "clay_co");
  return actorDeleteDoc(`users/${actor.uid}/leads/${safeId}`, actor);
}

export async function importLegacyClayStore(
  actor: FirestoreActor,
  legacy: Partial<ClayRuntimeStore>
): Promise<{ importedLeads: number; importedCompanies: number }> {
  const settings = await loadClaySettings(actor);
  if (legacy.config) {
    if (typeof legacy.config.minMatchScore === "number") {
      settings.config.minMatchScore = Math.min(10, Math.max(1, legacy.config.minMatchScore));
    }
    if (typeof legacy.config.requireIngestSecretWhenSet === "boolean") {
      settings.config.requireIngestSecretWhenSet = legacy.config.requireIngestSecretWhenSet;
    }
  }
  if (Array.isArray(legacy.events)) {
    const existingIds = new Set(settings.events.map((e) => e.id));
    for (const ev of legacy.events) {
      if (ev?.id && !existingIds.has(ev.id)) {
        settings.events.push(ev);
      }
    }
    settings.events = settings.events.slice(0, 150);
  }
  await saveClaySettings(actor, settings);

  let importedLeads = 0;
  let importedCompanies = 0;
  for (const l of Array.isArray(legacy.leads) ? legacy.leads : []) {
    if (l?.title) {
      await saveLeadToFirestore(actor, l);
      importedLeads += 1;
    }
  }
  for (const c of Array.isArray(legacy.companies) ? legacy.companies : []) {
    if (c?.name) {
      await saveCompanyToFirestore(actor, c);
      importedCompanies += 1;
    }
  }
  return { importedLeads, importedCompanies };
}

export async function pushJobsToClayWebhook(
  actor: FirestoreActor,
  jobs: Record<string, any>[]
): Promise<{
  pushed: number;
  failed: number;
  errors: string[];
}> {
  const env = getClayEnvStatus();
  const settings = await loadClaySettings(actor);

  if (!env.webhookConfigured) {
    throw new Error(
      "CLAY_WEBHOOK_URL is not configured. Add your Clay Incoming Webhook URL in AI Studio Settings -> Secrets."
    );
  }

  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error("At least one job or company object is required to push to Clay.");
  }

  const batch = jobs.slice(0, 25);
  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const job of batch) {
    const cleanPayload = {
      company: sanitizeClayText(job.company || job.companyName || job.name || "Unknown Company", 180),
      title: sanitizeClayText(job.title || job.position || "", 200),
      domain: sanitizeClayText(job.domain || "", 180),
      industry: sanitizeClayText(job.industry || "", 140),
      size: sanitizeClayText(job.size || "", 80),
      location: sanitizeClayText(job.location || "Columbus, OH / Remote", 160),
      applyUrl: sanitizeHttpUrl(job.applyUrl || job.url || job.jobUrl),
      salary: sanitizeClayText(job.salary || "", 120),
      description: sanitizeClayText(job.description || job.summary || "", 6000),
      skills: sanitizeStringArray(job.skills),
      source: sanitizeClayText(job.source || "Career Engine", 80),
      pushedAt: new Date().toISOString(),
    };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (env.apiKeyConfigured) {
        headers["x-clay-api-key"] = env.apiKey;
      }

      const res = await fetch(env.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(cleanPayload),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        const errText = (await res.text().catch(() => "")).slice(0, 180);
        failed += 1;
        errors.push(`${cleanPayload.company}: HTTP ${res.status} ${errText}`);
      } else {
        pushed += 1;
      }
    } catch (err: any) {
      failed += 1;
      errors.push(
        `${cleanPayload.company}: ${sanitizeClayText(err?.message || "Webhook error", 160)}`
      );
    }
  }

  pushEvent(settings, {
    direction: "outbound",
    status: failed === 0 ? "success" : pushed > 0 ? "filtered" : "error",
    summary: `Pushed ${pushed}/${batch.length} item(s) to Clay Incoming Webhook.`,
  });
  await saveClaySettings(actor, settings);

  return { pushed, failed, errors };
}
