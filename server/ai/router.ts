import express from "express";
import { AuthenticatedRequest } from "../firebaseStore";
import {
  AIModelInfo,
  AIProviderAdapter,
  ChatMessageInput,
  ConnectionState,
  ProviderPublicSnapshot,
  normalizeProviderError,
} from "./types";
import {
  getLiveDiscoveryState,
  getProviderConfig,
  getUsageSummary,
  hydrateAiStoreForUser,
  recordUsageEntry,
  resetUsageLogs,
  setAiStoreOwner,
  setLiveDiscoveryState,
  updateProviderConfig,
} from "./store";
import { geminiAdapter } from "./adapters/geminiAdapter";
import { buildUrlContextAddendum } from "./urlFetcher";
import { openRouterFreeAdapter, openRouterPaidAdapter } from "./adapters/openRouterAdapter";
import { dashscopeAdapter } from "./adapters/dashscopeAdapter";
import { azureOpenAIAdapter } from "./adapters/azureOpenAIAdapter";
import { anthropicAdapter } from "./adapters/anthropicAdapter";
import { lmStudioAdapter, ollamaAdapter } from "./adapters/localAdapters";
import {
  comfyUiAdapter,
  copilotEnterpriseAdapter,
  firebaseAiLogicAdapter,
  openClawAdapter,
  workerAiAdapter,
} from "./adapters/placeholderAdapters";

export const AI_ADAPTERS: AIProviderAdapter[] = [
  ollamaAdapter,
  lmStudioAdapter,
  geminiAdapter,
  openRouterFreeAdapter,
  openRouterPaidAdapter,
  dashscopeAdapter,
  azureOpenAIAdapter,
  anthropicAdapter,
  firebaseAiLogicAdapter,
  openClawAdapter,
  workerAiAdapter,
  comfyUiAdapter,
  copilotEnterpriseAdapter,
];

function getAdapterById(id: string): AIProviderAdapter | undefined {
  return AI_ADAPTERS.find((a) => a.id === id);
}

