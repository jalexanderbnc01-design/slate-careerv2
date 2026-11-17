import {
  FirestoreActor,
  actorGetDoc,
  actorListCollection,
  actorUpsertDoc,
  actorDeleteDoc,
  hashToFirestoreId,
} from "./firebaseStore";
import { getUserServiceKeys } from "./serviceKeys";

// Per-user key overrides: settings-page keys fill the gap when the matching
// env var is absent. An env key always wins when both exist.
export interface UserKeyOverrides {
  jsearch?: string;
  adzunaId?: string;
  adzunaKey?: string;
  jooble?: string;
  usajobs?: string;
  usajobsEmail?: string;
}

export async function loadUserKeyOverrides(
  actor?: FirestoreActor
): Promise<UserKeyOverrides> {
  if (!actor?.uid) return {};
  try {
    const keys = await getUserServiceKeys(actor);
    return {
      jsearch: keys.jsearch?.key,
      adzunaId: keys.adzuna?.key,
      adzunaKey: keys.adzuna?.extra,
      jooble: keys.jooble?.key,
      usajobs: keys.usajobs?.key,
      usajobsEmail: keys.usajobs?.extra,
    };
  } catch (err) {
    console.warn("User key overrides read failed:", err);
    return {};
  }
}

export interface NormalizedJobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  experienceLevel: string;
  skills: string[];
  summary: string;
  description: string;
  lane: string;
  scores: {
    money: number;
    creative: number;
    thcRisk: number;
    stress: number;
    skill: number;
    future: number;
  };
  latitude?: number;
  longitude?: number;
  remoteType: "onsite" | "hybrid" | "remote";
  applyUrl?: string;
  source: string;
  postedAt?: string;
}

export interface JobSourceStatus {
  id: string;
  name: string;
  category: "Aggregator" | "ATS" | "Niche Free" | "AI Fallback";
  requiresKey: boolean;
  configured: boolean;
  description: string;
}

interface CacheEntry {
  expiresAt: number;
  jobs: NormalizedJobListing[];
  providersUsed: string[];
  apiCallsLogged?: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Several job-board APIs (e.g. The Muse) reject requests that arrive without a
// browser-like User-Agent, causing silent provider losses (HTTP 403).
const LIVE_FEED_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json",
};

async function getCached(
  actor: FirestoreActor | undefined,
  key: string
): Promise<CacheEntry | null> {
  if (!actor?.uid) return null;
  const docId = hashToFirestoreId(key, "sc");
  const docPath = `users/${actor.uid}/searchCache/${docId}`;
  try {
    const entry = await actorGetDoc(docPath, actor);
    if (!entry) return null;
    const expiresAt = typeof entry.expiresAt === "number" ? entry.expiresAt : 0;
    if (Date.now() > expiresAt) {
      await actorDeleteDoc(docPath, actor).catch(() => {});
      return null;
    }
    return {
      expiresAt,
      jobs: Array.isArray(entry.jobs) ? entry.jobs : [],
      providersUsed: Array.isArray(entry.providersUsed) ? entry.providersUsed : [],
      apiCallsLogged: typeof entry.apiCallsLogged === "number" ? entry.apiCallsLogged : 0,
    };
  } catch (err) {
    console.warn("Firestore searchCache read failed:", err);
    return null;
  }
}

