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
import { getMonthlyOpenRouterPaidSpendUsd } from "../store";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY || "";
  if (!key || key.includes("MY_")) return "";
  return key;
}

async function fetchAllOpenRouterModels(): Promise<AIModelInfo[]> {
  const headers: Record<string, string> = {};
  const key = getOpenRouterKey();
  if (key) headers.Authorization = `Bearer ${key}`;

  const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers,
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter model list failed (HTTP ${res.status})`);
  }
  const payload = (await res.json()) as { data?: any[] };
  const raw = Array.isArray(payload?.data) ? payload.data : [];

  return raw.map((m) => {
    const promptPrice = Number(m.pricing?.prompt || 0) * 1_000_000;
    const completionPrice = Number(m.pricing?.completion || 0) * 1_000_000;
    const isFree = String(m.id || "").endsWith(":free") || (promptPrice === 0 && completionPrice === 0);
    return {
      id: String(m.id),
      name: String(m.name || m.id),
      contextLength: m.context_length,
      isFree,
      pricingPromptPer1M: Number(promptPrice.toFixed(4)),
      pricingCompletionPer1M: Number(completionPrice.toFixed(4)),
    };
  });
}

function getOpenRouterHeaders(): Record<string, string> {
  const key = getOpenRouterKey();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not configured in Settings -> Secrets.");
  }
  return {
    Authorization: `Bearer ${key}`,
    "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
    "X-Title": "Career Engine - Slate AI",
  };
}

export const openRouterFreeAdapter: AIProviderAdapter = {
  id: "openrouter_free",
  displayName: "OpenRouter Free",
  category: "Cloud AI Providers",
  executionMode: "cloud",
  defaultBaseUrl: OPENROUTER_BASE_URL,
  authMethod: "OPENROUTER_API_KEY (Bearer Token, :free models only)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: ["OPENROUTER_API_KEY"],
  notes: "Strictly enforces :free model IDs. Never routes paid requests.",

  isConfigured: () => Boolean(getOpenRouterKey()),
  getEffectiveBaseUrl: () => OPENROUTER_BASE_URL,

  async discoverModels(): Promise<AIModelInfo[]> {
    const all = await fetchAllOpenRouterModels();
    return all.filter((m) => m.id.endsWith(":free")).slice(0, 60);
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured(config)) {
      return {
        ok: false,
        status: "unconfigured",
        message: "OPENROUTER_API_KEY is not set in Settings -> Secrets.",
        models: [],
        checkedAt,
      };
    }
    try {
      const models = await this.discoverModels(config);
      return {
        ok: true,
        status: "connected",
        message: `Connected to OpenRouter Free (${models.length} :free models discovered).`,
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "error",
        message: normalizeProviderError("OpenRouter Free", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams, _config, signal) {
    if (!params.model || !params.model.endsWith(":free")) {
      throw new Error(
        `OpenRouter Free only permits models ending in ":free". Received "${params.model || "none"}".`
      );
    }
    const headers = getOpenRouterHeaders();
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatCompletion({
      url: `${OPENROUTER_BASE_URL}/chat/completions`,
      headers,
      model: params.model,
      messages,
      temperature: params.temperature,
      signal,
    });
  },

  async streamChat(
    params: ChatCompletionParams,
    _config: ProviderRuntimeConfig,
    onDelta: (text: string) => void,
    signal?: AbortSignal
  ): Promise<ChatUsageReport> {
    if (!params.model || !params.model.endsWith(":free")) {
      throw new Error(
        `OpenRouter Free only permits models ending in ":free". Received "${params.model || "none"}".`
      );
    }
    const headers = getOpenRouterHeaders();
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatStream({
      url: `${OPENROUTER_BASE_URL}/chat/completions`,
      headers,
      model: params.model,
      messages,
      temperature: params.temperature,
      onDelta,
      signal,
    });
  },
};

const PRIORITY_PAID_IDS = [
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-pro",
];

function checkPaidCap(config: ProviderRuntimeConfig) {
  const cap = config.openRouterMonthlyCapUsd ?? 10;
  const spent = getMonthlyOpenRouterPaidSpendUsd();
  if (cap <= 0 || spent >= cap) {
    throw new Error(
      `OpenRouter Paid monthly spending cap reached ($${spent.toFixed(4)} / $${cap.toFixed(2)} USD). Increase cap in Settings -> APIs or switch to a free/local provider.`
    );
  }
}

export const openRouterPaidAdapter: AIProviderAdapter = {
  id: "openrouter_paid",
  displayName: "OpenRouter Paid",
  category: "Cloud AI Providers",
  executionMode: "cloud",
  defaultBaseUrl: OPENROUTER_BASE_URL,
  authMethod: "OPENROUTER_API_KEY (Bearer Token + Monthly USD Cap)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: ["OPENROUTER_API_KEY"],
  notes: "Supports paid third-party models (Claude, GPT, etc.) with monthly USD cap enforcement.",

  isConfigured: () => Boolean(getOpenRouterKey()),
  getEffectiveBaseUrl: () => OPENROUTER_BASE_URL,

  async discoverModels(): Promise<AIModelInfo[]> {
    const all = await fetchAllOpenRouterModels();
    const paid = all.filter((m) => !m.id.endsWith(":free"));
    // Put well-known paid frontier models first, then remaining paid models
    const prioritized = paid.filter((m) => PRIORITY_PAID_IDS.includes(m.id));
    const rest = paid.filter((m) => !PRIORITY_PAID_IDS.includes(m.id));
    return [...prioritized, ...rest].slice(0, 60);
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured(config)) {
      return {
        ok: false,
        status: "unconfigured",
        message: "OPENROUTER_API_KEY is not set in Settings -> Secrets.",
        models: [],
        checkedAt,
      };
    }
    try {
      const models = await this.discoverModels(config);
      const spent = getMonthlyOpenRouterPaidSpendUsd();
      const cap = config.openRouterMonthlyCapUsd ?? 10;
      return {
        ok: true,
        status: "connected",
        message: `Connected to OpenRouter Paid (${models.length} models). Monthly spend: $${spent.toFixed(4)} / $${cap.toFixed(2)}.`,
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "error",
        message: normalizeProviderError("OpenRouter Paid", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams, config: ProviderRuntimeConfig, signal?: AbortSignal) {
    checkPaidCap(config);
    const headers = getOpenRouterHeaders();
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    // Look up model pricing if available for cost estimation
    let promptPrice = 3;
    let completionPrice = 15;
    try {
      const models = await this.discoverModels(config);
      const match = models.find((m) => m.id === params.model);
      if (match) {
        promptPrice = match.pricingPromptPer1M ?? promptPrice;
        completionPrice = match.pricingCompletionPer1M ?? completionPrice;
      }
    } catch {
      // Proceed with fallback estimate if catalog lookup fails
    }

    return runOpenAICompatCompletion({
      url: `${OPENROUTER_BASE_URL}/chat/completions`,
      headers,
      model: params.model,
      messages,
      temperature: params.temperature,
      signal,
      pricePer1MPrompt: promptPrice,
      pricePer1MCompletion: completionPrice,
    });
  },

  async streamChat(
    params: ChatCompletionParams,
    config: ProviderRuntimeConfig,
    onDelta: (text: string) => void,
    signal?: AbortSignal
  ): Promise<ChatUsageReport> {
    checkPaidCap(config);
    const headers = getOpenRouterHeaders();
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);

    let promptPrice = 3;
    let completionPrice = 15;
    try {
      const models = await this.discoverModels(config);
      const match = models.find((m) => m.id === params.model);
      if (match) {
        promptPrice = match.pricingPromptPer1M ?? promptPrice;
        completionPrice = match.pricingCompletionPer1M ?? completionPrice;
      }
    } catch {
      // Fallback estimate
    }

    return runOpenAICompatStream({
      url: `${OPENROUTER_BASE_URL}/chat/completions`,
      headers,
      model: params.model,
      messages,
      temperature: params.temperature,
      onDelta,
      signal,
      pricePer1MPrompt: promptPrice,
      pricePer1MCompletion: completionPrice,
    });
  },
};
