import React, { useState, useEffect } from "react";
import { authFetch } from "../firebase/client";
import { UserProfile } from "../types";
import {
  ClayStatusResponse,
  IngestedCompanyRecord,
  IngestedCompanyStatus,
  IngestedJobLead,
  IngestedLeadStatus,
  addIngestedCompanyToXelime,
  addIngestedLeadToXelime,
  buildClayHttpPayloadTemplate,
  buildClaygentPrompt,
  buildColumbusCompaniesPayloadTemplate,
  buildCompanyClaygentPrompt,
  deleteIngestedCompany,
  deleteIngestedLead,
  getClayStatus,
  pushJobsToClay,
  sendTestCompanyIngest,
  sendTestIngestLead,
  updateClayConfig,
  updateIngestedCompany,
  updateIngestedLead,
} from "../utils/clayClient";
import { createNotionPage, getNotionMappings, getNotionStatus } from "../utils/notionClient";
import {
  RefreshCw,
  Send,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Trash2,
  UserCheck,
  AlertTriangle,
  Database,
  ArrowUpRight,
  Sliders,
  Plus,
  Webhook,
  CheckCircle2,
  Mail,
  Building2,
} from "lucide-react";

type ClaySubView = "companies" | "inbox" | "outbound" | "blueprint" | "logs";

interface ClayIntegrationProps {
  userProfile: UserProfile;
  onLoadToBuilder: (job: {
    title: string;
    company: string;
    location: string;
    description: string;
    style: string;
  }) => void;
  onInstantPacket: (job: {
    title: string;
    company: string;
    location: string;
    description: string;
    style: string;
  }) => void;
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

const LEAD_STATUSES: IngestedLeadStatus[] = [
  "New",
  "Reviewing",
  "Ready to Apply",
  "Applied",
  "Archived",
];

const COMPANY_STATUSES: IngestedCompanyStatus[] = [
  "Prospect",
  "Openings Found",
  "Pitched",
  "Applied",
  "Archived",
];

function inferResumeStyle(title: string, description: string): string {
  const combined = `${title} ${description}`.toLowerCase();
  if (combined.includes("revit") || combined.includes("bim") || combined.includes("architectural")) {
    return "Architectural Drafter / BIM";
  }
  if (combined.includes("remote")) {
    return "Remote CAD";
  }
  if (combined.includes("design assistant")) {
    return "Design Assistant";
  }
  return "CAD Technician";
}

export default function ClayIntegration({
  userProfile,
  onLoadToBuilder,
  onInstantPacket,
  onNotify,
}: ClayIntegrationProps) {
  const [subView, setSubView] = useState<ClaySubView>("companies");
  const [blueprintMode, setBlueprintMode] = useState<"columbus_companies" | "job_pipeline">(
    "columbus_companies"
  );
  const [statusData, setStatusData] = useState<ClayStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Outbound Scraper Push Form
  const [manualCompany, setManualCompany] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDomain, setManualDomain] = useState("");
  const [manualLocation, setManualLocation] = useState("Columbus, OH / Remote");
  const [manualUrl, setManualUrl] = useState("");
  const [manualSalary, setManualSalary] = useState("");
  const [manualDescription, setManualDescription] = useState("");

  // Live Feed -> Clay Batch Push
  const [feedQuery, setFeedQuery] = useState("AutoCAD CAD drafting remote");
  const [feedLocation, setFeedLocation] = useState("Columbus, OH");
  const [feedJobs, setFeedJobs] = useState<any[]>([]);
  const [notionConnected, setNotionConnected] = useState(false);

  const originUrl =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const ingestEndpointUrl = `${originUrl}/api/jobs/ingest`;

  const loadClayStatus = async () => {
    setLoading(true);
    try {
      const data = await getClayStatus();
      setStatusData(data);
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to load Clay status." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClayStatus();
    getNotionStatus()
      .then((s) => setNotionConnected(Boolean(s.connected)))
      .catch(() => setNotionConnected(false));
  }, []);

