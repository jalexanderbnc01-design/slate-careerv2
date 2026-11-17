import {
  AIModelInfo,
  AIProviderAdapter,
  ChatCompletionParams,
  ChatUsageReport,
  ProviderRuntimeConfig,
  normalizeProviderError,
} from "../types";
import { formatMessagesWithAttachments } from "../openaiCompat";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

const FALLBACK_CLAUDE_MODELS: AIModelInfo[] = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
];

function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY || "";
  if (!key || key.includes("MY_")) return "";
  return key;
}

export const anthropicAdapter: AIProviderAdapter = {
  id: "anthropic",
  displayName: "Anthropic Claude",
  category: "Cloud AI Providers",
  executionMode: "cloud",
  defaultBaseUrl: ANTHROPIC_BASE_URL,
  authMethod: "ANTHROPIC_API_KEY (x-api-key header)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: ["ANTHROPIC_API_KEY"],
  notes: "Official Anthropic Messages API with streaming and model discovery.",

  isConfigured: () => Boolean(getAnthropicKey()),
  getEffectiveBaseUrl: () => ANTHROPIC_BASE_URL,

  async discoverModels(): Promise<AIModelInfo[]> {
    const key = getAnthropicKey();
    if (!key) return [];
    try {
      const res = await fetch(`${ANTHROPIC_BASE_URL}/models`, {
        headers: {
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const payload = (await res.json()) as { data?: any[] };
        const live = (payload.data || []).map((m) => ({
          id: String(m.id),
          name: String(m.display_name || m.id),
        }));
        if (live.length > 0) return live;
      }
    } catch {
      // Fallback to official curated models when key exists
    }
    return FALLBACK_CLAUDE_MODELS;
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    const key = getAnthropicKey();
    if (!key) {
      return {
        ok: false,
        status: "unconfigured",
        message: "ANTHROPIC_API_KEY is not set in Settings -> Secrets.",
        models: [],
        checkedAt,
      };
    }

    try {
      const res = await fetch(`${ANTHROPIC_BASE_URL}/models`, {
        headers: {
          "x-api-key": key,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(`HTTP ${res.status} Unauthorized`);
      }
      const models = await this.discoverModels(config);
      return {
        ok: true,
        status: "connected",
        message: `Connected to Anthropic Claude (${models.length} models).`,
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "error",
        message: normalizeProviderError("Anthropic Claude", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams, _config, signal) {
    const key = getAnthropicKey();
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured in Settings -> Secrets.");

    const formatted = formatMessagesWithAttachments(params.messages);
    const messages = formatted
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: params.model || FALLBACK_CLAUDE_MODELS[0].id,
        max_tokens: 4096,
        ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
        messages,
      }),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as any;
    const text = Array.isArray(data.content)
      ? data.content.map((b: any) => b.text || "").join("")
      : "";
    const promptTokens = Number(data?.usage?.input_tokens || 0);
    const completionTokens = Number(data?.usage?.output_tokens || 0);

    return {
      content: text,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: Number(
          ((promptTokens / 1_000_000) * 3 + (completionTokens / 1_000_000) * 15).toFixed(6)
        ),
      },
    };
  },

  async streamChat(
    params: ChatCompletionParams,
    _config: ProviderRuntimeConfig,
    onDelta: (text: string) => void,
    signal?: AbortSignal
  ): Promise<ChatUsageReport> {
    const key = getAnthropicKey();
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured in Settings -> Secrets.");

    const formatted = formatMessagesWithAttachments(params.messages);
    const messages = formatted
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch(`${ANTHROPIC_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: params.model || FALLBACK_CLAUDE_MODELS[0].id,
        max_tokens: 4096,
        stream: true,
        ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
        messages,
      }),
      signal,
    });

    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let promptTokens = 0;
    let completionTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const dataStr = line.slice(5).trim();
        try {
          const evt = JSON.parse(dataStr);
          if (evt.type === "message_start" && evt.message?.usage) {
            promptTokens = Number(evt.message.usage.input_tokens || 0);
          } else if (evt.type === "content_block_delta" && evt.delta?.text) {
            onDelta(evt.delta.text);
          } else if (evt.type === "message_delta" && evt.usage) {
            completionTokens = Number(evt.usage.output_tokens || completionTokens);
          }
        } catch {
          // Ignore partial SSE lines
        }
      }
    }

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUsd: Number(
        ((promptTokens / 1_000_000) * 3 + (completionTokens / 1_000_000) * 15).toFixed(6)
      ),
    };
  },
};