async function setCached(
  actor: FirestoreActor | undefined,
  key: string,
  meta: { query: string; location: string; source: string; remoteOnly: boolean; apiCallsLogged: number },
  jobs: NormalizedJobListing[],
  providersUsed: string[]
) {
  if (!actor?.uid) return;
  const docId = hashToFirestoreId(key, "sc");
  const docPath = `users/${actor.uid}/searchCache/${docId}`;
  try {
    await actorUpsertDoc(docPath, actor, {
      query: String(meta.query || "").slice(0, 300),
      location: String(meta.location || "").slice(0, 200),
      source: String(meta.source || "auto").slice(0, 80) || "auto",
      remoteOnly: Boolean(meta.remoteOnly),
      providersUsed: providersUsed.slice(0, 20).map((p) => String(p).slice(0, 100)),
      jobs: jobs.slice(0, 100),
      apiCallsLogged: Math.max(0, meta.apiCallsLogged),
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  } catch (err) {
    console.warn("Firestore searchCache write failed:", err);
  }
}

export async function getCacheStats(actor?: FirestoreActor) {
  if (!actor?.uid) {
    return {
      entries: 0,
      apiCallsLogged: 0,
      ttlMinutes: CACHE_TTL_MS / 60000,
    };
  }
  try {
    const docs = await actorListCollection(`users/${actor.uid}/searchCache`, actor);
    const now = Date.now();
    const active = docs.filter((d) => typeof d.expiresAt === "number" && d.expiresAt > now);
    const apiCallsLogged = docs.reduce(
      (sum, d) => sum + (typeof d.apiCallsLogged === "number" ? d.apiCallsLogged : 0),
      0
    );
    return {
      entries: active.length,
      apiCallsLogged,
      ttlMinutes: CACHE_TTL_MS / 60000,
    };
  } catch {
    return {
      entries: 0,
      apiCallsLogged: 0,
      ttlMinutes: CACHE_TTL_MS / 60000,
    };
  }
}

export function stripHtml(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const KNOWN_SKILLS = [
  "AutoCAD",
  "Civil 3D",
  "Revit",
  "Blender",
  "Illustrator",
  "Photoshop",
  "InDesign",
  "Figma",
  "SketchUp",
  "Vector Design",
  "Print Production",
  "Screen Printing",
  "Pre-Press",
  "Signage",
  "3D Modeling",
  "Rendering",
  "Bluebeam",
  "Customer Support",
  "POS Systems",
  "Inventory",
  "Graphic Design",
  "Typography",
  "Layout",
  "CAD Drafting",
  "UI/UX",
  "Motion Graphics",
  "React",
  "TypeScript",
  "Python",
];

function extractSkills(title: string, description: string, rawTags?: string[]): string[] {
  const combined = `${title} ${description}`.toLowerCase();
  const matched = KNOWN_SKILLS.filter((skill) => combined.includes(skill.toLowerCase()));
  const extras = (rawTags || [])
    .map((t) => String(t).trim())
    .filter((t) => t.length > 1 && t.length < 28);
  const unique = Array.from(new Set([...matched, ...extras]));
  if (unique.length === 0) {
    return ["Communication", "Digital Workflows", "Production Support"];
  }
  return unique.slice(0, 6);
}

function classifyLaneAndScores(
  title: string,
  description: string,
  location: string,
  salaryText: string,
  remoteType: "onsite" | "hybrid" | "remote"
): { lane: string; scores: NormalizedJobListing["scores"] } {
  const text = `${title} ${description}`.toLowerCase();

  let lane = "Lane A — Fast money / lower THC-risk";
  if (
    /print|apparel|screen\s*print|sign\s*shop|pre-?press|illustrator|graphic\s*design|indesign|vinyl|branding/.test(
      text
    )
  ) {
    lane = "Lane B — Creative production";
  } else if (/autocad|cad\b|draft|revit|civil\s*3d|bluebeam|space\s*plan|exhibit|interior\s*design|floor\s*plan/.test(text)) {
    lane = "Lane D — CAD-adjacent but not engineering-heavy";
  } else if (/blender|3d|render|unreal|unity|motion|ai\s*visual|mockup|cinema\s*4d|product\s*visual/.test(text)) {
    lane = "Lane C — Creative tech / 3D / AI";
  }

  // THC-safety risk score (higher score = safer / lower testing risk for Jaime)
  let thcRisk = 4;
  if (/cdl|dot\s*drug|random\s*drug|forklift|heavy\s*machinery|company\s*vehicle|safety-sensitive|federal\s*clearance/.test(text)) {
    thcRisk = 1;
  } else if (/pre-?employment\s*drug|background\s*and\s*drug|warehouse\s*equipment/.test(text)) {
    thcRisk = 2;
  } else if (/dispensary|cannabis|remote|creative|studio|design|print\s*shop/.test(text)) {
    thcRisk = 5;
  }

  // Stress resilience (higher = calmer, lower drama)
  let stress = remoteType === "remote" ? 4 : 3;
  if (/high-volume\s*call|mandatory\s*overtime|60\s*hours|fast-paced\s*warehouse|cold\s*call/.test(text)) {
    stress = 2;
  } else if (/flexible|async|studio|creative|part-time|independent/.test(text)) {
    stress = 4;
  }

  // Creative score
  const creative =
    lane.startsWith("Lane B") || lane.startsWith("Lane C")
      ? 5
      : lane.startsWith("Lane D")
      ? 4
      : 2;

  // Money score heuristic
  let money = 3;
  const numbers = salaryText.match(/\d[\d,]*/g)?.map((n) => Number(n.replace(/,/g, ""))) || [];
  const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
  if (maxNum > 0) {
    const annual = maxNum < 200 ? maxNum * 2080 : maxNum;
    if (annual >= 65000) money = 5;
    else if (annual >= 48000) money = 4;
    else if (annual >= 36000) money = 3;
    else money = 2;
  }

  const skill = lane.startsWith("Lane D") || lane.startsWith("Lane C") ? 4 : 3;
  const future = lane.startsWith("Lane C") || lane.startsWith("Lane D") ? 5 : lane.startsWith("Lane B") ? 4 : 3;

  return {
    lane,
    scores: { money, creative, thcRisk, stress, skill, future },
  };
}

function summarizeText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Live job listing imported from external aggregator.";
  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || clean;
  return firstSentence.length > 165 ? firstSentence.slice(0, 162) + "..." : firstSentence;
}

function columbusJitterCoords(seedStr: string): { latitude: number; longitude: number } {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const latOffset = ((hash % 1000) / 1000 - 0.5) * 0.14;
  const lngOffset = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.16;
  return {
    latitude: Number((39.9612 + latOffset).toFixed(4)),
    longitude: Number((-82.9988 + lngOffset).toFixed(4)),
  };
}

function formatSalaryRange(min?: number | null, max?: number | null, period?: string | null): string {
  if (!min && !max) return "Compensation listed on source";
  const fmt = (val: number) => (val < 200 ? `$${val.toFixed(2)}` : `$${Math.round(val).toLocaleString()}`);
  const unit = period
    ? ` / ${period.toLowerCase().replace("hour", "hr").replace("year", "yr")}`
    : (min || max || 0) < 200
    ? " / hr"
    : " / yr";
  if (min && max && min !== max) return `${fmt(min)} - ${fmt(max)}${unit}`;
  return `${fmt((min || max) as number)}${unit}`;
}

function detectExperienceLevel(title: string, desc: string): string {
  const combined = `${title} ${desc}`.toLowerCase();
  if (/senior|lead|principal|staff|5\+\s*years/.test(combined)) return "Senior / Experienced";
  if (/mid|2\+\s*years|3\+\s*years|intermediate/.test(combined)) return "Mid-level (1-3+ yrs)";
  if (/entry|junior|intern|apprentice|assistant|associate/.test(combined)) return "Entry-level Welcome";
  return "Open Experience";
}

function buildNormalizedJob(params: {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  description: string;
  remoteHint?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  applyUrl?: string;
  source: string;
  postedAt?: string;
  tags?: string[];
}): NormalizedJobListing {
  const cleanDesc = stripHtml(params.description) || "Full job details available on the employer's listing page.";
  const loc = params.location?.trim() || (params.remoteHint ? "Remote" : "");
  const lowerLoc = loc.toLowerCase();
  const lowerTitle = params.title.toLowerCase();

  let remoteType: "onsite" | "hybrid" | "remote" = "onsite";
  if (params.remoteHint || lowerLoc.includes("remote") || lowerTitle.includes("remote")) {
    remoteType = "remote";
  } else if (lowerLoc.includes("hybrid") || cleanDesc.toLowerCase().includes("hybrid")) {
    remoteType = "hybrid";
  }

  const salary = params.salary?.trim() || "Compensation listed on source";
  const { lane, scores } = classifyLaneAndScores(params.title, cleanDesc, loc, salary, remoteType);

  return {
    id: params.id,
    title: params.title.trim() || "Untitled Role",
    company: params.company.trim() || "Employer",
    location: loc,
    salary,
    experienceLevel: detectExperienceLevel(params.title, cleanDesc),
    skills: extractSkills(params.title, cleanDesc, params.tags),
    summary: summarizeText(cleanDesc),
    description: cleanDesc.slice(0, 2800),
    lane,
    scores,
    latitude: typeof params.latitude === "number" && Number.isFinite(params.latitude) ? params.latitude : undefined,
    longitude: typeof params.longitude === "number" && Number.isFinite(params.longitude) ? params.longitude : undefined,
    remoteType,
    applyUrl: params.applyUrl,
    source: params.source,
    postedAt: params.postedAt,
  };
}

// ======================== PROVIDER STATUS ========================

export function getJobSourcesStatus(): JobSourceStatus[] {
  const hasJSearch = Boolean(process.env.RAPIDAPI_KEY && !process.env.RAPIDAPI_KEY.includes("MY_"));
  const hasAdzuna = Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  const hasJooble = Boolean(process.env.JOOBLE_API_KEY);
  const hasUsaJobs = Boolean(process.env.USAJOBS_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY");

  return [
    {
      id: "auto",
      name: "Auto Multi-Feed",
      category: "Aggregator",
      requiresKey: false,
      configured: true,
      description: "Queries configured aggregators first, then live no-auth feeds (Remotive, Jobicy, Himalayas, Arbeitnow).",
    },
    {
      id: "remotive",
      name: "Remotive",
      category: "Niche Free",
      requiresKey: false,
      configured: true,
      description: "Free public JSON endpoint for active remote design, tech, and support jobs.",
    },
    {
      id: "arbeitnow",
      name: "Arbeitnow",
      category: "Niche Free",
      requiresKey: false,
      configured: true,
      description: "Free JSON job feed featuring remote-friendly and creative/tech roles.",
    },
    {
      id: "jsearch",
      name: "JSearch (RapidAPI)",
      category: "Aggregator",
      requiresKey: true,
      configured: hasJSearch,
      description: "Live Google for Jobs data (Indeed, LinkedIn, Glassdoor, ZipRecruiter) via RAPIDAPI_KEY.",
    },
    {
      id: "adzuna",
      name: "Adzuna US",
      category: "Aggregator",
      requiresKey: true,
      configured: hasAdzuna,
      description: "Local Columbus, OH listings with salary ranges via ADZUNA_APP_ID & ADZUNA_APP_KEY.",
    },
    {
      id: "jooble",
      name: "Jooble",
      category: "Aggregator",
      requiresKey: true,
      configured: hasJooble,
      description: "High-volume job board backfill via JOOBLE_API_KEY.",
    },
    {
      id: "usajobs",
      name: "USAJOBS",
      category: "Aggregator",
      requiresKey: true,
      configured: hasUsaJobs,
      description: "Official U.S. federal openings in Ohio via USAJOBS_API_KEY.",
    },
    {
      id: "ai_scan",
      name: "AI Market Scan",
      category: "AI Fallback",
      requiresKey: true,
      configured: hasGemini,
      description: "Gemini-synthesized Columbus niche roles for hyper-local trades & print shops.",
    },
  ];
}

// ======================== INDIVIDUAL PROVIDER FETCHERS ========================

async function fetchFromJSearch(query: string, location: string, remoteOnly: boolean, overrides: UserKeyOverrides = {}): Promise<NormalizedJobListing[]> {
  const key = process.env.RAPIDAPI_KEY || overrides.jsearch;
  if (!key) return [];

  const q = remoteOnly ? `${query} remote` : `${query} in ${location}`;
  const url = new URL("https://jsearch.p.rapidapi.com/search");
  url.searchParams.set("query", q);
  url.searchParams.set("page", "1");
  url.searchParams.set("num_pages", "1");
  if (remoteOnly) url.searchParams.set("remote_jobs_only", "true");

  const res = await fetch(url.toString(), {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    },
    signal: AbortSignal.timeout(8500),
  });

  if (!res.ok) throw new Error(`JSearch HTTP ${res.status}`);
  const payload = (await res.json()) as { data?: any[] };
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items.slice(0, 12).map((item) =>
    buildNormalizedJob({
      id: `jsearch-${item.job_id || Math.random().toString(36).slice(2)}`,
      title: item.job_title || "Untitled Position",
      company: item.employer_name || "Employer",
      location:
        item.job_city && item.job_state
          ? `${item.job_city}, ${item.job_state}`
          : item.job_is_remote
          ? "Remote (US)"
          : location,
      salary: formatSalaryRange(item.job_min_salary, item.job_max_salary, item.job_salary_period),
      description: item.job_description || "",
      remoteHint: Boolean(item.job_is_remote),
      latitude: item.job_latitude,
      longitude: item.job_longitude,
      applyUrl: item.job_apply_link || item.job_google_link,
      source: "JSearch (Google for Jobs)",
      postedAt: item.job_posted_at_datetime_utc,
      tags: Array.isArray(item.job_required_skills) ? item.job_required_skills : undefined,
    })
  );
}

async function fetchFromAdzuna(query: string, location: string, overrides: UserKeyOverrides = {}): Promise<NormalizedJobListing[]> {
  const appId = process.env.ADZUNA_APP_ID || overrides.adzunaId;
  const appKey = process.env.ADZUNA_APP_KEY || overrides.adzunaKey;
  if (!appId || !appKey) return [];

  const url = new URL("https://api.adzuna.com/v1/api/jobs/us/search/1");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "12");
  url.searchParams.set("what", query);
  url.searchParams.set("where", location);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8500) });
  if (!res.ok) throw new Error(`Adzuna HTTP ${res.status}`);
  const payload = (await res.json()) as { results?: any[] };
  const items = Array.isArray(payload?.results) ? payload.results : [];

  return items.map((item) =>
    buildNormalizedJob({
      id: `adzuna-${item.id || Math.random().toString(36).slice(2)}`,
      title: item.title || "Untitled Position",
      company: item.company?.display_name || "Columbus Employer",
      location: item.location?.display_name || location,
      salary: formatSalaryRange(item.salary_min, item.salary_max, "yr"),
      description: item.description || "",
      latitude: item.latitude,
      longitude: item.longitude,
      applyUrl: item.redirect_url,
      source: "Adzuna US",
      postedAt: item.created,
      tags: item.category?.label ? [item.category.label] : undefined,
    })
  );
}

