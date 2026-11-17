import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useSyncExternalStore } from "react";
import { auth, db } from "../firebase/client";

/**
 * Firestore-backed replacement for the legacy per-key localStorage blobs.
 *
 * Every legacy localStorage key becomes one document under
 * users/{uid}/settings/{key} shaped exactly like the security rules require:
 *   { uid, kind, data: { raw: <exact string previously in localStorage> },
 *     createdAt, updatedAt, version }
 *
 * Reads are served synchronously from an in-memory cache that is hydrated
 * from Firestore right after sign-in (see hydrateUserStore), so components
 * keep their previous synchronous read/save behavior. Writes update the
 * memory cache immediately and persist to Firestore in the background.
 */

const MAX_RAW_LENGTH = 900_000;

interface StoreEntry {
  raw: string;
  version: number;
}

const memory = new Map<string, StoreEntry>();
let hydratedUid: string | null = null;
let hydratingUid: string | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isUserStoreHydrated(): boolean {
  return hydratedUid !== null;
}

export function useUserStoreReady(): boolean {
  return useSyncExternalStore(subscribe, isUserStoreHydrated, isUserStoreHydrated);
}

export async function hydrateUserStore(uid: string): Promise<void> {
  if (hydratedUid === uid || hydratingUid === uid) return;
  hydratingUid = uid;
  try {
    const snap = await getDocs(collection(db, `users/${uid}/settings`));
    memory.clear();
    snap.forEach((entry) => {
      const data = entry.data() as { data?: { raw?: unknown }; version?: unknown };
      const raw = data?.data?.raw;
      if (typeof raw === "string") {
        memory.set(entry.id, {
          raw,
          version: typeof data.version === "number" ? data.version : 1,
        });
      }
    });
    hydratedUid = uid;
    emitChange();
  } catch (err) {
    console.warn(`userStore hydration failed for ${uid}:`, err);
  } finally {
    hydratingUid = null;
  }
}

export function resetUserStore(): void {
  memory.clear();
  hydratedUid = null;
  try {
    localStorage.removeItem("slate_draftman_profile_sync");
  } catch {
    // Ignore storage errors
  }
  emitChange();
}

function settingsRef(key: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  return doc(db, "users", uid, "settings", key);
}

export function getUserStoreValue(key: string): string | null {
  return memory.get(key)?.raw ?? null;
}

export function useUserStoreValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getUserStoreValue(key),
    () => null
  );
}

export function setUserStoreValue(key: string, raw: string): void {
  if (typeof raw !== "string") {
    raw = String(raw);
  }
  const prev = memory.get(key);
  memory.set(key, { raw, version: (prev?.version ?? 0) + 1 });
  emitChange();

  const ref = settingsRef(key);
  if (!ref) return;

  if (raw.length > MAX_RAW_LENGTH) {
    console.warn(
      `userStore: "${key}" payload (${raw.length} chars) exceeds Firestore document budget; keeping memory-only.`
    );
    return;
  }

  if (prev) {
    updateDoc(ref, {
      kind: key,
      data: { raw },
      updatedAt: serverTimestamp(),
      version: increment(1),
    }).catch(async (err: unknown) => {
      const code = (err as { code?: string })?.code || "";
      if (code.includes("not-found") || code.includes("NOT_FOUND")) {
        try {
          await setDoc(ref, {
            uid: auth.currentUser?.uid,
            kind: key,
            data: { raw },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            version: 1,
          });
        } catch (createErr) {
          console.warn(`userStore create failed for "${key}":`, createErr);
        }
      } else {
        console.warn(`userStore update failed for "${key}":`, err);
      }
    });
  } else {
    setDoc(ref, {
      uid: auth.currentUser?.uid,
      kind: key,
      data: { raw },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      version: 1,
    }).catch((err: unknown) => {
      console.warn(`userStore create failed for "${key}":`, err);
    });
  }
}

export function removeUserStoreValue(key: string): void {
  memory.delete(key);
  emitChange();
  const ref = settingsRef(key);
  if (!ref) return;
  deleteDoc(ref).catch((err: unknown) => {
    console.warn(`userStore delete failed for "${key}":`, err);
  });
}