function buildSnapshot(adapter: AIProviderAdapter): ProviderPublicSnapshot {
  const config = getProviderConfig(adapter.id);
  const configured = adapter.isConfigured(config);
  const live = getLiveDiscoveryState(adapter.id);

  let status: ConnectionState = "unconfigured";
  let statusMessage = "Not configured";
  let models: AIModelInfo[] = [];

  if (!adapter.implemented) {
    status = config.enabled ? "unconfigured" : "disabled";
    statusMessage = adapter.notes;
  } else if (!config.enabled) {
    status = "disabled";
    statusMessage = "Disabled in Settings -> APIs";
  } else if (!configured) {
    status = "unconfigured";
    statusMessage = `Missing server credential(s): ${adapter.requiredEnvVars.join(", ")}`;
  } else if (live) {
    status = live.status;
    statusMessage = live.message;
    models = live.models;
  } else {
    // Before first probe: local runtimes must be probed before showing models as confirmed;
    // configured cloud providers show "ready" until probed.
    status = adapter.executionMode === "local" ? "offline" : "ready";
    statusMessage =
      adapter.executionMode === "local"
        ? "Click Test / Discover to check local runtime"
        : "Server secret configured. Ready to test or chat.";
    if (adapter.id === "gemini") {
      models = [
        { id: "gemini-4-hydrogen", name: "Gemini 4 Hydrogen (Fast / General)", isFree: true },
        { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", isFree: true },
      ];
    } else if (adapter.id === "dashscope") {
      models = Array.from(
        new Set(["qwen3.7-max", "qwen3.6-plus", "qwen3-coder-plus", ...(config.customModels || [])])
      ).map((id) => ({ id, name: id }));
    } else if (adapter.id === "azure_openai") {
      const deps = Array.from(
        new Set([config.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT || "", ...(config.customModels || [])].filter(Boolean))
      );
      models = deps.map((id) => ({ id, name: `Deployment: ${id}` }));
    }
  }

  return {
    id: adapter.id,
    displayName: adapter.displayName,
    category: adapter.category,
    executionMode: adapter.executionMode,
    baseUrl: adapter.getEffectiveBaseUrl(config),
    authMethod: adapter.authMethod,
    supportsStreaming: adapter.supportsStreaming,
    implemented: adapter.implemented,
    requiredEnvVars: adapter.requiredEnvVars,
    configured,
    enabled: config.enabled,
    status,
    statusMessage,
    models,
    notes: adapter.notes,
    config,
  };
}

export function createSlateAIRouter(): express.Router {
  const router = express.Router();

  router.use(async (req: AuthenticatedRequest, _res, next) => {
    if (req.uid) {
      const actor = { uid: req.uid, idToken: req.idToken };
      setAiStoreOwner(actor);
      await hydrateAiStoreForUser(actor);
    }
    next();
  });

  // 1. List all providers and current configuration/connection status
  router.get("/providers", (_req, res) => {
    res.json({
      providers: AI_ADAPTERS.map(buildSnapshot),
    });
  });

  // 2. Update non-secret provider configuration
  router.patch("/providers/:id", (req, res) => {
    const adapter = getAdapterById(req.params.id);
    if (!adapter) {
      return res.status(404).json({ error: `Unknown AI provider "${req.params.id}".` });
    }

    const {
      enabled,
      customBaseUrl,
      customModels,
      azureDeployment,
      azureApiVersion,
      openRouterMonthlyCapUsd,
    } = req.body || {};

    // Never allow unimplemented placeholders to pretend they are active routing providers
    const safeEnabled =
      !adapter.implemented && enabled === true ? false : enabled;

    updateProviderConfig(adapter.id, {
      enabled: safeEnabled,
      customBaseUrl,
      customModels,
      azureDeployment,
      azureApiVersion,
      openRouterMonthlyCapUsd,
    });

    res.json({
      provider: buildSnapshot(adapter),
      notice:
        !adapter.implemented && enabled === true
          ? `${adapter.displayName} remains disabled until an approved gateway/connector is configured.`
          : undefined,
    });
  });

  // 3. Test provider connection & discover models
  router.post("/providers/:id/test", async (req, res) => {
    const adapter = getAdapterById(req.params.id);
    if (!adapter) {
      return res.status(404).json({ error: `Unknown AI provider "${req.params.id}".` });
    }
    const config = getProviderConfig(adapter.id);
    const result = await adapter.testConnection(config);
    setLiveDiscoveryState(adapter.id, {
      status: result.status,
      message: result.message,
      models: result.models,
      checkedAt: result.checkedAt,
    });
    res.json({
      result,
      provider: buildSnapshot(adapter),
    });
  });

  // 4. Discover confirmed models for a provider
  router.get("/providers/:id/models", async (req, res) => {
    const adapter = getAdapterById(req.params.id);
    if (!adapter) {
      return res.status(404).json({ error: `Unknown AI provider "${req.params.id}".` });
    }
    const config = getProviderConfig(adapter.id);
    if (!adapter.implemented || !adapter.isConfigured(config)) {
      return res.json({
        ok: false,
        models: [],
        message: `${adapter.displayName} is not configured.`,
      });
    }

    try {
      const models = await adapter.discoverModels(config);
      setLiveDiscoveryState(adapter.id, {
        status: "connected",
        message: `Discovered ${models.length} model(s).`,
        models,
        checkedAt: new Date().toISOString(),
      });
      res.json({
        ok: true,
        models,
        provider: buildSnapshot(adapter),
      });
    } catch (err: any) {
      const message = normalizeProviderError(adapter.displayName, err);
      setLiveDiscoveryState(adapter.id, {
        status: adapter.executionMode === "local" ? "offline" : "error",
        message,
        models: [],
        checkedAt: new Date().toISOString(),
      });
      res.status(502).json({
        ok: false,
        models: [],
        error: message,
        provider: buildSnapshot(adapter),
      });
    }
  });

  // 5. Unified AI Chat & Streaming Endpoint (/api/ai/chat)
  router.post("/chat", async (req, res) => {
    const {
      providerId,
      model,
      messages,
      stream = true,
      systemPrompt,
      temperature,
    } = req.body || {};

    if (!providerId || typeof providerId !== "string") {
      return res.status(400).json({ error: "providerId is required." });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }

    const adapter = getAdapterById(providerId);
    if (!adapter) {
      return res.status(404).json({ error: `Provider "${providerId}" not found.` });
    }
    const config = getProviderConfig(adapter.id);

    if (!adapter.implemented) {
      return res.status(400).json({
        error: `${adapter.displayName} is not configured in this standalone workspace.`,
      });
    }
    if (!config.enabled) {
      return res.status(400).json({
        error: `${adapter.displayName} is currently disabled in Settings -> APIs.`,
      });
    }
    if (!adapter.isConfigured(config)) {
      return res.status(400).json({
        error: `${adapter.displayName} requires server secret(s): ${adapter.requiredEnvVars.join(", ")}.`,
      });
    }

    const cleanMessages: ChatMessageInput[] = messages.map((m: any) => ({
      role: m.role === "assistant" || m.role === "system" ? m.role : "user",
      content: String(m.content || ""),
      attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
    }));

    const latestUserMsg = [...cleanMessages].reverse().find((m) => m.role === "user");
    const urlAddendum = latestUserMsg ? await buildUrlContextAddendum(latestUserMsg.content) : "";
    const effectiveSystemPrompt = [
      typeof systemPrompt === "string" ? systemPrompt : "",
      urlAddendum,
    ]
      .filter(Boolean)
      .join("\n\n") || undefined;

    const abortController = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const useStream = Boolean(stream && adapter.supportsStreaming);

    if (useStream) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const sendEvent = (payload: Record<string, any>) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
      };

      try {
        const usage = await adapter.streamChat(
          {
            model: String(model || ""),
            messages: cleanMessages,
            systemPrompt: effectiveSystemPrompt,
            temperature: typeof temperature === "number" ? temperature : undefined,
          },
          config,
          (delta) => sendEvent({ type: "delta", text: delta }),
          abortController.signal
        );

        recordUsageEntry({
          providerId: adapter.id,
          providerName: adapter.displayName,
          model: String(model || "default"),
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          estimatedCostUsd: usage.estimatedCostUsd,
          success: true,
        });

        sendEvent({ type: "usage", usage });
        sendEvent({ type: "done" });
        res.end();
      } catch (err: any) {
        const errorMsg = normalizeProviderError(adapter.displayName, err);
        recordUsageEntry({
          providerId: adapter.id,
          providerName: adapter.displayName,
          model: String(model || "default"),
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          success: false,
          errorMessage: errorMsg,
        });
        sendEvent({ type: "error", error: errorMsg });
        res.end();
      }
      return;
    }

    // Non-streaming JSON response
    try {
      const result = await adapter.completeChat(
        {
          model: String(model || ""),
          messages: cleanMessages,
          systemPrompt: effectiveSystemPrompt,
          temperature: typeof temperature === "number" ? temperature : undefined,
        },
        config,
        abortController.signal
      );

      recordUsageEntry({
        providerId: adapter.id,
        providerName: adapter.displayName,
        model: String(model || "default"),
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        estimatedCostUsd: result.usage.estimatedCostUsd,
        success: true,
      });

      res.json({
        providerId: adapter.id,
        model: String(model || "default"),
        content: result.content,
        usage: result.usage,
      });
    } catch (err: any) {
      const errorMsg = normalizeProviderError(adapter.displayName, err);
      recordUsageEntry({
        providerId: adapter.id,
        providerName: adapter.displayName,
        model: String(model || "default"),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        success: false,
        errorMessage: errorMsg,
      });
      res.status(502).json({ error: errorMsg });
    }
  });

  // 6. Usage & Cost Tracking Endpoints
  router.get("/usage", (_req, res) => {
    res.json(getUsageSummary());
  });

  router.post("/usage/reset", (_req, res) => {
    resetUsageLogs();
    res.json({ ok: true, usage: getUsageSummary() });
  });

  return router;
}
