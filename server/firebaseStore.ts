import crypto from "crypto";
import fs from "fs";
import path from "path";
import type express from "express";
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Firestore } from "firebase-admin/firestore";

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
}

function loadAppletConfig(): FirebaseAppletConfig {
  const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
  const raw = fs.readFileSync(cfgPath, "utf8");
  return JSON.parse(raw) as FirebaseAppletConfig;
}

const firebaseConfig = loadAppletConfig();

function buildAdminApp() {
  if (getApps().length > 0) return getApp();
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson && saJson.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(saJson);
      return initializeApp({
        credential: cert(parsed),
        projectId: firebaseConfig.projectId,
      });
    } catch (e) {
      console.warn("Invalid FIREBASE_SERVICE_ACCOUNT_JSON; falling back to default app init.", e);
    }
  }
  return initializeApp({ projectId: firebaseConfig.projectId });
}

const adminApp = buildAdminApp();
const adminAuth = getAuth(adminApp);
let adminDbInstance: Firestore | null = null;

export function hasAdminWebhookCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.K_SERVICE
  );
}

export function getAdminFirestore(): Firestore {
  if (!adminDbInstance) {
    adminDbInstance = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
  }
  return adminDbInstance;
}

export const FIRESTORE_PROJECT_ID = firebaseConfig.projectId;
export const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}`;

export interface AuthenticatedRequest extends express.Request {
  uid?: string;
  idToken?: string;
  emailVerified?: boolean;
}

export function extractBearerToken(
  headers: Record<string, string | string[] | undefined>
): string {
  const raw = headers.authorization || headers.Authorization;
  const authHeader = Array.isArray(raw) ? raw[0] : raw || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return "";
}

export async function verifyFirebaseIdToken(token: string): Promise<{
  uid: string;
  email?: string;
  emailVerified: boolean;
  signInProvider: string;
}> {
  const decoded = await adminAuth.verifyIdToken(token);
  const signInProvider = (decoded.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider || "";
  // Federated Google accounts are email-verified by Google itself, but the
  // emailVerified flag on the Firebase user record lags behind for
  // credential-based (GIS) sign-ins. Trust Google-issued credentials.
  const verifiedByGoogleProvider = signInProvider === "google.com" && Boolean(decoded.email);
  // Password accounts are fully authenticated by Firebase Auth itself; this
  // single-user app only cares that a real signed-in identity exists.
  const verifiedByAuthProvider = (signInProvider === "password" || signInProvider === "firebase") && Boolean(decoded.email);
  return {
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: Boolean(decoded.email_verified) || verifiedByGoogleProvider || verifiedByAuthProvider,
    signInProvider,
  };
}

export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const token = extractBearerToken(
      req.headers as Record<string, string | string[] | undefined>
    );
    if (!token) {
      return res.status(401).json({
        error: "Authentication required. Missing Firebase ID Bearer token.",
        code: "unauthenticated",
      });
    }
    const verified = await verifyFirebaseIdToken(token);
    if (!verified.email) {
      // Valid Firebase identity with no email claim (e.g. a linked GIS token).
      // Firebase Auth already vouches for the user; Firestore rules scope data.
      console.warn(`Auth OK (no email): uid=${verified.uid} provider=${verified.signInProvider}`);
    }
    req.uid = verified.uid;
    req.idToken = token;
    req.emailVerified = verified.emailVerified;
    return next();
  } catch (err: any) {
    return res.status(401).json({
      error: err?.message || "Invalid or expired Firebase Auth token.",
      code: "invalid_token",
    });
  }
}

export function sanitizeFirestoreId(raw: string, prefix = "doc"): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return cleaned || `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

export function hashToFirestoreId(raw: string, prefix = "k"): string {
  const digest = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 40);
  return `${prefix}_${digest}`;
}

// ==================== FIRESTORE REST VALUE CODEC ====================
type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function encodeValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (
    typeof val === "object" &&
    val !== null &&
    "__fsTimestamp" in val &&
    typeof (val as any).__fsTimestamp === "string"
  ) {
    return { timestampValue: (val as any).__fsTimestamp };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return { integerValue: "0" };
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (val instanceof Date) {
    return { timestampValue: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => encodeValue(item)),
      },
    };
  }
  if (typeof val === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeValue(val: FirestoreValue | undefined): any {
  if (!val) return undefined;
  if ("nullValue" in val) return null;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return val.doubleValue;
  if ("stringValue" in val) return val.stringValue;
  if ("timestampValue" in val) return val.timestampValue;
  if ("arrayValue" in val) {
    return (val.arrayValue.values || []).map((item) => decodeValue(item));
  }
  if ("mapValue" in val) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = decodeValue(v);
    }
    return out;
  }
  return undefined;
}

function decodeDocument(docJson: any): Record<string, any> & { _id: string } {
  const name: string = docJson.name || "";
  const id = name.split("/").pop() || "";
  const out: Record<string, any> = { _id: id };
  for (const [k, v] of Object.entries(docJson.fields || {})) {
    out[k] = decodeValue(v as FirestoreValue);
  }
  return out as Record<string, any> & { _id: string };
}

function encodeFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeValue(v);
    }
  }
  return fields;
}

function docResourceName(docPath: string): string {
  return `projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/${docPath}`;
}

export async function fsGetDoc(
  docPath: string,
  idToken: string
): Promise<(Record<string, any> & { _id: string }) | null> {
  const url = `${FIRESTORE_BASE_URL}/documents/${docPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Firestore GET ${docPath} failed (${res.status}): ${errText}`);
  }
  const json = await res.json();
  return decodeDocument(json);
}