async function fetchFromJooble(query: string, location: string, overrides: UserKeyOverrides = {}): Promise<NormalizedJobListing[]> {
  const key = process.env.JOOBLE_API_KEY || overrides.jooble;
  if (!key) return [];

  const res = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: query, location }),
    signal: AbortSignal.timeout(8500),
  });

  if (!res.ok) throw new Error(`Jooble HTTP ${res.status}`);
  const payload = (await res.json()) as { jobs?: any[] };
  const items = Array.isArray(payload?.jobs) ? payload.jobs : [];

  return items.slice(0, 12).map((item) =>
    buildNormalizedJob({
      id: `jooble-${item.id || Math.random().toString(36).slice(2)}`,
      title: item.title || "Untitled Position",
      company: item.company || "Employer",
      location: item.location || location,
      salary: item.salary || "Compensation listed on source",
      description: item.snippet || "",
      applyUrl: item.link,
      source: "Jooble",
      postedAt: item.updated,
    })
  );
}

async function fetchFromUsaJobs(query: string, location: string, overrides: UserKeyOverrides = {}): Promise<NormalizedJobListing[]> {
  const key = process.env.USAJOBS_API_KEY || overrides.usajobs;
  if (!key) return [];

  const url = new URL("https://data.usajobs.gov/api/search");
  url.searchParams.set("Keyword", query);
  url.searchParams.set("LocationName", location);
  url.searchParams.set("ResultsPerPage", "10");

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization-Key": key,
      "User-Agent": process.env.USAJOBS_USER_AGENT || overrides.usajobsEmail || "career-builder@localhost",
    },
    signal: AbortSignal.timeout(8500),
  });

  if (!res.ok) throw new Error(`USAJOBS HTTP ${res.status}`);
  const payload = (await res.json()) as any;
  const items = payload?.SearchResult?.SearchResultItems || [];

  return items.map((entry: any) => {
    const desc = entry.MatchedObjectDescriptor || {};
    const remun = desc.PositionRemuneration?.[0];
    const salary = remun
      ? formatSalaryRange(Number(remun.MinimumRange), Number(remun.MaximumRange), remun.RateIntervalCode)
      : "Federal GS Scale";
    return buildNormalizedJob({
      id: `usajobs-${entry.MatchedObjectId || Math.random().toString(36).slice(2)}`,
      title: desc.PositionTitle || "Federal Role",
      company: desc.OrganizationName || "U.S. Government",
      location: desc.PositionLocationDisplay || location,
      salary,
      description: desc.UserArea?.Details?.JobSummary || desc.QualificationSummary || "",
      applyUrl: desc.ApplyURI?.[0] || desc.PositionURI,
      source: "USAJOBS",
      postedAt: desc.PublicationStartDate,
    });
  });
}

