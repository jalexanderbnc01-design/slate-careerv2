import { JobFixture } from "../types";
import { authFetch } from "../firebase/client";

export interface JobSourceOption {
  id: string;
  name: string;
  category: "Aggregator" | "ATS" | "Niche Free" | "AI Fallback";
  requiresKey: boolean;
  configured: boolean;
  description: string;
}

export interface LiveJobSearchResponse {
  jobs: JobFixture[];
  meta: {
    providersUsed: string[];
    cached: boolean;
    errors?: string[];
    fallbackUsed?: boolean;
  };
}

function normalizeClientJobs(rawList: any[]): JobFixture[] {
  return rawList.map((job: any) => {
    const scores = job.scores || {
      money: 3,
      creative: 3,
      thcRisk: 4,
      stress: 4,
      skill: 3,
      future: 3,
    };

    const latitude = typeof job.latitude === "number" && Number.isFinite(job.latitude) ? job.latitude : undefined;
    const longitude = typeof job.longitude === "number" && Number.isFinite(job.longitude) ? job.longitude : undefined;

    let laneStr = job.lane;
    if (!laneStr) {
      const titleL = (job.title || "").toLowerCase();
      const descL = (job.description || "").toLowerCase();

      if (titleL.includes("print") || titleL.includes("apparel") || titleL.includes("sign") || descL.includes("vector")) {
        laneStr = "Lane B — Creative production";
      } else if (titleL.includes("cad") || titleL.includes("draft") || titleL.includes("autocad")) {
        laneStr = "Lane D — CAD-adjacent but not engineering-heavy";
      } else if (titleL.includes("3d") || titleL.includes("blender") || titleL.includes("render")) {
        laneStr = "Lane C — Creative tech / 3D / AI";
      } else {
        laneStr = "Lane A — Fast money / lower THC-risk";
      }
    }

    const cleanLoc = typeof job.location === "string" ? job.location.trim() : "";

    return {
      id: job.id || `col-agg-${Math.random().toString(36).slice(2, 11)}`,
      title: job.title || "Untitled Position",
      company: job.company || "Employer",
      location: cleanLoc,
      salary: job.salary || "Compensation listed on source",
      experienceLevel: job.experienceLevel || "Entry-level Welcome",
      skills: Array.isArray(job.skills) ? job.skills : ["Customer Support"],
      summary: job.summary || "No quick snapshot description was provided.",
      description: job.description || "Detailed job specification elements are available on the source listing.",
      lane: laneStr,
      scores,
      latitude,
      longitude,
      remoteType: job.remoteType || (cleanLoc.toLowerCase().includes("remote") ? "remote" : "onsite"),
      applyUrl: job.applyUrl,
      source: job.source || "Live Aggregator",
      postedAt: job.postedAt,
    };
  });
}

/**
 * Fetches available job aggregator sources & configuration status from the Express backend.
 */
export async function fetchJobSourcesStatus(): Promise<{ sources: JobSourceOption[]; cacheEntries: number }> {
  const response = await authFetch("/api/job-sources");
  if (!response.ok) {
    throw new Error(`Failed to load job source status (${response.status})`);
  }
  const data = await response.json();
  return {
    sources: Array.isArray(data?.sources) ? data.sources : [],
    cacheEntries: data?.cache?.entries ?? 0,
  };
}

/**
 * Searches the live Job Aggregator (backed by real external APIs: JSearch, Adzuna, Jooble, USAJOBS,
 * Remotive, The Muse, Arbeitnow + Gemini fallback) via the Express proxy.
 */
export async function fetchLiveJobsFromAggregator(
  query: string,
  options?: { source?: string; location?: string; remoteOnly?: boolean }
): Promise<LiveJobSearchResponse> {
  const response = await authFetch("/api/search-jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      source: options?.source || "auto",
      location: options?.location || "Columbus, OH",
      remoteOnly: Boolean(options?.remoteOnly),
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `Failed to fetch live job data. Status: ${response.status}`);
  }

  const rawJobs = Array.isArray(payload) ? payload : Array.isArray(payload?.jobs) ? payload.jobs : [];
  return {
    jobs: normalizeClientJobs(rawJobs),
    meta: payload?.meta || { providersUsed: ["Live Feed"], cached: false },
  };
}

/**
 * Queries a company's public ATS job board directly (Greenhouse, Lever, or Ashby).
 */
export async function fetchAtsBoardJobs(
  provider: "greenhouse" | "lever" | "ashby",
  boardSlug: string,
  query?: string
): Promise<LiveJobSearchResponse> {
  const response = await authFetch("/api/ats-jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider, boardSlug, query }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `ATS lookup failed (${response.status})`);
  }

  return {
    jobs: normalizeClientJobs(Array.isArray(payload?.jobs) ? payload.jobs : []),
    meta: payload?.meta || { providersUsed: [`${provider}:${boardSlug}`], cached: false },
  };
}

/**
 * Predefined primary career lane keywords optimized for Jaime Hernandez's
 * specific job requirements in the Central Ohio/Franklin County area.
 */
export const COLUMBUS_TARGET_KEYWORDS = [
  { label: "Lane B (Print & Sign Production Art)", query: "print production graphic designer" },
  { label: "Lane D (CAD & Spatial Drafting)", query: "AutoCAD drafter spatial design" },
  { label: "Lane C (3D Modeling & Blender)", query: "3D designer blender motion" },
  { label: "Lane A (THC-Safe Remote Support)", query: "customer support remote specialist" },
];