  const copyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleThresholdChange = async (minMatchScore: number) => {
    setBusyAction("config");
    try {
      await updateClayConfig({ minMatchScore });
      await loadClayStatus();
      setFeedback({
        type: "ok",
        text: `Updated minimum Claygent ingestion score threshold to ${minMatchScore}/10.`,
      });
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to update threshold." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendTestCompany = async () => {
    setBusyAction("test_company");
    setFeedback(null);
    try {
      const res = await sendTestCompanyIngest();
      await loadClayStatus();
      setSubView("companies");
      setFeedback({
        type: "ok",
        text: `Ingested "${res.company?.name}" (${res.leadsCreated || 0} opening lead promoted to Inbox).`,
      });
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Test company ingest failed." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendTestLead = async () => {
    setBusyAction("test_ingest");
    setFeedback(null);
    try {
      const res = await sendTestIngestLead();
      await loadClayStatus();
      setSubView("inbox");
      setFeedback({
        type: "ok",
        text: res.deduplicated
          ? `Updated existing test lead "${res.lead?.title}" via /api/jobs/ingest.`
          : `Ingested qualified test lead "${res.lead?.title}" (${res.lead?.matchScore}/10) into Inbox.`,
      });
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Test ingest failed." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleLeadStatusChange = async (id: string, nextStatus: IngestedLeadStatus) => {
    try {
      await updateIngestedLead(id, { status: nextStatus });
      await loadClayStatus();
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to update lead status." });
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await deleteIngestedLead(id);
      await loadClayStatus();
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to delete lead." });
    }
  };

  const handleCompanyStatusChange = async (
    id: string,
    nextStatus: IngestedCompanyStatus
  ) => {
    try {
      await updateIngestedCompany(id, { status: nextStatus });
      await loadClayStatus();
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to update company status." });
    }
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      await deleteIngestedCompany(id);
      await loadClayStatus();
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to delete company." });
    }
  };

  const handlePushLeadToNotion = async (lead: IngestedJobLead) => {
    setBusyAction(`notion:${lead.id}`);
    setFeedback(null);
    try {
      const { mappings } = await getNotionMappings();
      const appsMapping = mappings.applications;
      if (!appsMapping?.databaseId) {
        throw new Error(
          "No Notion 'Job Applications' database mapping configured yet. Open Notion -> Schema Mapping first."
        );
      }
      await createNotionPage({
        parentDatabaseId: appsMapping.databaseId,
        domain: "applications",
        domainRecord: {
          jobTitle: lead.title,
          company: lead.company,
          jobUrl: lead.applyUrl,
          status: lead.status === "Applied" ? "Applied" : "Qualified",
          remoteEligibility: lead.workArrangement === "Remote",
          ohioEligibility:
            lead.location.toLowerCase().includes("oh") ||
            lead.workArrangement === "Remote",
          salary: lead.salary,
          nextAction: lead.contact.name
            ? `Reach out to ${lead.contact.name} (${lead.contact.email || lead.contact.linkedinUrl || "recruiter"})`
            : "Submit tailored Career Engine application",
        },
        contentParagraphs: [
          `Clay Match Score: ${lead.matchScore}/10`,
          lead.missingSkills.length > 0
            ? `Flagged Gaps: ${lead.missingSkills.join(", ")}`
            : "",
          lead.description.slice(0, 1400),
        ].filter(Boolean),
      });
      setFeedback({
        type: "ok",
        text: `Pushed "${lead.title} @ ${lead.company}" to Notion (${appsMapping.databaseTitle}).`,
      });
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to push lead to Notion." });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePushCompanyToNotion = async (company: IngestedCompanyRecord) => {
    setBusyAction(`notion-co:${company.id}`);
    setFeedback(null);
    try {
      const { mappings } = await getNotionMappings();
      const appsMapping = mappings.applications;
      if (!appsMapping?.databaseId) {
        throw new Error(
          "No Notion 'Job Applications' database mapping configured yet. Open Notion -> Schema Mapping first."
        );
      }
      await createNotionPage({
        parentDatabaseId: appsMapping.databaseId,
        domain: "applications",
        domainRecord: {
          jobTitle: company.jobOpeningsSummary
            ? `CAD / Design Opening (${company.name})`
            : `Direct Studio Outreach (${company.name})`,
          company: company.name,
          jobUrl: company.careersUrl || company.websiteUrl,
          status: company.openingsCount > 0 ? "Qualified" : "Researching",
          ohioEligibility: company.location.toLowerCase().includes("oh"),
          nextAction: company.contact.name
            ? `Contact ${company.contact.name} (${company.contact.email || company.contact.title})`
            : `Review ${company.domain || company.name} openings`,
        },
        contentParagraphs: [
          `Industry: ${company.industry} | Size: ${company.size || "Unknown"}`,
          company.jobOpeningsSummary
            ? `Job Openings: ${company.jobOpeningsSummary}`
            : "",
          company.news ? `News: ${company.news}` : "",
          company.funding ? `Funding: ${company.funding}` : "",
          company.competitors.length > 0
            ? `Competitors: ${company.competitors.join(", ")}`
            : "",
        ].filter(Boolean),
      });
      setFeedback({
        type: "ok",
        text: `Saved "${company.name}" to Notion (${appsMapping.databaseTitle}).`,
      });
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to push company to Notion." });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePushManualToClay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCompany.trim()) return;
    setBusyAction("push_manual");
    setFeedback(null);
    try {
      const res = await pushJobsToClay([
        {
          company: manualCompany.trim(),
          title: manualTitle.trim(),
          domain: manualDomain.trim(),
          location: manualLocation.trim(),
          applyUrl: manualUrl.trim(),
          salary: manualSalary.trim(),
          description: manualDescription.trim(),
          source: "Career Engine Outbound Push",
        },
      ]);
      await loadClayStatus();
      if (res.pushed > 0) {
        setFeedback({
          type: "ok",
          text: `Pushed "${manualCompany}" to Clay Incoming Webhook.`,
        });
        setManualCompany("");
        setManualTitle("");
        setManualDomain("");
        setManualUrl("");
        setManualSalary("");
        setManualDescription("");
      } else {
        setFeedback({
          type: "err",
          text: res.errors[0] || "Clay webhook rejected payload.",
        });
      }
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to push to Clay." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleScanLiveJobs = async () => {
    setBusyAction("scan_live");
    setFeedback(null);
    try {
      const res = await authFetch("/api/search-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: feedQuery,
          location: feedLocation,
          source: "auto",
        }),
      });
      const data = await res.json();
      setFeedJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to scan job feeds." });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePushLiveFeedBatchToClay = async () => {
    if (feedJobs.length === 0) return;
    setBusyAction("push_batch");
    setFeedback(null);
    try {
      const res = await pushJobsToClay(feedJobs.slice(0, 10));
      await loadClayStatus();
      setFeedback({
        type: res.pushed > 0 ? "ok" : "err",
        text: `Pushed ${res.pushed} live feed job(s) to Clay Incoming Webhook (${res.failed} failed).`,
      });
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Failed to push batch to Clay." });
    } finally {
      setBusyAction(null);
    }
  };

  const leads = statusData?.leads || [];
  const companies = statusData?.companies || [];
  const filteredLeads = leads.filter((l) =>
    statusFilter === "all" ? l.status !== "Archived" : l.status === statusFilter
  );

  const claygentJobPrompt = buildClaygentPrompt(userProfile);
  const claygentCompanyPrompt = buildCompanyClaygentPrompt(userProfile);
  const httpJobBodyTemplate = buildClayHttpPayloadTemplate();
  const httpCompanyBodyTemplate = buildColumbusCompaniesPayloadTemplate();

  const nodeScraperSnippet = `// Run externally or via Apify actor to push scraped jobs/companies into Clay
const CLAY_WEBHOOK_URL = process.env.CLAY_WEBHOOK_URL; // From Clay Table -> Incoming Webhook

await fetch(CLAY_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    company: "Ohio Infrastructure Group",
    domain: "ohioinfra.example.com",
    title: "CAD Technical Drafter",
    location: "Columbus, OH (Hybrid)",
    applyUrl: "https://example.com/jobs/cad-drafter",
    description: "AutoCAD Civil 3D permit drawings, utility cross-sections...",
    source: "AEC Job Scraper"
  })
});`;

  return (
    <div className="space-y-5">
      {/* Header & Connection Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Webhook className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">
              Clay Automated Pipeline (Companies &amp; Job Leads)
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              INGEST ACTIVE · SCORE ≥ {statusData?.config.minMatchScore ?? 8}/10
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Works natively with your existing{" "}
            <strong className="text-slate-200">Columbus Design Companies</strong> table (Name, Domain, Industry, Size, Job Openings, News, Funding) AND job-per-row tables at{" "}
            <code className="text-blue-300 font-mono">POST /api/jobs/ingest</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSendTestCompany}
            disabled={busyAction === "test_company"}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>
              {busyAction === "test_company" ? "Sending..." : "Simulate Company Row"}
            </span>
          </button>
          <button
            type="button"
            onClick={handleSendTestLead}
            disabled={busyAction === "test_ingest"}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {busyAction === "test_ingest" ? "Sending..." : "Simulate Job Lead"}
            </span>
          </button>
          <button
            type="button"
            onClick={loadClayStatus}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium rounded-md flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation & Server Secret Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-2">
        <div className="flex flex-wrap gap-1">
          {(
            [
              {
                id: "companies",
                label: `Columbus Design Companies (${companies.filter((c) => c.status !== "Archived").length})`,
              },
              {
                id: "inbox",
                label: `Qualified Job Leads (${leads.filter((l) => l.status !== "Archived").length})`,
              },
              { id: "outbound", label: "Push to Clay Webhook" },
              { id: "blueprint", label: "Clay Column & API Setup" },
              { id: "logs", label: `Activity (${statusData?.events.length || 0})` },
            ] as { id: ClaySubView; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubView(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                subView === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 px-2 text-[11px] font-mono">
          <span className={statusData?.webhookConfigured ? "text-emerald-400" : "text-amber-400"}>
            CLAY_WEBHOOK_URL: {statusData?.webhookConfigured ? "SET" : "UNSET"}
          </span>
          <span className={statusData?.ingestSecretConfigured ? "text-emerald-400" : "text-slate-400"}>
            INGEST_AUTH: {statusData?.ingestSecretConfigured ? "BEARER LOCKED" : "OPEN LOCAL"}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            feedback.type === "ok"
              ? "bg-emerald-950/30 border-emerald-700/60 text-emerald-200"
              : "bg-amber-950/30 border-amber-700/60 text-amber-200"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW 1: COLUMBUS DESIGN COMPANIES (COMPANY-FOCUSED CLAY TABLE) */}
      {subView === "companies" && (
        <div className="space-y-4">
          {companies.filter((c) => c.status !== "Archived").length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-200">
                No companies ingested from &ldquo;Columbus Design Companies&rdquo; yet
              </p>
              <p className="text-xs text-slate-400 max-w-xl mx-auto">
                Your existing Clay table works directly with{" "}
                <code className="text-blue-300 font-mono">POST /api/jobs/ingest</code>—no new Clay table required. Open{" "}
                <strong className="text-slate-200">Clay Column &amp; API Setup</strong> to copy the JSON mapping for{" "}
                <span className="text-slate-300">Name, Domain, Industry, Size, Job Openings, News, Competitors, Funding</span>, or click{" "}
                <strong className="text-emerald-300">Simulate Company Row</strong> above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {companies
                .filter((c) => c.status !== "Archived")
                .map((co) => {
                  const companyJobPayload = {
                    title: co.jobOpeningsSummary
                      ? `CAD / Design Opening — ${co.name}`
                      : `CAD & Design Studio Outreach — ${co.name}`,
                    company: co.name,
                    location: co.location || "Columbus, OH",
                    description: [
                      `Company: ${co.name} (${co.domain || "No domain"})`,
                      `Industry: ${co.industry}${co.size ? ` · Size: ${co.size}` : ""}`,
                      co.jobOpeningsSummary
                        ? `Job Openings Waterfall: ${co.jobOpeningsSummary}`
                        : "Direct cold outreach / portfolio pitch to studio.",
                      co.news ? `Recent News: ${co.news}` : "",
                      co.funding ? `Funding: ${co.funding}` : "",
                      co.competitors.length > 0
                        ? `Competitors: ${co.competitors.join(", ")}`
                        : "",
                      co.contact.name
                        ? `Contact: ${co.contact.name} (${co.contact.title}) ${co.contact.email}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n"),
                    style: inferResumeStyle(co.jobOpeningsSummary || co.industry, co.industry),
                  };

                  return (
                    <div
                      key={co.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {co.fitScore && (
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                {co.fitScore}/10 FIT
                              </span>
                            )}
                            <h3 className="text-sm font-bold text-white">
                              {co.name}
                            </h3>
                            {co.domain && (
                              <a
                                href={co.websiteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-mono text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <span>{co.domain}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span>{co.industry}</span>
                            {co.size && <span>· {co.size}</span>}
                            <span>· {co.location}</span>
                            {co.funding && <span>· {co.funding}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={co.status}
                            onChange={(e) =>
                              handleCompanyStatusChange(
                                co.id,
                                e.target.value as IngestedCompanyStatus
                              )
                            }
                            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 cursor-pointer"
                          >
                            {COMPANY_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDeleteCompany(co.id)}
                            title="Remove company"
                            className="p-1.5 bg-slate-950 hover:bg-red-950/40 border border-slate-800 rounded text-slate-400 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Waterfall Enrichments Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                            Job Openings Waterfall
                          </div>
                          <p className="text-slate-200">
                            {co.jobOpeningsSummary ||
                              "No open positions listed — target via direct studio pitch."}
                          </p>
                          {co.competitors.length > 0 && (
                            <p className="text-[11px] text-slate-400 pt-1">
                              Competitors: {co.competitors.join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-blue-400">
                            Company News &amp; Contact
                          </div>
                          {co.news && (
                            <p className="text-slate-300 text-[11px]">{co.news}</p>
                          )}
                          {co.contact.name || co.contact.email ? (
                            <div className="text-slate-200 pt-1">
                              <strong>{co.contact.name}</strong>
                              {co.contact.title ? ` (${co.contact.title})` : ""}
                              {co.contact.email ? ` · ${co.contact.email}` : ""}
                            </div>
                          ) : (
                            <p className="text-slate-500 text-[11px]">
                              No contact attached yet.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => onInstantPacket(companyJobPayload)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Compile Pitch / Application Packet</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadToBuilder(companyJobPayload)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded cursor-pointer"
                        >
                          Load into Builder
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const res = addIngestedCompanyToXelime(co);
                            setFeedback({ type: res.added ? "ok" : "err", text: res.message });
                            onNotify?.(res.added ? "success" : "info", res.message);
                          }}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-xs font-medium rounded flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>Add to XELIME</span>
                        </button>
                        {notionConnected && (
                          <button
                            type="button"
                            disabled={busyAction === `notion-co:${co.id}`}
                            onClick={() => handlePushCompanyToNotion(co)}
                            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-blue-300 text-xs font-medium rounded flex items-center gap-1 cursor-pointer"
                          >
                            <Database className="w-3.5 h-3.5" />
                            <span>
                              {busyAction === `notion-co:${co.id}`
                                ? "Saving..."
                                : "Save to Notion"}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: QUALIFIED INGESTED LEADS INBOX */}
      {subView === "inbox" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Filter Status:</span>
              {["all", ...LEAD_STATUSES].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                    statusFilter === st
                      ? "bg-blue-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {st === "all" ? "Active Leads" : st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <label className="text-slate-400">Min Score:</label>
              <select
                value={statusData?.config.minMatchScore ?? 8}
                disabled={busyAction === "config"}
                onChange={(e) => handleThresholdChange(Number(e.target.value))}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono cursor-pointer"
              >
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    ≥ {n}/10
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-200">
                No qualified job leads ingested yet
              </p>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Leads from your{" "}
                <strong className="text-slate-200">Columbus Design Companies</strong>{" "}
                Job Openings waterfall or a{" "}
                <strong className="text-slate-200">Job Search Pipeline</strong> table appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredLeads.map((lead) => {
                const styleGuess = inferResumeStyle(lead.title, lead.description);
                const jobPayload = {
                  title: lead.title,
                  company: lead.company,
                  location: lead.location,
                  description: [
                    lead.description,
                    lead.contact.name
                      ? `\nHiring Contact: ${lead.contact.name} (${lead.contact.title || "Recruiter"}) ${lead.contact.email}`
                      : "",
                    lead.missingSkills.length > 0
                      ? `\nClaygent Flagged Gaps: ${lead.missingSkills.join(", ")}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  style: styleGuess,
                };

                return (
                  <div
                    key={lead.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {lead.matchScore}/10 MATCH
                          </span>
                          <h3 className="text-sm font-bold text-white truncate">
                            {lead.title}
                          </h3>
                          <span className="text-xs text-slate-400">at</span>
                          <span className="text-sm font-semibold text-blue-300">
                            {lead.company}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <span>{lead.location}</span>
                          {lead.salary && <span className="text-slate-300">{lead.salary}</span>}
                          <span className="font-mono text-[11px] text-slate-500">
                            {lead.source} · {new Date(lead.ingestedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            handleLeadStatusChange(
                              lead.id,
                              e.target.value as IngestedLeadStatus
                            )
                          }
                          className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 cursor-pointer"
                        >
                          {LEAD_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteLead(lead.id)}
                          title="Remove lead"
                          className="p-1.5 bg-slate-950 hover:bg-red-950/40 border border-slate-800 rounded text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Enriched Hiring Contact</span>
                        </div>
                        {lead.contact.name || lead.contact.email || lead.contact.linkedinUrl ? (
                          <div className="space-y-0.5 text-slate-300">
                            <div className="font-semibold text-white">
                              {lead.contact.name || "Contact Discovered"}
                              {lead.contact.title ? ` — ${lead.contact.title}` : ""}
                            </div>
                            {lead.contact.email && (
                              <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span>{lead.contact.email}</span>
                              </div>
                            )}
                            {lead.contact.linkedinUrl && (
                              <a
                                href={lead.contact.linkedinUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                              >
                                <span>LinkedIn Profile</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-500">
                            No recruiter contact attached to this Clay payload.
                          </p>
                        )}
                      </div>

                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Claygent Gap &amp; Skill Check</span>
                        </div>
                        {lead.matchedSkills.length > 0 && (
                          <div className="text-emerald-300 text-[11px]">
                            Verified Fit: {lead.matchedSkills.join(", ")}
                          </div>
                        )}
                        {lead.missingSkills.length > 0 ? (
                          <div className="text-amber-300 text-[11px]">
                            Gaps Flagged: {lead.missingSkills.join(", ")}
                          </div>
                        ) : (
                          <div className="text-slate-500 text-[11px]">
                            No critical skill gaps flagged.
                          </div>
                        )}
                      </div>
                    </div>

                    {lead.summary && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {lead.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => onInstantPacket(jobPayload)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Compile Full Application Packet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onLoadToBuilder(jobPayload)}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded cursor-pointer"
                      >
                        Load into Builder
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const res = addIngestedLeadToXelime(lead);
                          setFeedback({ type: res.added ? "ok" : "err", text: res.message });
                          onNotify?.(res.added ? "success" : "info", res.message);
                        }}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-xs font-medium rounded flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Add to XELIME</span>
                      </button>

                      {notionConnected && (
                        <button
                          type="button"
                          disabled={busyAction === `notion:${lead.id}`}
                          onClick={() => handlePushLeadToNotion(lead)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-blue-300 text-xs font-medium rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Database className="w-3.5 h-3.5" />
                          <span>
                            {busyAction === `notion:${lead.id}`
                              ? "Pushing..."
                              : "Save to Notion"}
                          </span>
                        </button>
                      )}

                      {lead.applyUrl && (
                        <a
                          href={lead.applyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded flex items-center gap-1.5"
                        >
                          <span>Apply Directly</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: OUTBOUND PUSH TO CLAY WEBHOOK */}
      {subView === "outbound" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form
            onSubmit={handlePushManualToClay}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
          >
            <div>
              <h3 className="text-sm font-bold text-white">
                Push Company or Job Listing → Clay Incoming Webhook
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sends a payload server-side to{" "}
                <code className="text-blue-300 font-mono">CLAY_WEBHOOK_URL</code> for enrichment in Clay.
              </p>
            </div>

            {!statusData?.webhookConfigured && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-700/50 text-xs text-amber-200">
                <strong>CLAY_WEBHOOK_URL is not configured yet.</strong> Add{" "}
                <code className="font-mono">CLAY_WEBHOOK_URL</code> in AI Studio{" "}
                <strong>Settings → Secrets</strong>.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <input
                type="text"
                required
                placeholder="Company Name *"
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Company Domain (e.g. firm.com)"
                value={manualDomain}
                onChange={(e) => setManualDomain(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Position / Job Title (optional)"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Location (e.g., Columbus, OH)"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <input
                type="url"
                placeholder="Apply / Careers URL (https://...)"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Salary (optional)"
                value={manualSalary}
                onChange={(e) => setManualSalary(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
            <textarea
              rows={3}
              placeholder="Job description or studio notes..."
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!statusData?.webhookConfigured || busyAction === "push_manual"}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {busyAction === "push_manual" ? "Sending to Clay..." : "Send to Clay Webhook"}
              </span>
            </button>
          </form>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Forward Live Job Feed Batch → Clay
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan Career Engine&apos;s live job providers (Remotive, Arbeitnow, The Muse, ATS boards) and push up to 10 listings straight to Clay.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <input
                type="text"
                value={feedQuery}
                onChange={(e) => setFeedQuery(e.target.value)}
                placeholder="Search query..."
                className="flex-1 min-w-[160px] bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
              />
              <input
                type="text"
                value={feedLocation}
                onChange={(e) => setFeedLocation(e.target.value)}
                placeholder="Location..."
                className="w-36 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white"
              />
              <button
                type="button"
                onClick={handleScanLiveJobs}
                disabled={busyAction === "scan_live"}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded cursor-pointer"
              >
                {busyAction === "scan_live" ? "Scanning..." : "Scan Jobs"}
              </button>
            </div>

            {feedJobs.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-medium">
                    Found {feedJobs.length} job(s) ready for Clay enrichment
                  </span>
                  <button
                    type="button"
                    disabled={!statusData?.webhookConfigured || busyAction === "push_batch"}
                    onClick={handlePushLiveFeedBatchToClay}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded text-xs cursor-pointer"
                  >
                    {busyAction === "push_batch"
                      ? "Pushing Batch..."
                      : `Push Top ${Math.min(10, feedJobs.length)} to Clay`}
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {feedJobs.slice(0, 10).map((j, idx) => (
                    <div
                      key={j.id || idx}
                      className="p-2 bg-slate-950 border border-slate-800 rounded text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-200 truncate">
                          {j.title}
                        </div>
                        <div className="text-slate-400 truncate">
                          {j.company} · {j.location}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">
                        {j.source || "Feed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 4: CLAY TABLE & HTTP API BLUEPRINT */}
      {subView === "blueprint" && (
        <div className="space-y-4">
          {/* Table Mode Switcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">
                Choose Your Clay Table Schema
              </h3>
              <p className="text-xs text-slate-400">
                Both schemas post to the same endpoint (<code className="text-blue-300 font-mono">POST /api/jobs/ingest</code>)—the backend auto-detects company rows vs. job rows.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBlueprintMode("columbus_companies")}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                  blueprintMode === "columbus_companies"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                Columbus Design Companies (Existing Table)
              </button>
              <button
                type="button"
                onClick={() => setBlueprintMode("job_pipeline")}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                  blueprintMode === "job_pipeline"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                Job Search Pipeline (Job-Per-Row)
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">
                  HTTP API Column Configuration ({blueprintMode === "columbus_companies" ? "Columbus Design Companies" : "Job Search Pipeline"})
                </h3>
                <p className="text-xs text-slate-400">
                  {blueprintMode === "columbus_companies"
                    ? "Uses your existing Name, Domain, Industry, Size, Job Openings, News, Competitors, and Funding columns directly. Optional: add one Claygent Fit column and set run condition if desired."
                    : `Run condition: {{Claygent.matchScore}} >= ${statusData?.config.minMatchScore ?? 8}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => copyText("url", ingestEndpointUrl)}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded text-xs text-blue-300 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedKey === "url" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Endpoint URL</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 font-mono">
                <div className="text-slate-400">Method &amp; Endpoint URL</div>
                <div className="text-emerald-300 break-all">
                  POST {ingestEndpointUrl}
                </div>
                <div className="text-slate-500 text-[11px] pt-1">
                  Note: use your deployed public URL or localhost tunnel—AI Studio preview URLs (ais-dev/ais-pre) require Google login cookies unless deployed publicly.
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 font-mono">
                <div className="text-slate-400">Headers</div>
                <div className="text-slate-200">Content-Type: application/json</div>
                <div className="text-slate-400 text-[11px]">
                  Optional (if CLAY_INGEST_SECRET is set): Authorization: Bearer &lt;CLAY_INGEST_SECRET&gt;
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  HTTP API JSON Body Template
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      "body",
                      blueprintMode === "columbus_companies"
                        ? httpCompanyBodyTemplate
                        : httpJobBodyTemplate
                    )
                  }
                  className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "body" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied JSON</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON Body</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto">
                {blueprintMode === "columbus_companies"
                  ? httpCompanyBodyTemplate
                  : httpJobBodyTemplate}
              </pre>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  {blueprintMode === "columbus_companies"
                    ? "Optional Claygent Company Fit Prompt"
                    : "Claygent AI Job Scoring Prompt"}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      "prompt",
                      blueprintMode === "columbus_companies"
                        ? claygentCompanyPrompt
                        : claygentJobPrompt
                    )
                  }
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "prompt" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-72 overflow-y-auto">
                {blueprintMode === "columbus_companies"
                  ? claygentCompanyPrompt
                  : claygentJobPrompt}
              </pre>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  External Scraper → Clay Webhook Snippet
                </h3>
                <button
                  type="button"
                  onClick={() => copyText("scraper", nodeScraperSnippet)}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "scraper" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-72">
                {nodeScraperSnippet}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 5: PIPELINE ACTIVITY LOGS */}
      {subView === "logs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">
            Inbound &amp; Outbound Webhook Activity
          </h3>
          {(statusData?.events || []).length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No Clay pipeline events recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {statusData!.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        ev.status === "success"
                          ? "text-emerald-400"
                          : ev.status === "filtered"
                          ? "text-amber-400"
                          : "text-red-400"
                      }`}
                    />
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {ev.direction}
                    </span>
                    <span className="text-slate-200 truncate">{ev.summary}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">
                    {new Date(ev.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