function scoreKeywordOverlap(query: string, haystack: string): number {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return 1;
  const lower = haystack.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (lower.includes(t)) hits++;
  }
  return hits;
}

async function fetchFromRemotive(query: string): Promise<NormalizedJobListing[]> {
  const url = new URL("https://remotive.com/api/remote-jobs");
  // Remotive works best with 1-2 core keywords rather than long multi-word strings
  const primaryKeyword = query.trim().split(/\s+/).slice(0, 2).join(" ");
  if (primaryKeyword) {
    url.searchParams.set("search", primaryKeyword);
  }
  url.searchParams.set("limit", "15");

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8500), headers: LIVE_FEED_HEADERS });
  if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
  const payload = (await res.json()) as { jobs?: any[] };
  let items = Array.isArray(payload?.jobs) ? payload.jobs : [];

  // If ultra-specific Columbus query yields 0 on Remotive, fetch top recent creative/support remote roles
  if (items.length === 0) {
    const fallbackRes = await fetch("https://remotive.com/api/remote-jobs?limit=12", {
      signal: AbortSignal.timeout(8500),
      headers: LIVE_FEED_HEADERS,
    });
    if (fallbackRes.ok) {
      const fbPayload = (await fallbackRes.json()) as { jobs?: any[] };
      items = Array.isArray(fbPayload?.jobs) ? fbPayload.jobs : [];
    }
  }

  return items.slice(0, 12).map((item) =>
    buildNormalizedJob({
      id: `remotive-${item.id}`,
      title: item.title || "Remote Position",
      company: item.company_name || "Remote Employer",
      location: item.candidate_required_location ? `Remote (${item.candidate_required_location})` : "Remote",
      salary: item.salary || "Compensation listed on source",
      description: item.description || "",
      remoteHint: true,
      applyUrl: item.url,
      source: "Remotive",
      postedAt: item.publication_date,
      tags: Array.isArray(item.tags) ? item.tags : item.category ? [item.category] : undefined,
    })
  );
}

