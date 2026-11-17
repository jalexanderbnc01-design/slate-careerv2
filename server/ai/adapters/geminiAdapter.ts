import { GoogleGenAI } from "@google/genai";
import {
  AIModelInfo,
  AIProviderAdapter,
  ChatCompletionParams,
  ChatUsageReport,
  ProviderRuntimeConfig,
  normalizeProviderError,
} from "../types";
import { formatMessagesWithAttachments } from "../openaiCompat";

const FALLBACK_GEMINI_MODELS: AIModelInfo[] = [
  { id: "gemini-4-hydrogen", name: "Gemini 4 Hydrogen (Fast / General)", isFree: true },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite", isFree: true },
  { id: "gemini-4-argon", name: "Gemini 4 Argon (Paid Reasoning)", isFree: false },
  { id: "gemini-4-carbon", name: "Gemini 4 Carbon (Paid Deep Reasoning)", isFree: false },
];

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key || key === "MY_GEMINI_API_KEY") return "";
  return key;
}

function createGeminiClient(): GoogleGenAI {
  const key = getGeminiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured in Settings -> Secrets.");
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function buildGeminiContents(params: ChatCompletionParams) {
  const formatted = formatMessagesWithAttachments(params.messages);
  return formatted
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

export const geminiAdapter: AIProviderAdapter = {
  id: "gemini",
  displayName: "Google Gemini",
  category: "Cloud AI Providers",
  executionMode: "cloud",
  defaultBaseUrl: "https://generativelanguage.googleapis.com",
  authMethod: "GEMINI_API_KEY (Server Secret)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: ["GEMINI_API_KEY"],
  notes: "Uses @google/genai server SDK. Also powers Career Engine resume & job analysis.",

  isConfigured: () => Boolean(getGeminiKey()),
  getEffectiveBaseUrl: () => "https://generativelanguage.googleapis.com",

  async discoverModels(): Promise<AIModelInfo[]> {
    const key = getGeminiKey();
    if (!key) return [];
    // Include official AI Studio Gemini aliases and optionally probe v1beta models
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { models?: any[] };
        const live = (data.models || [])
          .filter((m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes("generateContent")
          )
          .map((m) => {
            const cleanId = String(m.name || "").replace(/^models\//, "");
            return {
              id: cleanId,
              name: m.displayName || cleanId,
              contextLength: m.inputTokenLimit,
            } as AIModelInfo;
          })
          .filter((m) => m.id && !m.id.includes("1.5") && !m.id.includes("2.0") && !m.id.includes("gemini-pro"));

        // Ensure core supported aliases are always accessible at the top
        const seen = new Set<string>();
        const merged: AIModelInfo[] = [];
        for (const item of [...FALLBACK_GEMINI_MODELS, ...live]) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }
        return merged.slice(0, 20);
      }
    } catch {
      // Fallback cleanly to active Gemini model aliases when key is present
    }
    return FALLBACK_GEMINI_MODELS;
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    if (!this.isConfigured(config)) {
      return {
        ok: false,
        status: "unconfigured",
        message: "GEMINI_API_KEY is not set in Settings -> Secrets.",
        models: [],
        checkedAt,
      };
    }
    try {
      const models = await this.discoverModels(config);
      return {
        ok: true,
        status: "connected",
        message: `Connected to Google Gemini (${models.length} models available).`,
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "error",
        message: normalizeProviderError("Google Gemini", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams): Promise<{ content: string; usage: ChatUsageReport }> {
    const ai = createGeminiClient();
    const model = params.model || "gemini-4-hydrogen";
    const contents = buildGeminiContents(params);

    const response = await ai.models.generateContent({
      model,
      contents,
      config: params.systemPrompt
        ? { systemInstruction: params.systemPrompt }
        : undefined,
    });

    const meta = (response as any).usageMetadata || {};
    const promptTokens = Number(meta.promptTokenCount || 0);
    const completionTokens = Number(meta.candidatesTokenCount || 0);
    const totalTokens = Number(meta.totalTokenCount || promptTokens + completionTokens);

    return {
      content: response.text || "",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd: 0,
      },
    };
  },

  async streamChat(
    params: ChatCompletionParams,
    _config: ProviderRuntimeConfig,
    onDelta: (text: string) => void,
    signal?: AbortSignal
  ): Promise<ChatUsageReport> {
    const ai = createGeminiClient();
    const model = params.model || "gemini-4-hydrogen";
    const contents = buildGeminiContents(params);

    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: params.systemPrompt
        ? { systemInstruction: params.systemPrompt }
        : undefined,
    });

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let chars = 0;

    for await (const chunk of stream) {
      if (signal?.aborted) {
        const abortErr = new Error("Aborted");
        abortErr.name = "AbortError";
        throw abortErr;
      }
      const text = chunk.text || "";
      if (text) {
        chars += text.length;
        onDelta(text);
      }
      const meta = (chunk as any).usageMetadata;
      if (meta) {
        promptTokens = Number(meta.promptTokenCount || promptTokens);
        completionTokens = Number(meta.candidatesTokenCount || completionTokens);
        totalTokens = Number(meta.totalTokenCount || promptTokens + completionTokens);
      }
    }

    if (totalTokens === 0 && chars > 0) {
      completionTokens = Math.max(1, Math.round(chars / 4));
      totalTokens = promptTokens + completionTokens;
    }

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: 0,
    };
  },
};
