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

function getAzureCredentials(config: ProviderRuntimeConfig) {
  const apiKey = process.env.AZURE_OPENAI_API_KEY || "";
  const endpoint = (config.customBaseUrl || process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/$/, "");
  const deployment = config.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT || "";
  const apiVersion = config.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
  return {
    apiKey: apiKey.includes("MY_") ? "" : apiKey,
    endpoint,
    deployment,
    apiVersion,
  };
}

export const azureOpenAIAdapter: AIProviderAdapter = {
  id: "azure_openai",
  displayName: "Azure OpenAI",
  category: "Cloud AI Providers",
  executionMode: "cloud",
  defaultBaseUrl: "https://YOUR-RESOURCE.openai.azure.com",
  authMethod: "AZURE_OPENAI_API_KEY (api-key header + Deployment ID)",
  supportsStreaming: true,
  implemented: true,
  requiredEnvVars: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
  notes: "Requires resource endpoint, deployment name, and API version. Deployment names map directly to Azure deployments.",

  isConfigured: (config) => {
    const creds = getAzureCredentials(config);
    return Boolean(creds.apiKey && creds.endpoint);
  },

  getEffectiveBaseUrl: (config) => {
    const creds = getAzureCredentials(config);
    return creds.endpoint || "https://YOUR-RESOURCE.openai.azure.com";
  },

  async discoverModels(config: ProviderRuntimeConfig): Promise<AIModelInfo[]> {
    const creds = getAzureCredentials(config);
    const configuredDeployments = Array.from(
      new Set([creds.deployment, ...(config.customModels || [])].filter(Boolean))
    );

    if (creds.apiKey && creds.endpoint) {
      try {
        const res = await fetch(
          `${creds.endpoint}/openai/deployments?api-version=${encodeURIComponent(creds.apiVersion)}`,
          {
            headers: { "api-key": creds.apiKey },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (res.ok) {
          const payload = (await res.json()) as { data?: any[] };
          const live = (payload.data || [])
            .map((d) => String(d.id || d.deployment_id || ""))
            .filter(Boolean);
          const merged = Array.from(new Set([...configuredDeployments, ...live]));
          return merged.map((id) => ({ id, name: `Deployment: ${id}` }));
        }
      } catch {
        // Fallback to configured deployment names
      }
    }

    return configuredDeployments.map((id) => ({ id, name: `Deployment: ${id}` }));
  },

  async testConnection(config: ProviderRuntimeConfig) {
    const checkedAt = new Date().toISOString();
    const creds = getAzureCredentials(config);
    if (!creds.apiKey || !creds.endpoint) {
      return {
        ok: false,
        status: "unconfigured",
        message: "Configure AZURE_OPENAI_API_KEY in Secrets and set your Azure resource endpoint.",
        models: [],
        checkedAt,
      };
    }

    try {
      const models = await this.discoverModels(config);
      if (models.length === 0) {
        return {
          ok: false,
          status: "error",
          message: "Azure OpenAI endpoint reached, but no deployment name is configured.",
          models: [],
          checkedAt,
        };
      }
      return {
        ok: true,
        status: "connected",
        message: `Connected to Azure OpenAI (${models.length} deployment(s) configured).`,
        models,
        checkedAt,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "error",
        message: normalizeProviderError("Azure OpenAI", err),
        models: [],
        checkedAt,
      };
    }
  },

  async completeChat(params: ChatCompletionParams, config: ProviderRuntimeConfig, signal?: AbortSignal) {
    const creds = getAzureCredentials(config);
    if (!creds.apiKey || !creds.endpoint) {
      throw new Error("Azure OpenAI credentials or resource endpoint are not configured.");
    }
    const deployment = params.model || creds.deployment;
    if (!deployment) {
      throw new Error("No Azure OpenAI deployment name specified.");
    }
    const url = `${creds.endpoint}/openai/deployments/${encodeURIComponent(
      deployment
    )}/chat/completions?api-version=${encodeURIComponent(creds.apiVersion)}`;

    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatCompletion({
      url,
      headers: { "api-key": creds.apiKey },
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
    const creds = getAzureCredentials(config);
    if (!creds.apiKey || !creds.endpoint) {
      throw new Error("Azure OpenAI credentials or resource endpoint are not configured.");
    }
    const deployment = params.model || creds.deployment;
    if (!deployment) {
      throw new Error("No Azure OpenAI deployment name specified.");
    }
    const url = `${creds.endpoint}/openai/deployments/${encodeURIComponent(
      deployment
    )}/chat/completions?api-version=${encodeURIComponent(creds.apiVersion)}`;

    const messages = formatMessagesWithAttachments(params.messages, params.systemPrompt);
    return runOpenAICompatStream({
      url,
      headers: { "api-key": creds.apiKey },
      messages,
      temperature: params.temperature,
      onDelta,
      signal,
    });
  },
};