async function fetchFromJobicy(query: string): Promise<NormalizedJobListing[]> {
  const url = new URL("https://jobicy.com/api/v2/remote-jobs");
  url.searchParams.set("count", "50");
  const primaryKeyword = query.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();
  if (primaryKeyword) {
    url.searchParams.set("tag", primaryKeyword);
  }

  let items: any[] = [];
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8500), headers: LIVE_FEED_HEADERS });
  if (res.ok) {
    const payload = (await res.json()) as { jobs?: any[] };
    items = Array.isArray(payload?.jobs) ? payload.jobs : [];
  }

  // Tag search can be too narrow on niche keywords; fall back to the full feed and rank.
  if (items.length < 4) {
    const fallbackRes = await fetch("https://jobicy.com/api/v2/remote-jobs?count=50", {
      signal: AbortSignal.timeout(8500),
      headers: LIVE_FEED_HEADERS,
    });
    if (fallbackRes.ok) {
      const fbPayload = (await fallbackRes.json()) as { jobs?: any[] };
      const fbItems = Array.isArray(fbPayload?.jobs) ? fbPayload.jobs : [];
      items = fbItems
        .map((item: any) => ({
          item,
          score: scoreKeywordOverlap(query, `${item.jobTitle || ""} ${item.jobExcerpt || ""} ${(item.jobIndustry || []).join(" ")}`),
        }))
        .sort((a: any, b: any) => b.score - a.score)
        .map((r: any) => r.item);
    }
  }

  return items.slice(0, 12).map((item) =>
    buildNormalizedJob({
      id: `jobicy-${item.id || Math.random().toString(36).slice(2)}`,
      title: item.jobTitle || "Remote Position",
      company: item.companyName || "Remote Employer",
      location: item.jobGeo ? `Remote (${item.jobGeo})` : "Remote",
      salary: "Compensation listed on source",
      description: item.jobDescription || item.jobExcerpt || "",
      remoteHint: true,
      applyUrl: item.url,
      source: "Jobicy",
      postedAt: item.pubDate,
      tags: Array.isArray(item.jobIndustry) ? item.jobIndustry : Array.isArray(item.jobType) ? item.jobType : undefined,
    })
  );
}

