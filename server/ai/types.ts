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

export interface ChatAttachment {
  name: string;
  mimeType: string;
  content: string;
}

export interface ChatMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessageInput[];
  systemPrompt?: string;
  temperature?: number;
}

export interface ChatUsageReport {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface ProviderTestResult {
  ok: boolean;
  status: ConnectionState;
  message: string;
  models: AIModelInfo[];
  checkedAt: string;
}

export interface AIProviderAdapter {
  id: string;
  displayName: string;
  category: ProviderCategory;
  executionMode: ExecutionMode;
  defaultBaseUrl: string;
  authMethod: string;
  supportsStreaming: boolean;
  implemented: boolean;
  requiredEnvVars: string[];
  notes: string;
  isConfigured: (config: ProviderRuntimeConfig) => boolean;
  getEffectiveBaseUrl: (config: ProviderRuntimeConfig) => string;
  discoverModels: (config: ProviderRuntimeConfig) => Promise<AIModelInfo[]>;
  testConnection: (config: ProviderRuntimeConfig) => Promise<ProviderTestResult>;
  completeChat: (
    params: ChatCompletionParams,
    config: ProviderRuntimeConfig,
    signal?: AbortSignal
  ) => Promise<{ content: string; usage: ChatUsageReport }>;
  streamChat: (
    params: ChatCompletionParams,
    config: ProviderRuntimeConfig,
    onDelta: (text: string) => void,
    signal?: AbortSignal
  ) => Promise<ChatUsageReport>;
}

export interface ProviderPublicSnapshot {
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

export interface UsageLogEntry {
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
}

export function normalizeProviderError(providerName: string, err: any): string {
  const raw = String(err?.message || err || "Unknown provider error");
  // Redact any bearer tokens or key-like strings if present in upstream messages
  const sanitized = raw
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");

  if (err?.name === "AbortError" || sanitized.toLowerCase().includes("aborted")) {
    return "Generation stopped by user.";
  }
  if (sanitized.includes("ECONNREFUSED") || sanitized.includes("fetch failed")) {
    return `${providerName} server is unreachable. Verify the local runtime is running and accessible.`;
  }
  if (sanitized.includes("429")) {
    return `${providerName} rate limit exceeded (HTTP 429). Wait a moment or switch to another provider.`;
  }
  if (sanitized.includes("401") || sanitized.includes("403")) {
    return `${providerName} authentication failed. Verify the server secret in Settings -> Secrets.`;
  }
  return sanitized;
}