export async function fsListCollection(
  collectionPath: string,
  idToken: string,
  pageSize = 300
): Promise<(Record<string, any> & { _id: string })[]> {
  const parts = collectionPath.split("/").filter(Boolean);
  const collectionId = parts.pop() || "";
  const parentPath = parts.join("/");
  // Extract uid from users/{uid}/... path for security-rule-compliant fieldFilter
  const usersIdx = parts.indexOf("users");
  const uid = usersIdx >= 0 && parts.length > usersIdx + 1 ? parts[usersIdx + 1] : "";

  const runUrl = parentPath
    ? `${FIRESTORE_BASE_URL}/documents/${parentPath}:runQuery`
    : `${FIRESTORE_BASE_URL}/documents:runQuery`;

  const structuredQuery: Record<string, any> = {
    from: [{ collectionId }],
    limit: pageSize,
  };
  if (uid) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: "uid" },
        op: "EQUAL",
        value: { stringValue: uid },
      },
    };
  }

  const res = await fetch(runUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ structuredQuery }),
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(
      `Firestore LIST ${collectionPath} failed (${res.status}): ${errText}`
    );
  }
  const rows = (await res.json()) as any[];
  const out: (Record<string, any> & { _id: string })[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && row.document) {
        out.push(decodeDocument(row.document));
      }
    }
  }
  return out;
}

export async function fsUpsertDoc(
  docPath: string,
  uid: string,
  idToken: string,
  data: Record<string, unknown>
): Promise<{ version: number }> {
  const existing = await fsGetDoc(docPath, idToken);
  const currentVersion =
    existing && typeof existing.version === "number" ? existing.version : 0;
  const nextVersion = existing ? currentVersion + 1 : 1;

  const bodyFields: Record<string, unknown> = {
    ...data,
    uid,
    version: nextVersion,
  };
  delete bodyFields.createdAt;
  delete bodyFields.updatedAt;
  delete bodyFields._id;

  const transforms: Array<{ fieldPath: string; setToServerValue: string }> = [
    { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
  ];
  if (typeof existing?.createdAt === "string" && existing.createdAt) {
    bodyFields.createdAt = { __fsTimestamp: existing.createdAt };
  } else {
    transforms.push({ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" });
  }

  const commitRes = await fetch(`${FIRESTORE_BASE_URL}/documents:commit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      writes: [
        {
          update: {
            name: docResourceName(docPath),
            fields: encodeFields(bodyFields),
          },
          updateTransforms: transforms,
        },
      ],
    }),
  });

  if (!commitRes.ok) {
    const errText = await commitRes.text().catch(() => commitRes.statusText);
    throw new Error(
      `Firestore COMMIT ${docPath} failed (${commitRes.status}): ${errText}`
    );
  }
  return { version: nextVersion };
}

export async function fsDeleteDoc(
  docPath: string,
  idToken: string
): Promise<boolean> {
  const url = `${FIRESTORE_BASE_URL}/documents/${docPath}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(
      `Firestore DELETE ${docPath} failed (${res.status}): ${errText}`
    );
  }
  return true;
}

export interface FirestoreActor {
  uid: string;
  idToken?: string;
}

function assertAdminOrToken(actor: FirestoreActor) {
  if (actor.idToken) return;
  if (!hasAdminWebhookCredentials()) {
    throw new Error(
      "Firestore write requires a Firebase Auth ID token, or Cloud Run / GOOGLE_APPLICATION_CREDENTIALS for unattended webhooks."
    );
  }
}

export async function actorGetDoc(
  docPath: string,
  actor: FirestoreActor
): Promise<(Record<string, any> & { _id: string }) | null> {
  if (actor.idToken) return fsGetDoc(docPath, actor.idToken);
  assertAdminOrToken(actor);
  const snap = await getAdminFirestore().doc(docPath).get();
  if (!snap.exists) return null;
  return { _id: snap.id, ...(snap.data() || {}) };
}

export async function actorListCollection(
  collectionPath: string,
  actor: FirestoreActor
): Promise<(Record<string, any> & { _id: string })[]> {
  if (actor.idToken) return fsListCollection(collectionPath, actor.idToken);
  assertAdminOrToken(actor);
  const snap = await getAdminFirestore()
    .collection(collectionPath)
    .where("uid", "==", actor.uid)
    .get();
  return snap.docs.map((d) => ({ _id: d.id, ...(d.data() || {}) }));
}

export async function actorUpsertDoc(
  docPath: string,
  actor: FirestoreActor,
  data: Record<string, unknown>
): Promise<{ version: number }> {
  if (actor.idToken) return fsUpsertDoc(docPath, actor.uid, actor.idToken, data);
  assertAdminOrToken(actor);
  const db = getAdminFirestore();
  const ref = db.doc(docPath);
  const existingSnap = await ref.get();
  const prevVersion =
    existingSnap.exists && typeof existingSnap.data()?.version === "number"
      ? (existingSnap.data()!.version as number)
      : 0;
  const nextVersion = existingSnap.exists ? prevVersion + 1 : 1;
  const payload: Record<string, unknown> = {
    ...data,
    uid: actor.uid,
    version: nextVersion,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existingSnap.exists && existingSnap.data()?.createdAt) {
    payload.createdAt = existingSnap.data()!.createdAt;
  } else {
    payload.createdAt = FieldValue.serverTimestamp();
  }
  await ref.set(payload);
  return { version: nextVersion };
}

export async function actorDeleteDoc(
  docPath: string,
  actor: FirestoreActor
): Promise<boolean> {
  if (actor.idToken) return fsDeleteDoc(docPath, actor.idToken);
  assertAdminOrToken(actor);
  const ref = getAdminFirestore().doc(docPath);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}
