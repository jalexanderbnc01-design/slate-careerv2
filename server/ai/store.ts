import {
  FirestoreActor,
  actorGetDoc,
  actorUpsertDoc,
  hasAdminWebhookCredentials,
} from "../firebaseStore";
import {
  AIModelInfo,
  ConnectionState,
  ProviderRuntimeConfig,
  UsageLogEntry,
} from "./types";

interface PersistedAIStore {
  configs: Record<string, ProviderRuntimeConfig>;
  usageLogs: UsageLogEntry[];
}

const DEFAULT_CONFIGS: Record<string, ProviderRuntimeConfig> = {
  gemini: { enabled: true },
  openrouter_free: { enabled: true },
  openrouter_paid: { enabled: true, openRouterMonthlyCapUsd: 10 },
  dashscope: {
    enabled: true,
    customModels: ["qwen3.7-max", "qwen3.6-plus", "qwen3-coder-plus"],
  },
  azure_openai: {
    enabled: true,
    azureApiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
    azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || "",
    customBaseUrl: process.env.AZURE_OPENAI_ENDPOINT || "",
  },
  anthropic: { enabled: true },
  ollama: {
    enabled: true,
    customBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  },
  lm_studio: {
    enabled: true,
    customBaseUrl: process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1",
  },
  openclaw: { enabled: false },
  comfyui: { enabled: false },
  copilot_enterprise: { enabled: false },
  worker_ai: { enabled: false },
  firebase_ai_logic: { enabled: false },
};

function createDefaultPersistedStore(): PersistedAIStore {
  return {
    configs: JSON.parse(JSON.stringify(DEFAULT_CONFIGS)),
    usageLogs: [],
  };
}

const fallbackMemoryStore: PersistedAIStore = createDefaultPersistedStore();
const storesByUid = new Map<string, PersistedAIStore>();
const hydratedUids = new Set<string>();
let activeActor: FirestoreActor | null = null;

const AI_SETTINGS_DOC_ID = "ai_runtime";

function getActiveStore(): PersistedAIStore {
  const uid = activeActor?.uid;
  if (!uid) return fallbackMemoryStore;
  let store = storesByUid.get(uid);
  if (!store) {
    store = createDefaultPersistedStore();
    storesByUid.set(uid, store);
  }
  return store;
}

export function setAiStoreOwner(actor: FirestoreActor | string | null): void {
  if (!actor) {
    activeActor = null;
    return;
  }
  activeActor = typeof actor === "string" ? { uid: actor } : actor;
}

export async function hydrateAiStoreForUser(
  actorOrUid: FirestoreActor | string
): Promise<void> {
  const actor: FirestoreActor =
    typeof actorOrUid === "string" ? { uid: actorOrUid } : actorOrUid;
  if (!actor.uid) return;
  activeActor = actor;
  if (!storesByUid.has(actor.uid)) {
    storesByUid.set(actor.uid, createDefaultPersistedStore());
  }
  if (hydratedUids.has(actor.uid)) return;
  if (!actor.idToken && !hasAdminWebhookCredentials()) {
    hydratedUids.add(actor.uid);
    return;
  }
  try {
    const doc = await actorGetDoc(
      `users/${actor.uid}/settings/${AI_SETTINGS_DOC_ID}`,
      actor
    );
    const persisted = (
      doc?.data as { store?: Partial<PersistedAIStore> } | undefined
    )?.store;
    if (persisted) {
      storesByUid.set(actor.uid, {
        configs: { ...DEFAULT_CONFIGS, ...(persisted.configs || {}) },
        usageLogs: Array.isArray(persisted.usageLogs)
          ? persisted.usageLogs.slice(0, 250)
          : [],
      });
    }
    hydratedUids.add(actor.uid);
  } catch (err) {
    console.warn("AI store hydration from Firestore failed:", err);
    hydratedUids.add(actor.uid);
  }
}

function persistStore() {
  const actor = activeActor;
  if (!actor?.uid) return;
  if (!actor.idToken && !hasAdminWebhookCredentials()) return;
  const store = getActiveStore();
  const payload = {
    configs: store.configs,
    usageLogs: store.usageLogs,
  };
  actorUpsertDoc(`users/${actor.uid}/settings/${AI_SETTINGS_DOC_ID}`, actor, {
    kind: AI_SETTINGS_DOC_ID,
    data: { store: payload },
  }).catch((err) => console.warn("AI store Firestore persistence failed:", err));
}

// Transient runtime discovery state (not persisted as confirmed across restarts until probed)
const liveStatusCache: Record<
  string,
  { status: ConnectionState; message: string; models: AIModelInfo[]; checkedAt?: string }