async function fetchFromHimalayas(query: string): Promise<NormalizedJobListing[]> {
  const res = await fetch("https://himalayas.app/jobs/api?limit=50", {
    signal: AbortSignal.timeout(8500),
    headers: LIVE_FEED_HEADERS,
  });
  if (!res.ok) throw new Error(`Himalayas HTTP ${res.status}`);
  const payload = (await res.json()) as { jobs?: any[] };
  const items = Array.isArray(payload?.jobs) ? payload.jobs : [];

  const ranked = items
    .map((item) => ({
      item,
      score: scoreKeywordOverlap(
        query,
        `${item.title || ""} ${item.excerpt || ""} ${(item.categories || []).join(" ")} ${(item.parentCategories || []).join(" ")}`
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((r) => r.item);

  return ranked.map((item) => {
    const salary =
      item.minSalary != null || item.maxSalary != null
        ? formatSalaryRange(item.minSalary, item.maxSalary, item.salaryPeriod || "yr")
        : "Compensation listed on source";
    const locs = Array.isArray(item.locationRestrictions) ? item.locationRestrictions.join(" / ") : "";
    const remoteish = !locs || /remote|anywhere|worldwide/i.test(locs);
    return buildNormalizedJob({
      id: `himalayas-${item.id || Math.random().toString(36).slice(2)}`,
      title: item.title || "Remote Position",
      company: item.companyName || "Remote Employer",
      location: remoteish ? "Remote" : locs,
      salary,
      description: item.description || item.excerpt || "",
      remoteHint: remoteish,
      applyUrl: item.applicationLink || item.guid || (item.companySlug ? `https://himalayas.app/companies/${item.companySlug}` : undefined),
      source: "Himalayas",
      postedAt: item.pubDate,
      tags: Array.isArray(item.categories) ? item.categories.slice(0, 4) : undefined,
    });
  });
}

async function fetchFromArbeitnow(query: string): Promise<NormalizedJobListing[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
    signal: AbortSignal.timeout(8500),
    headers: LIVE_FEED_HEADERS,
  });
  if (!res.ok) throw new Error(`Arbeitnow HTTP ${res.status}`);
  const payload = (await res.json()) as { data?: any[] };
  const items = Array.isArray(payload?.data) ? payload.data : [];

  const ranked = items
    .filter((item) => item.remote || scoreKeywordOverlap(query, `${item.title} ${item.description}`) > 0)
    .map((item) => ({
      item,
      score: scoreKeywordOverlap(query, `${item.title} ${item.description} ${(item.tags || []).join(" ")}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((r) => r.item);

  return ranked.map((item) =>
    buildNormalizedJob({
      id: `arbeitnow-${item.slug || Math.random().toString(36).slice(2)}`,
      title: item.title || "Role",
      company: item.company_name || "Employer",
      location: item.remote ? `Remote (${item.location || "Global"})` : item.location || "Remote",
      description: item.description || "",
      remoteHint: Boolean(item.remote),
      applyUrl: item.url,
      source: "Arbeitnow",
      postedAt: item.created_at ? new Date(item.created_at * 1000).toISOString() : undefined,
      tags: Array.isArray(item.tags) ? item.tags : undefined,
    })
  );
}

// ======================== ATS PUBLIC BOARD FETCHERS ========================

export async function fetchAtsBoardJobs(
  provider: "greenhouse" | "lever" | "ashby",
  boardSlug: string,
  query?: string,
  actor?: FirestoreActor
): Promise<NormalizedJobListing[]> {
  const slug = boardSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
  if (!slug) throw new Error("A valid company board slug is required (e.g., figma, vercel, discord).");

  const cacheKey = `ats:${provider}:${slug}:${(query || "").toLowerCase()}`;
  const cached = await getCached(actor, cacheKey);
  if (cached) return cached.jobs;

  let jobs: NormalizedJobListing[] = [];

  if (provider === "greenhouse") {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {
      signal: AbortSignal.timeout(8500),
    });
    if (!res.ok) throw new Error(`Greenhouse board "${slug}" returned status ${res.status}`);
    const payload = (await res.json()) as { jobs?: any[] };
    const items = Array.isArray(payload?.jobs) ? payload.jobs : [];
    jobs = items.map((item) =>
      buildNormalizedJob({
        id: `gh-${slug}-${item.id}`,
        title: item.title || "Open Role",
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: item.location?.name || "See Listing",
        description: item.content || "",
        applyUrl: item.absolute_url,
        source: `Greenhouse (${slug})`,
        postedAt: item.updated_at,
        tags: Array.isArray(item.departments) ? item.departments.map((d: any) => d.name) : undefined,
      })
    );
  } else if (provider === "lever") {
    const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
      signal: AbortSignal.timeout(8500),
    });
    if (!res.ok) throw new Error(`Lever board "${slug}" returned status ${res.status}`);
    const items = (await res.json()) as any[];
    jobs = (Array.isArray(items) ? items : []).map((item) =>
      buildNormalizedJob({
        id: `lever-${slug}-${item.id}`,
        title: item.text || "Open Role",
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: item.categories?.location || "See Listing",
        description: item.descriptionPlain || item.description || "",
        remoteHint: item.workplaceType === "remote",
        applyUrl: item.hostedUrl || item.applyUrl,
        source: `Lever (${slug})`,
        postedAt: item.createdAt ? new Date(item.createdAt).toISOString() : undefined,
        tags: [item.categories?.team, item.categories?.department].filter(Boolean),
      })
    );
  } else if (provider === "ashby") {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
      signal: AbortSignal.timeout(8500),
    });
    if (!res.ok) throw new Error(`Ashby board "${slug}" returned status ${res.status}`);
    const payload = (await res.json()) as { jobs?: any[] };
    const items = Array.isArray(payload?.jobs) ? payload.jobs : [];
    jobs = items.map((item) =>
      buildNormalizedJob({
        id: `ashby-${slug}-${item.id || Math.random().toString(36).slice(2)}`,
        title: item.title || "Open Role",
        company: slug.charAt(0).toUpperCase() + slug.slice(1),
        location: item.location || (item.isRemote ? "Remote" : "See Listing"),
        description: item.descriptionPlain || item.descriptionHtml || "",
        remoteHint: Boolean(item.isRemote),
        applyUrl: item.jobUrl || item.applyUrl,
        source: `Ashby (${slug})`,
        postedAt: item.publishedAt,
        tags: item.department ? [item.department] : undefined,
      })
    );
  }

  if (query && query.trim()) {
    const q = query.trim();
    const filtered = jobs.filter((j) => scoreKeywordOverlap(q, `${j.title} ${j.description} ${j.skills.join(" ")}`) > 0);
    if (filtered.length > 0) jobs = filtered;
  }

  jobs = jobs.slice(0, 20);
  await setCached(
    actor,
    cacheKey,
    { query: query || slug, location: "Remote / Company Board", source: `${provider}:${slug}`, remoteOnly: false, apiCallsLogged: 1 },
    jobs,
    [`${provider}:${slug}`]
  );
  return jobs;
}

// Minimal real request for a keyed job source; throws on failure.
export async function testJobSourceProvider(
  service: string,
  overrides: UserKeyOverrides = {}
): Promise<string> {
  switch (service) {
    case "jsearch": {
      const jobs = await fetchFromJSearch("design", "Columbus, OH", false, overrides);
      return `Connected - ${jobs.length} live listings returned.`;
    }
    case "adzuna": {
      const jobs = await fetchFromAdzuna("drafting", "Columbus, OH", overrides);
      return `Connected - ${jobs.length} live listings returned.`;
    }
    case "jooble": {
      const jobs = await fetchFromJooble("design", "Columbus, OH", overrides);
      return `Connected - ${jobs.length} live listings returned.`;
    }
    case "usajobs": {
      const jobs = await fetchFromUsaJobs("drafting", "Columbus, OH", overrides);
      return `Connected - ${jobs.length} live listings returned.`;
    }
    default:
      return "Key stored. Live testing isn't wired for this service yet.";
  }
}

// ======================== UNIFIED SEARCH ORCHESTRATOR ========================

export async function searchLiveJobProviders(
  params: {
    query: string;
    location?: string;
    source?: string;
    remoteOnly?: boolean;
  },
  actor?: FirestoreActor
): Promise<{
  jobs: NormalizedJobListing[];
  providersUsed: string[];
  cached: boolean;
  errors: string[];
}> {
  const query = (params.query || "creative design support").trim();
  const location = (params.location || "Columbus, OH").trim();
  const source = (params.source || "auto").toLowerCase();
  const remoteOnly = Boolean(params.remoteOnly);
  const overrides = await loadUserKeyOverrides(actor);
  const hasOverride = (o: string | undefined) => Boolean(o && o.length > 0);

  const cacheKey = `${source}:${query.toLowerCase()}:${location.toLowerCase()}:${remoteOnly}`;
  const cached = await getCached(actor, cacheKey);
  if (cached) {
    return {
      jobs: cached.jobs,
      providersUsed: cached.providersUsed,
      cached: true,
      errors: [],
    };
  }

  const providersUsed: string[] = [];
  const errors: string[] = [];
  let combined: NormalizedJobListing[] = [];
  let apiCallsMade = 0;

  const runProvider = async (name: string, fn: () => Promise<NormalizedJobListing[]>) => {
    apiCallsMade += 1;
    try {
      const results = await fn();
      if (results.length > 0) {
        providersUsed.push(name);
        combined.push(...results);
      }
    } catch (err: any) {
      errors.push(`${name}: ${err?.message || "request failed"}`);
    }
  };

  if (source === "jsearch") {
    if (!process.env.RAPIDAPI_KEY && !hasOverride(overrides.jsearch)) {
      throw new Error("JSearch key is not configured - add RAPIDAPI_KEY in .env or save it in Settings.");
    }
    await runProvider("JSearch", () => fetchFromJSearch(query, location, remoteOnly, overrides));
  } else if (source === "adzuna") {
    if ((!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) && !(hasOverride(overrides.adzunaId) && hasOverride(overrides.adzunaKey))) {
      throw new Error("Adzuna credentials are not configured - add them in .env or save them in Settings.");
    }
    await runProvider("Adzuna", () => fetchFromAdzuna(query, location, overrides));
  } else if (source === "jooble") {
    if (!process.env.JOOBLE_API_KEY && !hasOverride(overrides.jooble)) {
      throw new Error("Jooble key is not configured - add JOOBLE_API_KEY in .env or save it in Settings.");
    }
    await runProvider("Jooble", () => fetchFromJooble(query, location, overrides));
  } else if (source === "usajobs") {
    if (!process.env.USAJOBS_API_KEY && !hasOverride(overrides.usajobs)) {
      throw new Error("USAJOBS key is not configured - add USAJOBS_API_KEY in .env or save it in Settings.");
    }
    await runProvider("USAJOBS", () => fetchFromUsaJobs(query, location, overrides));
  } else if (source === "remotive") {
    await runProvider("Remotive", () => fetchFromRemotive(query));
  } else if (source === "jobicy") {
    await runProvider("Jobicy", () => fetchFromJobicy(query));
  } else if (source === "himalayas") {
    await runProvider("Himalayas", () => fetchFromHimalayas(query));
  } else if (source === "arbeitnow") {
    await runProvider("Arbeitnow", () => fetchFromArbeitnow(query));
  } else {
    // "auto": Try configured keyed aggregators in parallel + free live feeds
    const tasks: Promise<void>[] = [];
    if ((process.env.RAPIDAPI_KEY && !process.env.RAPIDAPI_KEY.includes("MY_")) || hasOverride(overrides.jsearch)) {
      tasks.push(runProvider("JSearch", () => fetchFromJSearch(query, location, remoteOnly, overrides)));
    }
    if ((process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) || (hasOverride(overrides.adzunaId) && hasOverride(overrides.adzunaKey))) {
      tasks.push(runProvider("Adzuna", () => fetchFromAdzuna(query, location, overrides)));
    }
    if (process.env.JOOBLE_API_KEY || hasOverride(overrides.jooble)) {
      tasks.push(runProvider("Jooble", () => fetchFromJooble(query, location, overrides)));
    }
    if (process.env.USAJOBS_API_KEY || hasOverride(overrides.usajobs)) {
      tasks.push(runProvider("USAJOBS", () => fetchFromUsaJobs(query, location, overrides)));
    }

    // Always include zero-auth live feeds so Auto works out of the box
    tasks.push(runProvider("Jobicy", () => fetchFromJobicy(query)));
    tasks.push(runProvider("Himalayas", () => fetchFromHimalayas(query)));
    tasks.push(runProvider("Remotive", () => fetchFromRemotive(query)));

    await Promise.all(tasks);

    // If still sparse, also pull Arbeitnow
    if (combined.length < 4) {
      await runProvider("Arbeitnow", () => fetchFromArbeitnow(query));
    }
  }

  // Deduplicate by lowercase title + company
  const seen = new Set<string>();
  const deduped: NormalizedJobListing[] = [];
  for (const job of combined) {
    const key = `${job.title.toLowerCase()}::${job.company.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(job);
    }
  }

  const finalJobs = deduped.slice(0, 15);
  if (finalJobs.length > 0) {
    await setCached(
      actor,
      cacheKey,
      { query, location, source, remoteOnly, apiCallsLogged: apiCallsMade },
      finalJobs,
      providersUsed
    );
  }

  return {
    jobs: finalJobs,
    providersUsed,
    cached: false,
    errors,
  };
}
