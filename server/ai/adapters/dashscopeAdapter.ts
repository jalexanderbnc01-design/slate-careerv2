import {
  AIModelInfo,
  AIProviderAdapter,
  ChatCompletionParams,
  ChatUsageReport,
  ProviderRuntimeConfig,
  normalizeProviderError,
} from "../types";
import {
  formatMessagesWithAttachments,
  runOpenAICompatCompletion,
  runOpenAICompatStream,
} from "../openaiCompat";

const DASHSCOPE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const INITIAL_DASHSCOPE_MODELS = ["qwen3.7-max", "qwen3.6-plus", "qwen3-coder-plus"];

function getDashScopeKey(): string {
  const key = process.env.DASHSCOPE_API_KEY || "";
  if (!key || key.includes("MY_")) return "";
  return key;
}

export const dashscopeAdapter: AIProviderAdapter = {
  id: "dashscope",
  displayName: "Alibaba Cloud DashScope",
  category: "Cloud AI Providers",
  executionMode: "cloud",
  defaultBaseUrl: DASHSCOPE_BASE_URL,
  authMethod: "DASHSCOPE_API_KEY (Bearer Token)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: ["DASHSCOPE_API_KEY"],
  notes: "OpenAI-compatible endpoint. Additional models configurable in Settings -> APIs.",

  isConfigured: () => Boolean(getDashScopeKey()),
  getEffectiveBaseUrl: (config) => config.customBaseUrl || DASHSCOPE_BASE_URL,

  async discoverModels(config: ProviderRuntimeConfig): Promise<AIModelInfo[]> {
    const configuredIds = Array.from(
      new Set([...INITIAL_DASHSCOPE_MODELS, ...(config.customModels || [])])
    );
    const key = getDashScopeKey();
    const base = this.getEffectiveBaseUrl(config).replace(/\/$/, "");

    if (key) {
      try {
        const res = await fetch(`${base}/models`, {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const payload = (await res.json()) as { data?: any[] };
          const liveIds = (payload.data || []).map((m) => String(m.id)).filter(Boolean);
          const merged = Array.from(new Set([...configuredIds, ...liveIds]));
          return merged.map((id) => ({ id, name: id }));
        }
      } catch {
        // Fallback to configured list if /models is unavailable
      }
    }

    return configuredIds.map((id) => ({ id, name: id }));
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    const key = getDashScopeKey();
    if (!key) {
      return {
        ok: false,
        status: "unconfigured",
        message: "DASHSCOPE_API_KEY is not set in Settings -> Secrets.",
        models: [],
        checkedAt,
      };
    }

    const base = this.getEffectiveBaseUrl(config).replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok && res.status === 401) {
        throw new Error("HTTP 401 Unauthorized");
      }
      const models = await this.discoverModels(config);
      return {
        ok: true,
        status: "connected",
        message: `Connected to DashScope (${models.length} models ready).`,
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "error",
        message: normalizeProviderError("DashScope", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams, config: ProviderRuntimeConfig, signal?: AbortSignal) {
    const key = getDashScopeKey();
    if (!key) throw new Error("DASHSCOPE_API_KEY is not configured in Settings -> Secrets.");
    const base = this.getEffectiveBaseUrl(config).replace(/\/$/, "");
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);

    return runOpenAICompatCompletion({
      url: `${base}/chat/completions`,
      headers: { Authorization: `Bearer ${key}` },
      model: params.model || INITIAL_DASHSCOPE_MODELS[0],
      messages,
      temperature: params.temperature,
      signal,
    });
  },

  async streamChat(
    params: ChatCompletionParams,
    config: ProviderRuntimeConfig,
    onDelta: (text: string) => void,
    signal?: AbortSignal
  ): Promise<ChatUsageReport> {
    const key = getDashScopeKey();
    if (!key) throw new Error("DASHSCOPE_API_KEY is not configured in Settings -> Secrets.");
    const base = this.getEffectiveBaseUrl(config).replace(/\/$/, "");
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);

    return runOpenAICompatStream({
      url: `${base}/chat/completions`,
      headers: { Authorization: `Bearer ${key}` },
      model: params.model || INITIAL_DASHSCOPE_MODELS[0],
      messages,
      temperature: params.temperature,
      onDelta,
      signal,
    });
  },
};
