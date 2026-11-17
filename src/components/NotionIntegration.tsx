import React, { useState, useEffect } from "react";
import { UserProfile } from "../types";
import {
  DOMAIN_FIELD_LABELS,
  KnownDocumentMatch,
  NotionDatabaseRecord,
  NotionDocumentSummary,
  NotionDomainKey,
  NotionDomainMapping,
  NotionPageDetail,
  NotionPropertySchema,
  NotionStatusResponse,
  SyncStatusResponse,
  autoDetectNotionMappings,
  buildLocalSyncPayload,
  connectNotionWorkspace,
  createNotionPage,
  disconnectNotionWorkspace,
  getNotionDatabaseRecords,
  getNotionPage,
  getNotionStatus,
  getNotionSyncStatus,
  importFromNotion,
  listNotionDatabases,
  mergePulledRecordsIntoLocal,
  resolveNotionConflict,
  runNotionSync,
  saveNotionMapping,
  searchNotion,
  updateNotionAccessPolicy,
  updateNotionPage,
} from "../utils/notionClient";
import {
  RefreshCw,
  Search,
  Database,
  FileText,
  ArrowLeftRight,
  Check,
  AlertTriangle,
  Plus,
  Download,
  Upload,
  ShieldCheck,
  Link2,
  Unlink,
  ExternalLink,
  Sliders,
} from "lucide-react";

type NotionSubView =
  | "overview"
  | "documents"
  | "databases"
  | "mappings"
  | "sync";

interface NotionIntegrationProps {
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onImportJobToBuilder: (job: {
    title: string;
    company: string;
    location: string;
    description: string;
    style: string;
  }) => void;
  onSyncCompleteNotice?: (msg: string) => void;
}

