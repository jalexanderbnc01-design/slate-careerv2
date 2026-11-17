import {
  FirestoreActor,
  actorGetDoc,
  actorUpsertDoc,
} from "./firebaseStore";

// Per-user API keys, write-only: keys go in, never come back out.
// Stored under users/{uid}/settings/keys in Firestore.

export const SERVICE_IDS = [
  "gemini",
  "openrouter",
  "dashscope",
  "anthropic",
  "azure",
  "jsearch",
  "adzuna",
  "jooble",
  "usajobs",
  "notion",
  "clay",
  "gmaps",
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export interface StoredServiceKey {
  key: string;
  extra?: string;
  updatedAt: string;
}

const DOC_PATH = "settings/keys";

export async function getUserServiceKeys(
  actor: FirestoreActor
): Promise<Record<string, StoredServiceKey>> {
  const doc = await actorGetDoc(`users/${actor.uid}/${DOC_PATH}`, actor);
  if (!doc || typeof doc !== "object") return {};
  const keys = (doc as any).data?.services ?? (doc as any).services;
  if (!keys || typeof keys !== "object") return {};
  return keys as Record<string, StoredServiceKey>;
}

export async function setUserServiceKey(
  actor: FirestoreActor,
  service: ServiceId,
  key: string,
  extra?: string
): Promise<StoredServiceKey> {
  const trimmed = key.trim();
  const trimmedExtra = extra?.trim() || undefined;
  if (!trimmed || trimmed.length > 300) {
    throw new Error("Key must be between 1 and 300 characters.");
  }
  if (trimmedExtra && trimmedExtra.length > 300) {
    throw new Error("Secondary value must be under 300 characters.");
  }
  const stored: StoredServiceKey = {
    key: trimmed,
    extra: trimmedExtra,
    updatedAt: new Date().toISOString(),
  };

  // Read-merge-write so sibling services on the same doc are preserved.
  const current = await getUserServiceKeys(actor);
  current[service] = stored;
  await actorUpsertDoc(`users/${actor.uid}/${DOC_PATH}`, actor, {
    kind: "keys",
    data: { services: current },
  });
  return stored;
}

export async function deleteUserServiceKey(
  actor: FirestoreActor,
  service: ServiceId
): Promise<void> {
  const current = await getUserServiceKeys(actor);
  delete current[service];
  await actorUpsertDoc(`users/${actor.uid}/${DOC_PATH}`, actor, {
    kind: "keys",
    data: { services: current },
  });
}

function envConfigured(service: ServiceId): boolean {
  switch (service) {
    case "jsearch":
      return Boolean(process.env.RAPIDAPI_KEY && !process.env.RAPIDAPI_KEY.startsWith("MY_"));
    case "adzuna":
      return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
    case "jooble":
      return Boolean(process.env.JOOBLE_API_KEY);
    case "usajobs":
      return Boolean(process.env.USAJOBS_API_KEY);
    case "gemini":
      return Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
      );
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    case "dashscope":
      return Boolean(process.env.DASHSCOPE_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "azure":
      return Boolean(process.env.AZURE_OPENAI_API_KEY);
    case "notion":
      return Boolean(process.env.NOTION_API_KEY);
    case "clay":
      return Boolean(process.env.CLAY_API_KEY || process.env.CLAY_WEBHOOK_URL);
    case "gmaps":
      return Boolean(
        process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY
      );
    default:
      return false;
  }
}

export interface ServiceKeyState {
  configured: boolean;
  source: "env" | "user" | "none";
  updatedAt: string | null;
}

// Status map only - key material is never included.
export async function getServiceKeyStates(
  actor: FirestoreActor
): Promise<Record<string, ServiceKeyState>> {
  const userKeys = await getUserServiceKeys(actor);
  const states: Record<string, ServiceKeyState> = {};
  for (const service of SERVICE_IDS) {
    const env = envConfigured(service);
    const user = Boolean(userKeys[service]?.key);
    states[service] = {
      configured: env || user,
      source: user ? "user" : env ? "env" : "none",
      updatedAt: userKeys[service]?.updatedAt || null,
    };
  }
  return states;
}
