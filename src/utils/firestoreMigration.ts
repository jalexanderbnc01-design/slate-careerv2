import { authFetch } from "../firebase/client";
import {
  getUserStoreValue,
  hydrateUserStore,
  removeUserStoreValue,
  setUserStoreValue,
} from "./userStore";
import type { TrackerState } from "./trackerFirestore";
import { importTrackerRailState, trackerCollectionsAreEmpty } from "./trackerFirestore";

export interface MigrationSummary {
  migratedCount: number;
  legacyKeysCleared: number;
  serverImported: boolean;
}

const MIGRATION_FLAG_KEY = "migration_status_v1";

/**
 * Every legacy localStorage blob used by the app. Each one becomes a
 * users/{uid}/settings/{key} document with the exact same string payload,
 * so component code keeps its previous read/write semantics.
 */
export const LEGACY_STORAGE_KEYS: string[] = [
  "slate_draftman_profile",
  "slate_application_packets",
  "jaime_energy_level",
  "jaime_job_tracker",
  "jaime_route_checks",
  "jaime_company_targets",
  "jaime_daily_missions",
  "jaime_built_portfolios",
  "jaime_contacts",
  "jaime_bridge_target",
  "jaime_bridge_gigs",
  "jaime_active_workflow",
  "xelime_xcms_state_v1",
  "slate_ai_conversations_v1",
  "slate_routing_policy_v1",
  "xelime-career-workspace-v2",
  "xelime-saved-jobs-v1",
  "xelime-job-feed-state-v1",
  "job-tracker-rail-v1",
];

async function importLegacyServerRuntimeJson(uid: string): Promise<boolean> {
  try {
    const res = await authFetch("/api/migration/import-legacy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    if (!res.ok) {
      console.warn("Legacy server JSON import skipped:", await res.text().catch(() => res.statusText));
      return false;
    }
    const json = (await res.json()) as { imported?: boolean };
    return Boolean(json.imported);
  } catch (err) {
    console.warn("Legacy server JSON import failed:", err);
    return false;
  }
}

async function importTrackerRailCollections(uid: string): Promise<number> {
  const raw = localStorage.getItem("job-tracker-rail-v1");
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as TrackerState;
    if (!parsed || !Array.isArray(parsed.groups) || !Array.isArray(parsed.jobs)) return 0;
    if (!(await trackerCollectionsAreEmpty(uid))) return 0;
    await importTrackerRailState(uid, parsed);
    return parsed.jobs.length + parsed.groups.length;
  } catch {
    return 0;
  }
}

export async function migrateLocalStorageToFirestore(
  uid: string
): Promise<MigrationSummary> {
  await hydrateUserStore(uid);

  const alreadyDone = getUserStoreValue(MIGRATION_FLAG_KEY);
  if (alreadyDone) {
    try {
      const flag = JSON.parse(alreadyDone) as { done?: boolean };
      if (flag.done) {
        return { migratedCount: 0, legacyKeysCleared: 0, serverImported: false };
      }
    } catch {
      // Re-run migration if the flag is unreadable
    }
  }

  let migratedCount = 0;

  for (const key of LEGACY_STORAGE_KEYS) {
    if (key === "xelime-career-workspace-v1") continue;
    const localRaw = localStorage.getItem(key);
    if (localRaw === null) continue;
    if (getUserStoreValue(key) !== null) continue;
    setUserStoreValue(key, localRaw);
    migratedCount += 1;
  }

  migratedCount += await importTrackerRailCollections(uid);

  const legacyWorkspaceV1 = localStorage.getItem("xelime-career-workspace-v1");
  if (legacyWorkspaceV1 && getUserStoreValue("xelime-career-workspace-v2") === null) {
    setUserStoreValue("xelime-career-workspace-v2", legacyWorkspaceV1);
    migratedCount += 1;
  }

  const serverImported = await importLegacyServerRuntimeJson(uid);

  let legacyKeysCleared = 0;
  for (const key of [...LEGACY_STORAGE_KEYS, "xelime-career-workspace-v1"]) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      legacyKeysCleared += 1;
    }
  }

  setUserStoreValue(
    MIGRATION_FLAG_KEY,
    JSON.stringify({ done: true, at: new Date().toISOString(), serverImported })
  );

  return { migratedCount, legacyKeysCleared, serverImported };
}
