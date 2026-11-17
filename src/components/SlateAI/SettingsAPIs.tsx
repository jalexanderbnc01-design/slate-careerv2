import React, { useState, useEffect } from "react";
import {
  ProviderCategory,
  ProviderSnapshot,
  UsageSummaryResponse,
  fetchAIProviders,
  fetchAIUsage,
  resetAIUsage,
  testAIProviderConnection,
  discoverAIProviderModels,
  updateAIProviderConfig,
} from "../../utils/slateAiClient";
import {
  RefreshCw,
  Check,
  AlertTriangle,
  Sliders,
  Trash2,
  MessageSquare,
} from "lucide-react";

const CATEGORY_ORDER: ProviderCategory[] = [
  "Local AI Runtimes",
  "Cloud AI Providers",
  "Agent and Tool Runtimes",
  "Image Generation",
  "Enterprise Connectors",
];

interface SettingsAPIsProps {
  onOpenChat?: () => void;
  onProvidersChanged?: () => void;
}

export default function SettingsAPIs({
  onOpenChat,
  onProvidersChanged,
}: SettingsAPIsProps) {
  const [providers, setProviders] = useState<ProviderSnapshot[]>([]);
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [discoveringId, setDiscoveringId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Per-provider editable non-secret config drafts
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        customBaseUrl: string;
        customModelsText: string;
        azureDeployment: string;
        azureApiVersion: string;
        openRouterMonthlyCapUsd: string;
      }
    >
  >({});

  const loadAll = async () => {
    setLoading(true);
    try {
      const [provList, usageData] = await Promise.all([
        fetchAIProviders(),
        fetchAIUsage(),
      ]);
      setProviders(provList);
      setUsage(usageData);

      const nextDrafts: typeof drafts = {};
      for (const p of provList) {
        nextDrafts[p.id] = {
          customBaseUrl: p.config.customBaseUrl || p.baseUrl || "",
          customModelsText: (p.config.customModels || []).join(", "),
          azureDeployment: p.config.azureDeployment || "",
          azureApiVersion: p.config.azureApiVersion || "2024-10-21",
          openRouterMonthlyCapUsd: String(p.config.openRouterMonthlyCapUsd ?? 10),
        };
      }
      setDrafts(nextDrafts);
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Failed to load API providers." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const replaceProviderInState = (updated: ProviderSnapshot) => {
    setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    onProvidersChanged?.();
  };

  const handleToggleEnabled = async (provider: ProviderSnapshot) => {
    setSavingId(provider.id);
    setNotice(null);
    try {
      const res = await updateAIProviderConfig(provider.id, {
        enabled: !provider.enabled,
      });
      replaceProviderInState(res.provider);
      if (res.notice) {
        setNotice({ type: "err", text: res.notice });
      }
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Failed to update provider toggle." });
    } finally {
      setSavingId(null);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    setNotice(null);
    try {
      const res = await testAIProviderConnection(providerId);
      replaceProviderInState(res.provider);
      setNotice({
        type: res.result.ok ? "ok" : "err",
        text: res.result.message,
      });
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Connection test failed." });
    } finally {
      setTestingId(null);
    }
  };

  const handleDiscoverModels = async (providerId: string) => {
    setDiscoveringId(providerId);
    setNotice(null);
    try {
      const res = await discoverAIProviderModels(providerId);
      if (res.provider) replaceProviderInState(res.provider);
      setNotice({
        type: res.ok ? "ok" : "err",
        text: res.ok
          ? `Confirmed ${res.models.length} model(s) for ${res.provider?.displayName || providerId}.`
          : res.error || "Model discovery returned no models.",
      });
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Model discovery failed." });
    } finally {
      setDiscoveringId(null);
    }
  };

  const handleSaveConfig = async (provider: ProviderSnapshot) => {
    const d = drafts[provider.id];
    if (!d) return;
    setSavingId(provider.id);
    setNotice(null);
    try {
      const customModels = d.customModelsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await updateAIProviderConfig(provider.id, {
        customBaseUrl: d.customBaseUrl,
        customModels,
        azureDeployment: d.azureDeployment,
        azureApiVersion: d.azureApiVersion,
        openRouterMonthlyCapUsd: Number(d.openRouterMonthlyCapUsd),
      });
      replaceProviderInState(res.provider);
      setNotice({
        type: "ok",
        text: `Saved settings for ${provider.displayName}.`,
      });
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Failed to save configuration." });
    } finally {
      setSavingId(null);
    }
  };

  const handleResetUsage = async () => {
    try {
      const next = await resetAIUsage();
      setUsage(next);
      setNotice({ type: "ok", text: "Usage and cost logs cleared." });
    } catch (err: any) {
      setNotice({ type: "err", text: err?.message || "Failed to reset usage logs." });
    }
  };

  const statusTextColor = (status: ProviderSnapshot["status"]) => {
    switch (status) {
      case "connected":
        return "text-emerald-400";
      case "ready":
        return "text-blue-400";
      case "offline":
      case "error":
        return "text-rose-400";
      case "unconfigured":
        return "text-amber-400";
      default:
        return "text-slate-500";
    }
  };

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Settings → APIs
          </h2>
          <p className="text-xs text-slate-400">
            Central AI provider management, live model discovery, connection testing, and monthly spend controls. API keys remain server-side in AI Studio Secrets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh All</span>
          </button>
          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Open Slate AI Chat</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            notice.type === "ok"
              ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
              : "bg-amber-950/30 border-amber-800/50 text-amber-300"
          }`}
        >
          {notice.type === "ok" ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Usage & Cost Tracking Dashboard */}
      {usage && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Usage & Cost Tracking</h3>
              <p className="text-xs text-slate-400">
                Tracks server-routed token volume, estimated USD cost, and OpenRouter Paid monthly cap.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetUsage}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Logs</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
              <span className="text-xs text-slate-400 block">Total Requests</span>
              <span className="text-xl font-semibold text-white font-mono tabular-nums">
                {usage.totalRequests}
              </span>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
              <span className="text-xs text-slate-400 block">Total Tokens</span>
              <span className="text-xl font-semibold text-white font-mono tabular-nums">
                {usage.totalTokens.toLocaleString()}
              </span>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg">
              <span className="text-xs text-slate-400 block">Estimated Spend</span>
              <span className="text-xl font-semibold text-emerald-400 font-mono tabular-nums">
                ${usage.totalCostUsd.toFixed(4)}
              </span>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">OpenRouter Paid Cap</span>
                <span className="font-mono tabular-nums text-slate-200">
                  ${usage.openRouterPaidMonthlySpendUsd.toFixed(3)} / ${usage.openRouterPaidMonthlyCapUsd.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      usage.openRouterPaidMonthlyCapUsd > 0
                        ? (usage.openRouterPaidMonthlySpendUsd /
                            usage.openRouterPaidMonthlyCapUsd) *
                            100
                        : 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {usage.byProvider.length > 0 && (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Provider</th>
                    <th className="py-2 pr-4 font-medium text-right">Requests</th>
                    <th className="py-2 pr-4 font-medium text-right">Errors</th>
                    <th className="py-2 pr-4 font-medium text-right">Tokens</th>
                    <th className="py-2 font-medium text-right">Est. USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                  {usage.byProvider.map((row) => (
                    <tr key={row.providerId} className="text-slate-300">
                      <td className="py-2 pr-4 font-sans text-white">{row.providerName}</td>
                      <td className="py-2 pr-4 text-right">{row.requests}</td>
                      <td className="py-2 pr-4 text-right text-rose-400">{row.failures}</td>
                      <td className="py-2 pr-4 text-right">{row.totalTokens.toLocaleString()}</td>
                      <td className="py-2 text-right text-emerald-400">
                        ${row.estimatedCostUsd.toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5 Grouped Provider Categories */}
      {CATEGORY_ORDER.map((category) => {
        const group = providers.filter((p) => p.category === category);
        if (group.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h3 className="text-sm font-semibold text-white px-1">{category}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {group.map((p) => {
                const draft = drafts[p.id];
                const isOllamaOrLm = p.id === "ollama" || p.id === "lm_studio";
                const isAzure = p.id === "azure_openai";
                const isDashScope = p.id === "dashscope";
                const isOpenRouterPaid = p.id === "openrouter_paid";

                return (
                  <div
                    key={p.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">
                            {p.displayName}
                          </h4>
                          <span className={`text-xs font-medium ${statusTextColor(p.status)}`}>
                            · {p.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          Endpoint: <span className="font-mono text-slate-300">{p.baseUrl}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Auth: {p.authMethod} ·{" "}
                          <span className={p.configured ? "text-emerald-400" : "text-amber-400"}>
                            {p.configured ? "Credentials Ready" : "Not Configured in Secrets"}
                          </span>
                        </div>
                      </div>

                      {/* Enable / Disable Toggle */}
                      <button
                        type="button"
                        disabled={savingId === p.id || !p.implemented}
                        onClick={() => handleToggleEnabled(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0 cursor-pointer disabled:opacity-50 ${
                          p.enabled
                            ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        {p.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{p.statusMessage}</p>

                    {/* Confirmed / Available Models List */}
                    <div className="text-xs text-slate-400 border-t border-slate-800/70 pt-3">
                      <span className="text-slate-300 font-medium">Available Models: </span>
                      {p.models.length > 0 ? (
                        <span className="font-mono text-slate-300">
                          {p.models
                            .slice(0, 6)
                            .map((m) => m.id)
                            .join(", ")}
                          {p.models.length > 6 ? ` (+${p.models.length - 6} more)` : ""}
                        </span>
                      ) : (
                        <span className="italic text-slate-500">
                          {p.implemented
                            ? "None confirmed yet — run Test Connection or Discover Models"
                            : "Unavailable until connector is configured"}
                        </span>
                      )}
                    </div>

                    {/* Non-Secret Provider Configuration Options */}
                    {draft && (isOllamaOrLm || isAzure || isDashScope || isOpenRouterPaid) && (
                      <div className="space-y-2.5 pt-3 border-t border-slate-800/70">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                          <Sliders className="w-3.5 h-3.5 text-blue-400" />
                          <span>Configuration Options</span>
                        </div>

                        {(isOllamaOrLm || isAzure) && (
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400 block">
                              {isAzure ? "Azure Resource Endpoint" : "Runtime Base URL"}
                            </label>
                            <input
                              type="text"
                              value={draft.customBaseUrl}
                              onChange={(e) =>
                                setDrafts({
                                  ...drafts,
                                  [p.id]: { ...draft, customBaseUrl: e.target.value },
                                })
                              }
                              placeholder={p.baseUrl}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                            />
                          </div>
                        )}

                        {isAzure && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-400 block">
                                Deployment Name
                              </label>
                              <input
                                type="text"
                                value={draft.azureDeployment}
                                onChange={(e) =>
                                  setDrafts({
                                    ...drafts,
                                    [p.id]: { ...draft, azureDeployment: e.target.value },
                                  })
                                }
                                placeholder="e.g. gpt-4o-prod"
                                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-400 block">
                                API Version
                              </label>
                              <input
                                type="text"
                                value={draft.azureApiVersion}
                                onChange={(e) =>
                                  setDrafts({
                                    ...drafts,
                                    [p.id]: { ...draft, azureApiVersion: e.target.value },
                                  })
                                }
                                placeholder="2024-10-21"
                                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {(isDashScope || isAzure) && (
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400 block">
                              {isAzure
                                ? "Additional Deployment Names (comma-separated)"
                                : "Custom Model IDs (comma-separated)"}
                            </label>
                            <input
                              type="text"
                              value={draft.customModelsText}
                              onChange={(e) =>
                                setDrafts({
                                  ...drafts,
                                  [p.id]: { ...draft, customModelsText: e.target.value },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                            />
                          </div>
                        )}

                        {isOpenRouterPaid && (
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-400 block">
                              Monthly USD Spending Cap
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={draft.openRouterMonthlyCapUsd}
                              onChange={(e) =>
                                setDrafts({
                                  ...drafts,
                                  [p.id]: {
                                    ...draft,
                                    openRouterMonthlyCapUsd: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono tabular-nums"
                            />
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSaveConfig(p)}
                          disabled={savingId === p.id}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-medium cursor-pointer"
                        >
                          {savingId === p.id ? "Saving..." : "Save Configuration"}
                        </button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/70">
                      <button
                        type="button"
                        onClick={() => handleTestConnection(p.id)}
                        disabled={testingId === p.id}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${testingId === p.id ? "animate-spin" : ""}`}
                        />
                        <span>
                          {testingId === p.id ? "Testing..." : "Test Connection"}
                        </span>
                      </button>

                      {p.implemented && (
                        <button
                          type="button"
                          onClick={() => handleDiscoverModels(p.id)}
                          disabled={discoveringId === p.id}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                        >
                          {discoveringId === p.id ? "Discovering..." : "Discover Models"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