export default function NotionIntegration({
  userProfile,
  onUpdateProfile,
  onImportJobToBuilder,
  onSyncCompleteNotice,
}: NotionIntegrationProps) {
  const [subView, setSubView] = useState<NotionSubView>("overview");
  const [status, setStatus] = useState<NotionStatusResponse | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Documents & Search Browser
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "page" | "database">("all");
  const [documents, setDocuments] = useState<NotionDocumentSummary[]>([]);
  const [knownDocuments, setKnownDocuments] = useState<KnownDocumentMatch[]>([]);
  const [selectedPage, setSelectedPage] = useState<NotionPageDetail | null>(null);

  // New Page Form inside Document Browser
  const [showNewPageForm, setShowNewPageForm] = useState(false);
  const [newPageParentId, setNewPageParentId] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageBody, setNewPageBody] = useState("");

  // Databases & Records Browser
  const [databases, setDatabases] = useState<NotionDocumentSummary[]>([]);
  const [selectedDbId, setSelectedDbId] = useState<string>("");
  const [selectedDbMeta, setSelectedDbMeta] =
    useState<NotionDocumentSummary | null>(null);
  const [dbRecords, setDbRecords] = useState<NotionDatabaseRecord[]>([]);

  // Inline create / edit database row
  const [showNewDbRow, setShowNewDbRow] = useState(false);
  const [newDbRowTitle, setNewDbRowTitle] = useState("");
  const [newDbRowCompany, setNewDbRowCompany] = useState("");
  const [newDbRowStatus, setNewDbRowStatus] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingRecordFields, setEditingRecordFields] = useState<
    Record<string, string>
  >({});

  // Mapping State
  const [mappings, setMappings] = useState<
    Partial<Record<NotionDomainKey, NotionDomainMapping>>
  >({});

  // Sync Controls
  const [selectedDomains, setSelectedDomains] = useState<NotionDomainKey[]>([
    "applications",
    "portfolio",
    "skills",
  ]);
  const [syncDirection, setSyncDirection] = useState<
    "pull" | "push" | "bidirectional"
  >("bidirectional");

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [st, syncSt] = await Promise.all([
        getNotionStatus(),
        getNotionSyncStatus(),
      ]);
      setStatus(st);
      setSyncStatus(syncSt);
      setMappings(syncSt.mappings || {});

      if (st.connected) {
        const [searchRes, dbRes] = await Promise.all([
          searchNotion({ pageSize: 50 }),
          listNotionDatabases(),
        ]);
        setDocuments(searchRes.results || []);
        setKnownDocuments(searchRes.knownDocuments || []);
        setDatabases(dbRes.databases || []);
        if (!selectedDbId && dbRes.databases.length > 0) {
          setSelectedDbId(dbRes.databases[0].id);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to load Notion status.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleConnect = async () => {
    setBusyAction("connect");
    setFeedback(null);
    try {
      const res = await connectNotionWorkspace();
      setFeedback({
        type: "ok",
        text: `Connected to ${res.workspaceName} (${res.discoveredCount} workspace item(s) accessible).`,
      });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Connection failed." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async () => {
    setBusyAction("disconnect");
    setFeedback(null);
    try {
      await disconnectNotionWorkspace();
      setFeedback({
        type: "ok",
        text: "Notion integration disconnected. Local Career Engine data remains intact.",
      });
      await refreshAll();
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Disconnect failed." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleAllowlist = async () => {
    if (!status) return;
    setBusyAction("allowlist");
    try {
      const allDiscoveredIds = documents.map((d) => d.id);
      const next = await updateNotionAccessPolicy({
        enforceAllowlist: !status.enforceAllowlist,
        authorizedIds:
          status.authorizedIds.length > 0
            ? status.authorizedIds
            : allDiscoveredIds,
      });
      setStatus({
        ...status,
        enforceAllowlist: next.enforceAllowlist,
        authorizedIds: next.authorizedIds,
      });
      setFeedback({
        type: "ok",
        text: next.enforceAllowlist
          ? `Restricted Notion access to ${next.authorizedIds.length} authorized document(s).`
          : "Allowlist restriction disabled (using Notion integration share permissions).",
      });
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to update access policy.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSearch = async () => {
    setBusyAction("search");
    setFeedback(null);
    try {
      const res = await searchNotion({
        q: searchQuery.trim() || undefined,
        type: searchType === "all" ? undefined : searchType,
        pageSize: 60,
      });
      setDocuments(res.results || []);
      if (res.knownDocuments) setKnownDocuments(res.knownDocuments);
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Search failed." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleInspectPage = async (id: string) => {
    setBusyAction(`page:${id}`);
    setFeedback(null);
    try {
      const detail = await getNotionPage(id);
      setSelectedPage(detail);
      setSubView("documents");
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to read Notion page.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleLoadDatabaseRecords = async (dbId: string) => {
    if (!dbId) return;
    setSelectedDbId(dbId);
    setBusyAction(`db:${dbId}`);
    setFeedback(null);
    try {
      const res = await getNotionDatabaseRecords(dbId, { pageSize: 50 });
      setSelectedDbMeta(res.database);
      setDbRecords(res.records || []);
      setSubView("databases");
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to query database records.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportObject = async (
    sourceType: "page" | "database",
    id: string,
    domain?: NotionDomainKey
  ) => {
    setBusyAction(`import:${id}`);
    setFeedback(null);
    try {
      const res = await importFromNotion({ sourceType, id, domain });
      if (sourceType === "page") {
        const skillsToMerge = res.imported?.skills || [];
        if (skillsToMerge.length > 0) {
          onUpdateProfile({
            ...userProfile,
            skills: Array.from(
              new Set([...userProfile.skills, ...skillsToMerge])
            ),
            summary:
              res.plainText && res.plainText.length > 60
                ? res.plainText.slice(0, 600)
                : userProfile.summary,
          });
        }
        setFeedback({
          type: "ok",
          text: `Imported sanitized content from "${res.documentTitle}".`,
        });
      } else {
        const merged = mergePulledRecordsIntoLocal({
          [res.domain]: res.records || [],
        });
        setFeedback({
          type: "ok",
          text: `Imported ${res.recordsCount} record(s) from "${res.documentTitle}" into XELIME (${merged.mergedApplications} jobs, ${merged.mergedProjects} portfolio projects, ${merged.mergedSkills} skills).`,
        });
        onSyncCompleteNotice?.(
          `Imported ${res.recordsCount} Notion records from ${res.documentTitle}.`
        );
      }
    } catch (err: any) {
      setFeedback({ type: "err", text: err?.message || "Import failed." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateChildPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageParentId || !newPageTitle.trim()) return;
    setBusyAction("create_page");
    setFeedback(null);
    try {
      const created = await createNotionPage({
        parentPageId: newPageParentId,
        title: newPageTitle.trim(),
        contentParagraphs: newPageBody
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      });
      setFeedback({
        type: "ok",
        text: `Created Notion page "${created.title}".`,
      });
      setShowNewPageForm(false);
      setNewPageTitle("");
      setNewPageBody("");
      await handleSearch();
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to create Notion page.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateDatabaseRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDbMeta || !newDbRowTitle.trim()) return;
    setBusyAction("create_row");
    setFeedback(null);
    try {
      const schemaProps: Record<string, NotionPropertySchema> =
        selectedDbMeta.properties || {};
      const propValues = Object.values(schemaProps) as NotionPropertySchema[];
      const titleProp = propValues.find((p) => p.type === "title");
      const companyProp = propValues.find((p) =>
        p.name.toLowerCase().includes("company")
      );
      const statusProp = propValues.find(
        (p) => p.type === "status" || p.type === "select"
      );

      const props: Record<string, any> = {};
      if (titleProp) props[titleProp.name] = newDbRowTitle.trim();
      if (companyProp && newDbRowCompany.trim())
        props[companyProp.name] = newDbRowCompany.trim();
      if (statusProp && newDbRowStatus.trim())
        props[statusProp.name] = newDbRowStatus.trim();

      const created = await createNotionPage({
        parentDatabaseId: selectedDbMeta.id,
        title: newDbRowTitle.trim(),
        properties: props,
      });
      setFeedback({
        type: "ok",
        text: `Created database record "${created.title}".`,
      });
      setShowNewDbRow(false);
      setNewDbRowTitle("");
      setNewDbRowCompany("");
      setNewDbRowStatus("");
      await handleLoadDatabaseRecords(selectedDbMeta.id);
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to create database record.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveRecordEdit = async (rec: NotionDatabaseRecord) => {
    setBusyAction(`edit:${rec.id}`);
    setFeedback(null);
    try {
      const updated = await updateNotionPage(rec.id, {
        properties: editingRecordFields,
        expectedLastEditedTime: rec.lastEditedTime,
      });
      setFeedback({
        type: "ok",
        text: `Updated Notion record "${updated.title}".`,
      });
      setEditingRecordId(null);
      if (selectedDbMeta) {
        await handleLoadDatabaseRecords(selectedDbMeta.id);
      }
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to update record.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAutoDetectMappings = async () => {
    setBusyAction("autodetect");
    setFeedback(null);
    try {
      const res = await autoDetectNotionMappings();
      setMappings(res.mappings || {});
      setFeedback({
        type: "ok",
        text: `Auto-mapped Career Engine domains across ${res.databasesCount} Notion database(s).`,
      });
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Auto-detect failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveDomainMapping = async (domain: NotionDomainKey) => {
    const m = mappings[domain];
    if (!m || !m.databaseId) return;
    setBusyAction(`save_map:${domain}`);
    setFeedback(null);
    try {
      const res = await saveNotionMapping({
        domain,
        databaseId: m.databaseId,
        databaseTitle: m.databaseTitle,
        fieldToProperty: m.fieldToProperty || {},
      });
      setMappings(res.mappings || {});
      setFeedback({
        type: "ok",
        text: `Saved schema mapping for ${DOMAIN_FIELD_LABELS[domain].label}.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Failed to save mapping.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleManualSync = async () => {
    if (selectedDomains.length === 0) {
      setFeedback({
        type: "err",
        text: "Select at least one domain to synchronize.",
      });
      return;
    }
    setBusyAction("sync");
    setFeedback(null);
    try {
      const localData = buildLocalSyncPayload(userProfile);
      const res = await runNotionSync({
        direction: syncDirection,
        domains: selectedDomains,
        localData,
      });

      if (
        (syncDirection === "pull" || syncDirection === "bidirectional") &&
        res.pulledByDomain
      ) {
        mergePulledRecordsIntoLocal(res.pulledByDomain);
      }

      setFeedback({
        type: res.entry.status === "error" ? "err" : "ok",
        text: res.entry.summary,
      });
      onSyncCompleteNotice?.(res.entry.summary);
      await refreshAll();
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Manual synchronization failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleResolveConflict = async (
    conflictId: string,
    domain: NotionDomainKey,
    localId: string,
    resolution: "keep_notion" | "force_local"
  ) => {
    setBusyAction(`conflict:${conflictId}`);
    setFeedback(null);
    try {
      const localPayload = buildLocalSyncPayload(userProfile);
      const localRow = (localPayload[domain] || []).find(
        (r: any) => r.id === localId
      );
      const res = await resolveNotionConflict(
        conflictId,
        resolution,
        resolution === "force_local" ? localRow : undefined
      );
      setSyncStatus(res.syncStatus);
      setFeedback({
        type: "ok",
        text:
          resolution === "keep_notion"
            ? "Resolved conflict by keeping the newer Notion version."
            : "Resolved conflict by pushing Career Engine version to Notion.",
      });
      await refreshAll();
    } catch (err: any) {
      setFeedback({
        type: "err",
        text: err?.message || "Conflict resolution failed.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-5 text-slate-100 font-sans">
      {/* Header & Connection Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-white text-base">
                Notion Workspace Integration
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  status?.connected
                    ? "text-emerald-400 font-medium"
                    : status?.status === "unconfigured"
                    ? "text-amber-400 font-medium"
                    : "text-slate-400"
                }
              >
                {status?.connected
                  ? `Connected (${status.workspaceName})`
                  : status?.status === "disconnected"
                  ? "Disconnected"
                  : status?.status === "error"
                  ? "Connection Error"
                  : "Not Configured"}
              </span>
              {status?.apiVersion && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    API {status.apiVersion}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {status?.message ||
                "Checking Notion server integration status..."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading || busyAction !== null}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>

            {status?.connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={busyAction === "disconnect"}
                className="px-3.5 py-2 bg-slate-950 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-700/60 rounded-lg text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5 text-rose-400" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={busyAction === "connect"}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>
                  {busyAction === "connect"
                    ? "Connecting..."
                    : "Connect Workspace"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800">
          {(
            [
              { id: "overview", label: "Overview & Security" },
              { id: "documents", label: `Documents (${documents.length})` },
              { id: "databases", label: `Databases (${databases.length})` },
              { id: "mappings", label: "Schema Mapping" },
              {
                id: "sync",
                label: `Sync & History (${syncStatus?.pendingConflicts.length || 0} conflicts)`,
              },
            ] as { id: NotionSubView; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubView(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                subView === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-950 text-slate-400 hover:text-slate-100 border border-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === "ok"
              ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
              : "bg-amber-950/30 border-amber-800/50 text-amber-300"
          }`}
        >
          {feedback.type === "ok" ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* VIEW 1: OVERVIEW & KNOWN WORKSPACE DOCUMENTS */}
      {subView === "overview" && (
        <div className="space-y-5">
          {!status?.configured && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-semibold text-white">
                Server Environment Setup Required
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tokens remain strictly server-side and are never stored in browser storage or entered into frontend forms. Add{" "}
                <span className="font-mono text-slate-200">NOTION_API_KEY</span>{" "}
                and optionally{" "}
                <span className="font-mono text-slate-200">
                  NOTION_API_VERSION=2022-06-28
                </span>{" "}
                in AI Studio <strong>Settings → Secrets</strong>, then share your target Notion pages and databases with your Notion integration.
              </p>
            </div>
          )}

          {/* Security & Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Mapped Domains</div>
              <div className="text-xl font-semibold text-white font-mono tabular-nums mt-1">
                {status?.mappingsCount ?? 0} / 4
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Linked Notion Records</div>
              <div className="text-xl font-semibold text-white font-mono tabular-nums mt-1">
                {status?.linkedRecordsCount ?? 0}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Pending Conflicts</div>
              <div className="text-xl font-semibold text-amber-400 font-mono tabular-nums mt-1">
                {status?.pendingConflictsCount ?? 0}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Allowlist Guard</span>
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <button
                type="button"
                onClick={handleToggleAllowlist}
                disabled={!status?.connected || busyAction === "allowlist"}
                className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs text-left text-slate-200 cursor-pointer disabled:opacity-50"
              >
                {status?.enforceAllowlist
                  ? `Enforced (${status.authorizedIds.length} IDs)`
                  : "Standard Notion Share Scope"}
              </button>
            </div>
          </div>

          {/* Target 7 Existing Documents Discovery Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Existing Career Workspace Documents
                </h3>
                <p className="text-xs text-slate-400">
                  Verifies whether each expected document is shared with your integration and inspects whether it is a database or a page.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAutoDetectMappings}
                disabled={!status?.connected || busyAction === "autodetect"}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-blue-400 cursor-pointer disabled:opacity-40"
              >
                Auto-Detect Database Schemas
              </button>
            </div>

            {!status?.connected ? (
              <p className="text-xs text-slate-400 py-4">
                Connect your Notion workspace above to inspect your shared documents and databases.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {knownDocuments.map((item) => (
                  <div
                    key={item.key}
                    className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-medium text-white">
                        {item.canonicalTitle}
                      </div>
                      <div className="text-slate-400">
                        {item.description}
                        {item.document && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="font-mono text-slate-300">
                              {item.document.objectType}
                            </span>
                            {item.document.properties &&
                              ` (${Object.keys(item.document.properties).length} properties)`}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.found && item.document ? (
                        <>
                          <span className="text-emerald-400 font-medium">
                            Authorized
                          </span>
                          {item.document.objectType === "database" ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleLoadDatabaseRecords(item.document!.id)
                              }
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 cursor-pointer"
                            >
                              Browse Records
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleInspectPage(item.document!.id)
                              }
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 cursor-pointer"
                            >
                              Read Page
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">
                          Not shared with integration
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: DOCUMENT BROWSER */}
      {subView === "documents" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                Search Workspace
              </h3>
              <button
                type="button"
                disabled={!status?.connected}
                onClick={() => {
                  if (!newPageParentId && documents.length > 0) {
                    const firstPage = documents.find(
                      (d) => d.objectType === "page"
                    );
                    if (firstPage) setNewPageParentId(firstPage.id);
                  }
                  setShowNewPageForm((v) => !v);
                }}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New Page</span>
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="Search Notion pages or databases..."
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              />
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as any)}
                className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                <option value="all">All</option>
                <option value="page">Pages</option>
                <option value="database">Databases</option>
              </select>
              <button
                type="button"
                onClick={handleSearch}
                disabled={!status?.connected || busyAction === "search"}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-200 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>

            {showNewPageForm && (
              <form
                onSubmit={handleCreateChildPage}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5 text-xs"
              >
                <div className="font-medium text-white">
                  Create New Page Under Shared Parent
                </div>
                <select
                  value={newPageParentId}
                  onChange={(e) => setNewPageParentId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200"
                  required
                >
                  <option value="">Select parent Notion page...</option>
                  {documents
                    .filter((d) => d.objectType === "page")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="Page title"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-100"
                  required
                />
                <textarea
                  rows={3}
                  value={newPageBody}
                  onChange={(e) => setNewPageBody(e.target.value)}
                  placeholder="Content paragraphs (one per line)"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-100"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewPageForm(false)}
                    className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyAction === "create_page"}
                    className="px-3 py-1 bg-blue-600 text-white rounded cursor-pointer"
                  >
                    Create Page
                  </button>
                </div>
              </form>
            )}

            <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-800/70">
              {documents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {status?.connected
                    ? "No matching Notion documents found."
                    : "Connect Notion workspace to search documents."}
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        doc.objectType === "database"
                          ? handleLoadDatabaseRecords(doc.id)
                          : handleInspectPage(doc.id)
                      }
                      className="text-left min-w-0 flex-1 hover:text-blue-400 cursor-pointer"
                    >
                      <div className="font-medium text-slate-100 truncate">
                        {doc.title}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {doc.objectType} ·{" "}
                        {doc.lastEditedTime
                          ? new Date(doc.lastEditedTime).toLocaleDateString()
                          : ""}
                      </div>
                    </button>

                    {doc.objectType === "database" ? (
                      <Database className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            {!selectedPage ? (
              <div className="py-16 text-center text-xs text-slate-500">
                Select any Notion page on the left to inspect sanitized content, properties, and import options.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {selectedPage.title}
                    </h3>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                      Last edited:{" "}
                      {new Date(selectedPage.lastEditedTime).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleImportObject("page", selectedPage.id)
                      }
                      disabled={busyAction === `import:${selectedPage.id}`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Import into Profile</span>
                    </button>
                    {selectedPage.url && (
                      <a
                        href={selectedPage.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Notion</span>
                      </a>
                    )}
                  </div>
                </div>

                {Object.keys(selectedPage.normalizedProperties || {}).length >
                  0 && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-300">
                      Page Properties
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(selectedPage.normalizedProperties).map(
                        ([k, v]) => (
                          <div
                            key={k}
                            className="p-2 bg-slate-950 border border-slate-800 rounded"
                          >
                            <span className="text-slate-400">{k}: </span>
                            <span className="text-slate-100 font-mono">
                              {Array.isArray(v)
                                ? v.join(", ")
                                : v === null
                                ? "—"
                                : String(v)}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-300">
                    Sanitized Page Content
                  </div>
                  <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 whitespace-pre-wrap font-sans max-h-[340px] overflow-y-auto leading-relaxed">
                    {selectedPage.plainText ||
                      "No readable text blocks on this page."}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: DATABASE BROWSER */}
      {subView === "databases" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <select
                value={selectedDbId}
                onChange={(e) => handleLoadDatabaseRecords(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 min-w-[260px]"
              >
                <option value="">Select an authorized Notion database...</option>
                {databases.map((db) => (
                  <option key={db.id} value={db.id}>
                    {db.title} ({Object.keys(db.properties || {}).length} fields)
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  selectedDbId && handleLoadDatabaseRecords(selectedDbId)
                }
                disabled={!selectedDbId || busyAction !== null}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-200 cursor-pointer"
              >
                Load Schema &amp; Records
              </button>
            </div>

            {selectedDbMeta && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewDbRow((v) => !v)}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleImportObject("database", selectedDbMeta.id)
                  }
                  disabled={busyAction === `import:${selectedDbMeta.id}`}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import to Career Engine</span>
                </button>
              </div>
            )}
          </div>

          {showNewDbRow && selectedDbMeta && (
            <form
              onSubmit={handleCreateDatabaseRow}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs"
            >
              <input
                type="text"
                value={newDbRowTitle}
                onChange={(e) => setNewDbRowTitle(e.target.value)}
                placeholder="Primary title (Role / Project / Skill)"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
                required
              />
              <input
                type="text"
                value={newDbRowCompany}
                onChange={(e) => setNewDbRowCompany(e.target.value)}
                placeholder="Company (optional)"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
              />
              <input
                type="text"
                value={newDbRowStatus}
                onChange={(e) => setNewDbRowStatus(e.target.value)}
                placeholder="Status / Stage (optional)"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busyAction === "create_row"}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg font-medium cursor-pointer"
                >
                  Create Row
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewDbRow(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {selectedDbMeta && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="space-y-1 border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-white">
                  {selectedDbMeta.title}
                </h3>
                <div className="text-xs text-slate-400">
                  Discovered Properties:{" "}
                  <span className="font-mono text-slate-300">
                    {(
                      Object.values(
                        selectedDbMeta.properties || {}
                      ) as NotionPropertySchema[]
                    )
                      .map((p) => `${p.name} (${p.type})`)
                      .join(" · ")}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {dbRecords.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    No records returned from this Notion database yet.
                  </p>
                ) : (
                  dbRecords.map((rec) => {
                    const isEditing = editingRecordId === rec.id;
                    return (
                      <div
                        key={rec.id}
                        className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-white">
                              {rec.title}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Edited{" "}
                              {new Date(rec.lastEditedTime).toLocaleString()}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onImportJobToBuilder({
                                  title: rec.title,
                                  company: String(
                                    rec.normalizedFields.Company ||
                                      rec.normalizedFields.company ||
                                      "Notion Record"
                                  ),
                                  location: String(
                                    rec.normalizedFields.Location || "Remote"
                                  ),
                                  description: Object.entries(
                                    rec.normalizedFields
                                  )
                                    .map(([k, v]) => `${k}: ${v ?? ""}`)
                                    .join("\n"),
                                  style: "CAD Technician",
                                });
                              }}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 cursor-pointer"
                            >
                              Send to Builder
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingRecordId(null);
                                } else {
                                  const init: Record<string, string> = {};
                                  for (const [k, v] of Object.entries(
                                    rec.normalizedFields
                                  )) {
                                    init[k] = Array.isArray(v)
                                      ? v.join(", ")
                                      : v === null
                                      ? ""
                                      : String(v);
                                  }
                                  setEditingRecordFields(init);
                                  setEditingRecordId(rec.id);
                                }
                              }}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-blue-400 cursor-pointer"
                            >
                              {isEditing ? "Cancel" : "Edit Properties"}
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2 pt-2 border-t border-slate-800">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {(
                                Object.entries(
                                  selectedDbMeta.properties || {}
                                ) as [string, NotionPropertySchema][]
                              ).map(([propName, schema]) => {
                                if (
                                  ["created_time", "last_edited_time", "formula", "rollup", "files", "relation"].includes(
                                    schema.type
                                  )
                                ) {
                                  return null;
                                }
                                return (
                                  <div key={propName} className="space-y-1">
                                    <label className="text-[11px] text-slate-400 block">
                                      {propName} ({schema.type})
                                    </label>
                                    <input
                                      type="text"
                                      value={
                                        editingRecordFields[propName] ?? ""
                                      }
                                      onChange={(e) =>
                                        setEditingRecordFields({
                                          ...editingRecordFields,
                                          [propName]: e.target.value,
                                        })
                                      }
                                      className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveRecordEdit(rec)}
                              disabled={busyAction === `edit:${rec.id}`}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded font-medium cursor-pointer"
                            >
                              Save Update to Notion
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-slate-400">
                            {Object.entries(rec.normalizedFields).map(
                              ([k, v]) => (
                                <div key={k} className="truncate">
                                  <span className="text-slate-500">{k}: </span>
                                  <span className="text-slate-200">
                                    {Array.isArray(v)
                                      ? v.join(", ") || "—"
                                      : v === null || v === ""
                                      ? "—"
                                      : String(v)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: DATABASE SCHEMA MAPPING */}
      {subView === "mappings" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Career Engine ↔ Notion Property Mapping
              </h3>
              <p className="text-xs text-slate-400">
                Reuses your existing Notion databases and properties rather than creating duplicate databases.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoDetectMappings}
              disabled={!status?.connected || busyAction === "autodetect"}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Auto-Detect Schemas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(
              ["profile", "skills", "applications", "portfolio"] as NotionDomainKey[]
            ).map((domain) => {
              const spec = DOMAIN_FIELD_LABELS[domain];
              const current = mappings[domain];
              const targetDb = databases.find(
                (d) => d.id === current?.databaseId
              );
              const propNames = Object.keys(targetDb?.properties || {});

              return (
                <div
                  key={domain}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <h4 className="text-sm font-semibold text-white">
                      {spec.label}
                    </h4>
                    <button
                      type="button"
                      onClick={() => handleSaveDomainMapping(domain)}
                      disabled={
                        !current?.databaseId ||
                        busyAction === `save_map:${domain}`
                      }
                      className="px-3 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-xs text-blue-400 cursor-pointer disabled:opacity-40"
                    >
                      Save Mapping
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">
                      Target Notion Database
                    </label>
                    <select
                      value={current?.databaseId || ""}
                      onChange={(e) => {
                        const db = databases.find(
                          (d) => d.id === e.target.value
                        );
                        setMappings({
                          ...mappings,
                          [domain]: {
                            domain,
                            databaseId: e.target.value,
                            databaseTitle: db?.title || "",
                            fieldToProperty: current?.fieldToProperty || {},
                            updatedAt: new Date().toISOString(),
                          },
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                    >
                      <option value="">Not mapped yet</option>
                      {databases.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 pt-1">
                    {spec.fields.map((field) => (
                      <div
                        key={field.key}
                        className="grid grid-cols-12 gap-2 items-center text-xs"
                      >
                        <span className="col-span-5 text-slate-300 truncate">
                          {field.label}
                        </span>
                        <select
                          value={current?.fieldToProperty?.[field.key] || ""}
                          onChange={(e) => {
                            if (!current) return;
                            setMappings({
                              ...mappings,
                              [domain]: {
                                ...current,
                                fieldToProperty: {
                                  ...(current.fieldToProperty || {}),
                                  [field.key]: e.target.value,
                                },
                              },
                            });
                          }}
                          disabled={!targetDb}
                          className="col-span-7 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 font-mono"
                        >
                          <option value="">Unmapped</option>
                          {propNames.map((pn) => (
                            <option key={pn} value={pn}>
                              {pn} ({targetDb?.properties?.[pn]?.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 5: MANUAL SYNCHRONIZATION, CONFLICTS & HISTORY */}
      {subView === "sync" && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Selective Manual Synchronization
              </h3>
              <p className="text-xs text-slate-400">
                Uses record ID links, duplicate matching, and timestamp conflict checks so newer Notion edits are never overwritten silently.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              {(
                [
                  "profile",
                  "skills",
                  "applications",
                  "portfolio",
                ] as NotionDomainKey[]
              ).map((dom) => {
                const checked = selectedDomains.includes(dom);
                return (
                  <label
                    key={dom}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedDomains((prev) =>
                          checked
                            ? prev.filter((x) => x !== dom)
                            : [...prev, dom]
                        )
                      }
                      className="accent-blue-500"
                    />
                    <span>{DOMAIN_FIELD_LABELS[dom].label}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={syncDirection}
                onChange={(e) => setSyncDirection(e.target.value as any)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
              >
                <option value="bidirectional">
                  Bidirectional (Pull &amp; Push with Conflict Protection)
                </option>
                <option value="pull">Pull from Notion Only</option>
                <option value="push">Push Career Engine to Notion Only</option>
              </select>

              <button
                type="button"
                onClick={handleManualSync}
                disabled={!status?.connected || busyAction === "sync"}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                {syncDirection === "pull" ? (
                  <Download className="w-3.5 h-3.5" />
                ) : syncDirection === "push" ? (
                  <Upload className="w-3.5 h-3.5" />
                ) : (
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                )}
                <span>
                  {busyAction === "sync"
                    ? "Synchronizing..."
                    : "Run Manual Sync"}
                </span>
              </button>
            </div>
          </div>

          {/* Conflict Resolution Queue */}
          {syncStatus && syncStatus.pendingConflicts.length > 0 && (
            <div className="bg-slate-900 border border-amber-700/60 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-amber-300">
                Sync Conflicts Requiring Decision ({syncStatus.pendingConflicts.length})
              </h3>
              <div className="space-y-2.5">
                {syncStatus.pendingConflicts.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-white">
                        {c.title} ({c.domain})
                      </div>
                      <div className="text-slate-400">{c.reason}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        Notion edited:{" "}
                        {new Date(c.notionUpdatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleResolveConflict(
                            c.id,
                            c.domain,
                            c.localId,
                            "keep_notion"
                          )
                        }
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded cursor-pointer"
                      >
                        Keep Notion
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleResolveConflict(
                            c.id,
                            c.domain,
                            c.localId,
                            "force_local"
                          )
                        }
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded cursor-pointer"
                      >
                        Overwrite with Local
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync History */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Sync History</h3>
              {syncStatus?.lastSyncAt && (
                <span className="text-xs font-mono text-slate-400">
                  Last Sync:{" "}
                  {new Date(syncStatus.lastSyncAt).toLocaleString()}
                </span>
              )}
            </div>

            {!syncStatus || syncStatus.history.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No manual synchronizations have been executed yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-800/70 text-xs">
                {syncStatus.history.map((h) => (
                  <div key={h.id} className="py-2.5 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-white">
                        {h.summary}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {new Date(h.timestamp).toLocaleString()} · {h.status}
                      </span>
                    </div>
                    {h.errors.length > 0 && (
                      <div className="text-amber-300 font-mono text-[11px]">
                        {h.errors.join(" | ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