> = {};

function liveCacheKey(providerId: string): string {
  return activeActor?.uid ? `${activeActor.uid}:${providerId}` : providerId;
}

export function getProviderConfig(providerId: string): ProviderRuntimeConfig {
  const store = getActiveStore();
  return (
    store.configs[providerId] ||
    DEFAULT_CONFIGS[providerId] || { enabled: false }
  );
}

export function updateProviderConfig(
  providerId: string,
  patch: Partial<ProviderRuntimeConfig>
): ProviderRuntimeConfig {
  const current = getProviderConfig(providerId);
  const updated: ProviderRuntimeConfig = {
    ...current,
    ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}),
    ...(typeof patch.customBaseUrl === "string"
      ? { customBaseUrl: patch.customBaseUrl.trim() }
      : {}),
    ...(Array.isArray(patch.customModels)
      ? {
          customModels: Array.from(
            new Set(patch.customModels.map((m) => String(m).trim()).filter(Boolean))
          ),
        }
      : {}),
    ...(typeof patch.azureDeployment === "string"
      ? { azureDeployment: patch.azureDeployment.trim() }
      : {}),
    ...(typeof patch.azureApiVersion === "string"
      ? { azureApiVersion: patch.azureApiVersion.trim() }
      : {}),
    ...(typeof patch.openRouterMonthlyCapUsd === "number" &&
    !Number.isNaN(patch.openRouterMonthlyCapUsd)
      ? { openRouterMonthlyCapUsd: Math.max(0, patch.openRouterMonthlyCapUsd) }
      : {}),
  };

  getActiveStore().configs[providerId] = updated;
  persistStore();
  return updated;
}

export function setLiveDiscoveryState(
  providerId: string,
  state: {
    status: ConnectionState;
    message: string;
    models: AIModelInfo[];
    checkedAt?: string;
  }
) {
  liveStatusCache[liveCacheKey(providerId)] = state;
}

export function getLiveDiscoveryState(providerId: string) {
  return liveStatusCache[liveCacheKey(providerId)] || null;
}

export function recordUsageEntry(entry: Omit<UsageLogEntry, "id" | "timestamp">) {
  const full: UsageLogEntry = {
    id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const store = getActiveStore();
  store.usageLogs = [full, ...store.usageLogs].slice(0, 250);
  persistStore();
  return full;
}

export function getMonthlyOpenRouterPaidSpendUsd(): number {
  const now = new Date();
  const currentMonthPrefix = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}`;

  return Number(
    getActiveStore().usageLogs
      .filter(
        (l) =>
          l.providerId === "openrouter_paid" &&
          l.success &&
          l.timestamp.startsWith(currentMonthPrefix)
      )
      .reduce((acc, l) => acc + (l.estimatedCostUsd || 0), 0)
      .toFixed(6)
  );
}

export function getUsageSummary() {
  const store = getActiveStore();
  const byProvider: Record<
    string,
    {
      providerId: string;
      providerName: string;
      requests: number;
      failures: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
    }
  > = {};

  for (const log of store.usageLogs) {
    if (!byProvider[log.providerId]) {
      byProvider[log.providerId] = {
        providerId: log.providerId,
        providerName: log.providerName,
        requests: 0,
        failures: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      };
    }
    const bucket = byProvider[log.providerId];
    bucket.requests += 1;
    if (!log.success) bucket.failures += 1;
    bucket.promptTokens += log.promptTokens;
    bucket.completionTokens += log.completionTokens;
    bucket.totalTokens += log.totalTokens;
    bucket.estimatedCostUsd = Number(
      (bucket.estimatedCostUsd + log.estimatedCostUsd).toFixed(6)
    );
  }

  const paidCap = getProviderConfig("openrouter_paid").openRouterMonthlyCapUsd ?? 10;
  const paidSpent = getMonthlyOpenRouterPaidSpendUsd();

  return {
    totalRequests: store.usageLogs.length,
    totalTokens: store.usageLogs.reduce((s, l) => s + l.totalTokens, 0),
    totalCostUsd: Number(
      store.usageLogs
        .reduce((s, l) => s + l.estimatedCostUsd, 0)
        .toFixed(6)
    ),
    openRouterPaidMonthlySpendUsd: paidSpent,
    openRouterPaidMonthlyCapUsd: paidCap,
    byProvider: Object.values(byProvider),
    recentLogs: store.usageLogs.slice(0, 40),
  };
}

export function resetUsageLogs() {
  getActiveStore().usageLogs = [];
  persistStore();
}
