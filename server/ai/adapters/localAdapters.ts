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

const DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434";
const DEFAULT_LM_STUDIO_BASE = "http://127.0.0.1:1234/v1";

function getOllamaBase(config: ProviderRuntimeConfig): string {
  return (config.customBaseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE).replace(
    /\/$/,
    ""
  );
}

function getLmStudioBase(config: ProviderRuntimeConfig): string {
  return (config.customBaseUrl || process.env.LM_STUDIO_BASE_URL || DEFAULT_LM_STUDIO_BASE).replace(
    /\/$/,
    ""
  );
}

export const ollamaAdapter: AIProviderAdapter = {
  id: "ollama",
  displayName: "Ollama",
  category: "Local AI Runtimes",
  executionMode: "local",
  defaultBaseUrl: DEFAULT_OLLAMA_BASE,
  authMethod: "Local Runtime (No credentials required)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: [],
  notes: "Discovers locally installed models via /api/tags and streams via /v1/chat/completions. Supports offline operation.",

  isConfigured: () => true,
  getEffectiveBaseUrl: getOllamaBase,

  async discoverModels(config: ProviderRuntimeConfig): Promise<AIModelInfo[]> {
    const base = getOllamaBase(config);
    const res = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) {
      throw new Error(`Ollama /api/tags returned HTTP ${res.status}`);
    }
    const payload = (await res.json()) as { models?: any[] };
    const list = Array.isArray(payload?.models) ? payload.models : [];
    return list.map((m) => ({
      id: String(m.name || m.model),
      name: String(m.name || m.model),
      isFree: true,
    }));
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    try {
      const models = await this.discoverModels(config);
      return {
        ok: true,
        status: "connected",
        message:
          models.length > 0
            ? `Ollama running (${models.length} local model(s) installed).`
            : "Ollama running, but 0 models are installed yet.",
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "offline",
        message: normalizeProviderError("Ollama", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams, config: ProviderRuntimeConfig, signal?: AbortSignal) {
    const base = getOllamaBase(config);
    if (!params.model) throw new Error("Select a confirmed Ollama model before sending.");
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatCompletion({
      url: `${base}/v1/chat/completions`,
      headers: {},
      model: params.model,
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
    const base = getOllamaBase(config);
    if (!params.model) throw new Error("Select a confirmed Ollama model before sending.");
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatStream({
      url: `${base}/v1/chat/completions`,
      headers: {},
      model: params.model,
      messages,
      temperature: params.temperature,
      onDelta,
      signal,
    });
  },
};

export const lmStudioAdapter: AIProviderAdapter = {
  id: "lm_studio",
  displayName: "LM Studio",
  category: "Local AI Runtimes",
  executionMode: "local",
  defaultBaseUrl: DEFAULT_LM_STUDIO_BASE,
  authMethod: "Local Runtime (No credentials required)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: [],
  notes: "Detects local LM Studio server at /v1/models and streams via /v1/chat/completions.",

  isConfigured: () => true,
  getEffectiveBaseUrl: getLmStudioBase,

  async discoverModels(config: ProviderRuntimeConfig): Promise<AIModelInfo[]> {
    const base = getLmStudioBase(config);
    const res = await fetch(`${base}/models`, {
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) {
      throw new Error(`LM Studio /models returned HTTP ${res.status}`);
    }
    const payload = (await res.json()) as { data?: any[] };
    const list = Array.isArray(payload?.data) ? payload.data : [];
    return list.map((m) => ({
      id: String(m.id),
      name: String(m.id),
      isFree: true,
    }));
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    try {
      const models = await this.discoverModels(config);
      return {
        ok: true,
        status: "connected",
        message:
          models.length > 0
            ? `LM Studio server online (${models.length} model(s) loaded).`
            : "LM Studio online, but no model is currently loaded.",
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "offline",
        message: normalizeProviderError("LM Studio", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams, config: ProviderRuntimeConfig, signal?: AbortSignal) {
    const base = getLmStudioBase(config);
    if (!params.model) throw new Error("Select a confirmed LM Studio model before sending.");
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatCompletion({
      url: `${base}/chat/completions`,
      headers: {},
      model: params.model,
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
    const base = getLmStudioBase(config);
    if (!params.model) throw new Error("Select a confirmed LM Studio model before sending.");
    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatStream({
      url: `${base}/chat/completions`,
      headers: {},
      model: params.model,
      messages,
      temperature: params.temperature,
      onDelta,
      signal,
    });
  },
};
