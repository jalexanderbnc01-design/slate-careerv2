import {
  AIModelInfo,
  AIProviderAdapter,
  ChatCompletionParams,
  ChatUsageReport,
  ExecutionMode,
  ProviderCategory,
  ProviderRuntimeConfig,
} from "../types";

function createDisabledIntegrationAdapter(spec: {
  id: string;
  displayName: string;
  category: ProviderCategory;
  executionMode: ExecutionMode;
  defaultBaseUrl: string;
  authMethod: string;
  requiredEnvVars: string[];
  notes: string;
  defaultModelId?: string;
}): AIProviderAdapter {
  const unavailableMsg = `${spec.displayName} is disabled/not configured in this standalone Career Engine instance. Provide its approved gateway or connector configuration before enabling.`;

  return {
    id: spec.id,
    displayName: spec.displayName,
    category: spec.category,
    executionMode: spec.executionMode,
    defaultBaseUrl: spec.defaultBaseUrl,
    authMethod: spec.authMethod,
    supportsStreaming: false,
    implemented: false,
    requiredEnvVars: spec.requiredEnvVars,
    notes: spec.notes,

    isConfigured: () => false,
    getEffectiveBaseUrl: (config: ProviderRuntimeConfig) =>
      config.customBaseUrl || spec.defaultBaseUrl,

    async discoverModels(): Promise<AIModelInfo[]> {
      return [];
    },

    async testConnection() {
      return {
        ok: false,
        status: "unconfigured",
        message: unavailableMsg,
        models: [],
        checkedAt: new Date().toISOString(),
      };
    },

    async completeChat(_params: ChatCompletionParams): Promise<{ content: string; usage: ChatUsageReport }> {
      throw new Error(unavailableMsg);
    },

    async streamChat(): Promise<ChatUsageReport> {
      throw new Error(unavailableMsg);
    },
  };
}

export const openClawAdapter = createDisabledIntegrationAdapter({
  id: "openclaw",
  displayName: "OpenClaw",
  category: "Agent and Tool Runtimes",
  executionMode: "agent",
  defaultBaseUrl: "Not configured (Slate Desktop gateway)",
  authMethod: "OpenClaw Gateway Token (openclaw/main)",
  requiredEnvVars: ["OPENCLAW_GATEWAY_URL", "OPENCLAW_GATEWAY_TOKEN"],
  notes: "Distinct agent/tool runtime (openclaw/main). Disabled until connected to Slate Desktop OpenClaw gateway.",
});

export const comfyUiAdapter = createDisabledIntegrationAdapter({
  id: "comfyui",
  displayName: "ComfyUI",
  category: "Image Generation",
  executionMode: "image",
  defaultBaseUrl: "Not configured (Local ComfyUI workflow endpoint)",
  authMethod: "Local Workflow Endpoint",
  requiredEnvVars: ["COMFYUI_BASE_URL"],
  notes: "Image-generation workflow runtime kept separate from text chat. Disabled until ComfyUI server URL is configured.",
});

export const copilotEnterpriseAdapter = createDisabledIntegrationAdapter({
  id: "copilot_enterprise",
  displayName: "GitHub Copilot Enterprise",
  category: "Enterprise Connectors",
  executionMode: "enterprise",
  defaultBaseUrl: "Not configured (Approved Enterprise Connector)",
  authMethod: "Approved Enterprise Tenant Connector",
  requiredEnvVars: ["COPILOT_ENTERPRISE_ENDPOINT", "COPILOT_ENTERPRISE_TOKEN"],
  notes: "Disabled by default. Activates only with an approved enterprise connector (never personal Copilot sessions).",
});

export const workerAiAdapter = createDisabledIntegrationAdapter({
  id: "worker_ai",
  displayName: "Worker AI",
  category: "Agent and Tool Runtimes",
  executionMode: "agent",
  defaultBaseUrl: "Not configured (Approved Worker AI Gateway)",
  authMethod: "Worker Gateway Credentials",
  requiredEnvVars: ["WORKER_AI_GATEWAY_URL", "WORKER_AI_TOKEN"],
  notes: "Disabled placeholder awaiting an explicit Worker AI gateway endpoint configuration.",
});

export const firebaseAiLogicAdapter = createDisabledIntegrationAdapter({
  id: "firebase_ai_logic",
  displayName: "Firebase AI Logic",
  category: "Cloud AI Providers",
  executionMode: "cloud",
  defaultBaseUrl: "Not configured (Firebase App / SDK Auth)",
  authMethod: "Firebase App Check & Auth SDK",
  requiredEnvVars: ["FIREBASE_PROJECT_ID"],
  notes: "Kept separate from direct Gemini API key routing. Disabled until Firebase AI Logic SDK is provisioned.",
});
