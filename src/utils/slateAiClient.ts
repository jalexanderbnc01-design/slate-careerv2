import { authFetch } from "../firebase/client";
export type ProviderCategory =
  | "Local AI Runtimes"
  | "Cloud AI Providers"
  | "Agent and Tool Runtimes"
  | "Image Generation"
  | "Enterprise Connectors";

export type ExecutionMode = "local" | "cloud" | "agent" | "image" | "enterprise";

export type ConnectionState =
  | "connected"
  | "ready"
  | "offline"
  | "unconfigured"
  | "disabled"
  | "error";

export interface AIModelInfo {
  id: string;
  name: string;
  contextLength?: number;
  isFree?: boolean;
  pricingPromptPer1M?: number;
  pricingCompletionPer1M?: number;
}

export interface ProviderRuntimeConfig {
  enabled: boolean;
  customBaseUrl?: string;
  customModels?: string[];
  azureDeployment?: string;
  azureApiVersion?: string;
  openRouterMonthlyCapUsd?: number;
}

export interface ProviderSnapshot {
  id: string;
  displayName: string;
  category: ProviderCategory;
  executionMode: ExecutionMode;
  baseUrl: string;
  authMethod: string;
  supportsStreaming: boolean;
  implemented: boolean;
  requiredEnvVars: string[];
  configured: boolean;
  enabled: boolean;
  status: ConnectionState;
  statusMessage: string;
  models: AIModelInfo[];
  notes: string;
  config: ProviderRuntimeConfig;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  content: string;
}

export interface XelimeProposedAction {
  id: string;
  tool: string;
  title: string;
  division: "Architecture" | "Visualization" | "Digital";
  software: string[];
  summary: string;
  status: "pending" | "approved" | "dismissed";
}

export interface NotionProposedToolAction {
  id: string;
  action: "create_page" | "update_page" | "bulk_sync";
  title: string;
  targetId: string;
  targetType: "database" | "page";
  properties?: Record<string, any>;
  contentParagraphs?: string[];
  expectedLastEditedTime?: string;
  summary: string;
  isBulk?: boolean;
  status: "pending" | "approved" | "dismissed";
  resultUrl?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  providerId?: string;
  providerName?: string;
  model?: string;
  mode?: string;
  level?: 1 | 2 | 3;
  levelLabel?: string;
  proposedAction?: XelimeProposedAction;
  notionToolAction?: NotionProposedToolAction;
  notionSources?: { id: string; title: string; objectType: "page" | "database" }[];
  attachments?: ChatAttachment[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  error?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  updatedAt: string;
  providerId: string;
  model: string;
  messages: ChatMessage[];
}

export interface UsageSummaryResponse {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  openRouterPaidMonthlySpendUsd: number;
  openRouterPaidMonthlyCapUsd: number;
  byProvider: {
    providerId: string;
    providerName: string;
    requests: number;
    failures: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }[];
  recentLogs: {
    id: string;
    timestamp: string;
    providerId: string;
    providerName: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    success: boolean;
    errorMessage?: string;
  }[];
}

export async function fetchAIProviders(): Promise<ProviderSnapshot[]> {
  const res = await authFetch("/api/ai/providers");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load AI providers.");
  return data.providers || [];
}

export async function updateAIProviderConfig(
  providerId: string,
  patch: Partial<ProviderRuntimeConfig>
): Promise<{ provider: ProviderSnapshot; notice?: string }> {
  const res = await fetch(`/api/ai/providers/${encodeURIComponent(providerId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to update provider settings.");
  return data;
}

export async function testAIProviderConnection(providerId: string): Promise<{
  result: {
    ok: boolean;
    status: ConnectionState;
    message: string;
    models: AIModelInfo[];
    checkedAt: string;
  };
  provider: ProviderSnapshot;
}> {
  const res = await fetch(`/api/ai/providers/${encodeURIComponent(providerId)}/test`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Connection test failed.");
  return data;
}

export async function discoverAIProviderModels(providerId: string): Promise<{
  ok: boolean;
  models: AIModelInfo[];
  provider?: ProviderSnapshot;
  error?: string;
}> {
  const res = await fetch(`/api/ai/providers/${encodeURIComponent(providerId)}/models`);
  const data = await res.json();
  return data;
}

export async function fetchAIUsage(): Promise<UsageSummaryResponse> {
  const res = await authFetch("/api/ai/usage");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load AI usage metrics.");
  return data;
}

export async function resetAIUsage(): Promise<UsageSummaryResponse> {
  const res = await authFetch("/api/ai/usage/reset", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to reset usage logs.");
  return data.usage;
}

export async function sendSlateAIChat(params: {
  providerId: string;
  model: string;
  messages: { role: "user" | "assistant"; content: string; attachments?: ChatAttachment[] }[];
  stream: boolean;
  systemPrompt?: string;
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  onUsage?: (usage: NonNullable<ChatMessage["usage"]>) => void;
}): Promise<{ content: string; usage?: ChatMessage["usage"] }> {
  const res = await authFetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: params.providerId,
      model: params.model,
      messages: params.messages,
      stream: params.stream,
      systemPrompt: params.systemPrompt,
    }),
    signal: params.signal,
  });

  const contentType = res.headers.get("content-type") || "";
  if (!res.ok && !contentType.includes("text/event-stream")) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error || `Request failed with HTTP ${res.status}`);
  }

  if (contentType.includes("text/event-stream") && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";
    let finalUsage: ChatMessage["usage"] | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        const evt = JSON.parse(jsonStr);
        if (evt.type === "delta" && typeof evt.text === "string") {
          fullText += evt.text;
          params.onDelta?.(evt.text);
        } else if (evt.type === "usage" && evt.usage) {
          finalUsage = evt.usage;
          params.onUsage?.(evt.usage);
        } else if (evt.type === "error") {
          throw new Error(evt.error || "Provider stream error");
        }
      }
    }

    return { content: fullText, usage: finalUsage };
  }

  const json = await res.json();
  return { content: json.content || "", usage: json.usage };
}
