import crypto from "crypto";
import {
  FirestoreActor,
  actorGetDoc,
  actorUpsertDoc,
  hasAdminWebhookCredentials,
} from "../firebaseStore";
import {
  NotionApiError,
  getNotionCredentials,
  isValidNotionId,
  normalizeNotionId,
  notionAppendBlockChildren,
  notionCreatePage,
  notionGetBlockChildren,
  notionGetBotUser,
  notionGetDatabase,
  notionGetPage,
  notionQueryDatabase,
  notionSearch,
  notionUpdatePage,
  sanitizeNotionError,
} from "./client";
import {
  DOMAIN_FIELD_SPECS,
  KNOWN_NOTION_DOCUMENTS,
  NotionBlockItem,
  NotionDatabaseRecord,
  NotionDocumentSummary,
  NotionDomainKey,
  NotionDomainMapping,
  NotionPageDetail,
  NotionPropertySchema,
  NotionRuntimeStore,
  RecordSyncMapping,
  SyncConflict,
  SyncHistoryEntry,
} from "./types";

function createDefaultStore(): NotionRuntimeStore {
  return {
    enabled: true,
    enforceAllowlist: false,
    authorizedIds: [],
    mappings: {},
    recordLinks: [],
    conflicts: [],
    syncHistory: [],
    lastSyncAt: null,
  };
}

const storesByUid = new Map<string, NotionRuntimeStore>();
const hydratedUids = new Set<string>();
let activeActor: FirestoreActor | null = null;
let fallbackStoreCache: NotionRuntimeStore | null = null;

const NOTION_SETTINGS_DOC_ID = "notion_runtime";

function mergePersistedStore(parsed: Partial<NotionRuntimeStore>): NotionRuntimeStore {
  return {
    ...createDefaultStore(),
    ...parsed,
    mappings: parsed.mappings || {},
    authorizedIds: Array.isArray(parsed.authorizedIds)
      ? parsed.authorizedIds
      : [],
    recordLinks: Array.isArray(parsed.recordLinks) ? parsed.recordLinks : [],
    conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
    syncHistory: Array.isArray(parsed.syncHistory)
      ? parsed.syncHistory.slice(0, 100)
      : [],
  };
}

export async function hydrateNotionStoreForUser(
  actorOrUid: FirestoreActor | string
): Promise<void> {
  const actor: FirestoreActor =
    typeof actorOrUid === "string" ? { uid: actorOrUid } : actorOrUid;
  if (!actor.uid) return;
  activeActor = actor;
  if (!storesByUid.has(actor.uid)) {
    storesByUid.set(actor.uid, createDefaultStore());
  }
  if (hydratedUids.has(actor.uid)) return;
  if (!actor.idToken && !hasAdminWebhookCredentials()) {
    hydratedUids.add(actor.uid);
    return;
  }
  try {
    const doc = await actorGetDoc(
      `users/${actor.uid}/settings/${NOTION_SETTINGS_DOC_ID}`,
      actor
    );
    const persisted = (
      doc?.data as { store?: Partial<NotionRuntimeStore> } | undefined
    )?.store;
    if (persisted) {
      storesByUid.set(actor.uid, mergePersistedStore(persisted));
    }
    hydratedUids.add(actor.uid);
  } catch (err) {
    console.warn("Notion store hydration from Firestore failed:", err);
    hydratedUids.add(actor.uid);
  }
}

export function loadNotionStore(): NotionRuntimeStore {
  const uid = activeActor?.uid;
  if (!uid) {
    if (!fallbackStoreCache) {
      fallbackStoreCache = createDefaultStore();
    }
    return fallbackStoreCache;
  }
  let store = storesByUid.get(uid);
  if (!store) {
    store = createDefaultStore();
    storesByUid.set(uid, store);
  }
  return store;
}

export function resetNotionStoreCacheForTests() {
  storesByUid.clear();
  hydratedUids.clear();
  activeActor = null;
  fallbackStoreCache = null;
}

function saveNotionStore(store: NotionRuntimeStore) {
  const actor = activeActor;
  if (!actor?.uid) {
    fallbackStoreCache = store;
    return;
  }
  storesByUid.set(actor.uid, store);
  if (!actor.idToken && !hasAdminWebhookCredentials()) return;
  actorUpsertDoc(
    `users/${actor.uid}/settings/${NOTION_SETTINGS_DOC_ID}`,
    actor,
    {
      kind: NOTION_SETTINGS_DOC_ID,
      data: { store },
    }
  ).catch((err) => console.warn("Notion store Firestore persistence failed:", err));
}

export function sanitizeText(input: unknown, maxLen = 12000): string {
  const str = String(input ?? "");
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function normalizeIdCompact(id: string): string {
  return normalizeNotionId(id).replace(/-/g, "").toLowerCase();
}

function assertReady(): NotionRuntimeStore {
  const creds = getNotionCredentials();
  if (!creds.configured) {
    throw new NotionApiError(
      "NOTION_API_KEY is missing. Set NOTION_API_KEY and NOTION_API_VERSION in AI Studio Secrets or server environment.",
      400,
      "not_configured"
    );
  }
  const store = loadNotionStore();
  if (!store.enabled) {
    throw new NotionApiError(
      "Notion integration is currently disconnected. Click Connect in Career Engine -> Notion.",
      403,
      "disconnected"
    );
  }
  return store;
}

function assertValidObjectId(id: string, label = "Notion ID"): string {
  if (!id || typeof id !== "string" || !isValidNotionId(id)) {
    throw new NotionApiError(`Invalid ${label} format.`, 400, "invalid_id");
  }
  return normalizeNotionId(id);
}

function assertAllowlistIfEnabled(
  store: NotionRuntimeStore,
  objectId: string,
  parentId?: string
) {
  if (!store.enforceAllowlist || store.authorizedIds.length === 0) return;
  const compactSet = new Set(store.authorizedIds.map(normalizeIdCompact));
  const idMatched = compactSet.has(normalizeIdCompact(objectId));
  const parentMatched = parentId ? compactSet.has(normalizeIdCompact(parentId)) : false;
  if (!idMatched && !parentMatched) {
    throw new NotionApiError(
      "Access restricted: this Notion document is not in your authorized allowlist.",
      403,
      "allowlist_denied"
    );
  }
}

function extractPlainRichText(arr: any[]): string {
  if (!Array.isArray(arr)) return "";
  return sanitizeText(arr.map((t) => t?.plain_text || "").join(""));
}

function extractObjectTitle(obj: any): string {
  if (obj?.object === "database" || obj?.object === "data_source") {
    return extractPlainRichText(obj.title) || "Untitled Database";
  }
  const props = obj?.properties || {};
  for (const val of Object.values<any>(props)) {
    if (val?.type === "title") {
      return extractPlainRichText(val.title) || "Untitled Page";
    }
  }
  return "Untitled Page";
}

function matchKnownDocument(title: string) {
  const lower = title.toLowerCase().trim();
  if (!lower) return undefined;
  return KNOWN_NOTION_DOCUMENTS.find((spec) =>
    spec.matchTerms.some(
      (term) => lower === term || lower.includes(term) || term.includes(lower)
    )
  );
}

export function extractDatabaseSchema(
  rawProps: Record<string, any> | undefined
): Record<string, NotionPropertySchema> {
  const out: Record<string, NotionPropertySchema> = {};
  if (!rawProps || typeof rawProps !== "object") return out;

  for (const [name, def] of Object.entries<any>(rawProps)) {
    if (!def || typeof def !== "object") continue;
    const type = String(def.type || "unknown");
    let options: string[] | undefined;
    if (type === "select" && Array.isArray(def.select?.options)) {
      options = def.select.options.map((o: any) => String(o.name));
    } else if (type === "multi_select" && Array.isArray(def.multi_select?.options)) {
      options = def.multi_select.options.map((o: any) => String(o.name));
    } else if (type === "status" && Array.isArray(def.status?.options)) {
      options = def.status.options.map((o: any) => String(o.name));
    }
    out[name] = {
      id: String(def.id || name),
      name,
      type,
      options,
    };
  }
  return out;
}

function toDocumentSummary(raw: any): NotionDocumentSummary {
  const objectType =
    raw?.object === "database" || raw?.object === "data_source"
      ? "database"
      : "page";
  const title = extractObjectTitle(raw);
  const matched = matchKnownDocument(title);
  const parentType = raw?.parent?.type;
  const parentId =
    raw?.parent?.data_source_id ||
    raw?.parent?.database_id ||
    raw?.parent?.page_id ||
    raw?.parent?.block_id ||
    undefined;

  return {
    id: String(raw.id),
    objectType,
    title,
    url: String(raw.url || ""),
    lastEditedTime: String(raw.last_edited_time || ""),
    createdTime: String(raw.created_time || ""),
    parentType,
    parentId,
    recognizedKey: matched?.key,
    recognizedTitle: matched?.canonicalTitle,
    properties:
      objectType === "database"
        ? extractDatabaseSchema(raw.properties)
        : undefined,
  };
}

export function extractPropertyValue(
  prop: any
): string | string[] | number | boolean | null {
  if (!prop || typeof prop !== "object") return null;
  switch (prop.type) {
    case "title":
      return extractPlainRichText(prop.title);
    case "rich_text":
      return extractPlainRichText(prop.rich_text);
    case "select":
      return prop.select?.name ? sanitizeText(prop.select.name) : null;
    case "status":
      return prop.status?.name ? sanitizeText(prop.status.name) : null;
    case "multi_select":
      return Array.isArray(prop.multi_select)
        ? prop.multi_select.map((o: any) => sanitizeText(o.name)).filter(Boolean)
        : [];
    case "url":
      return prop.url ? sanitizeText(prop.url) : null;
    case "email":
      return prop.email ? sanitizeText(prop.email) : null;
    case "phone_number":
      return prop.phone_number ? sanitizeText(prop.phone_number) : null;
    case "number":
      return typeof prop.number === "number" ? prop.number : null;
    case "checkbox":
      return Boolean(prop.checkbox);
    case "date":
      return prop.date?.start ? sanitizeText(prop.date.start) : null;
    case "created_time":
      return prop.created_time ? sanitizeText(prop.created_time) : null;
    case "last_edited_time":
      return prop.last_edited_time ? sanitizeText(prop.last_edited_time) : null;
    case "relation":
      return Array.isArray(prop.relation)
        ? prop.relation.map((r: any) => String(r.id)).filter(Boolean)
        : [];
    case "files":
      return Array.isArray(prop.files)
        ? prop.files.map((f: any) => sanitizeText(f.name || "file")).filter(Boolean)
        : [];
    case "formula":
      if (prop.formula?.type === "string") return sanitizeText(prop.formula.string);
      if (prop.formula?.type === "number") return prop.formula.number ?? null;
      if (prop.formula?.type === "boolean") return Boolean(prop.formula.boolean);
      if (prop.formula?.type === "date") return prop.formula.date?.start || null;
      return null;
    default:
      return null;
  }
}

export function normalizePageProperties(
  rawProps: Record<string, any> | undefined
): Record<string, string | string[] | number | boolean | null> {
  const normalized: Record<string, string | string[] | number | boolean | null> = {};
  if (!rawProps || typeof rawProps !== "object") return normalized;
  for (const [key, prop] of Object.entries(rawProps)) {
    normalized[key] = extractPropertyValue(prop);
  }
  return normalized;
}

function extractBlockText(block: any): NotionBlockItem {
  const bType = String(block?.type || "unsupported");
  const inner = block?.[bType] || {};
  let text = "";
  if (Array.isArray(inner.rich_text)) {
    text = extractPlainRichText(inner.rich_text);
  } else if (Array.isArray(inner.caption)) {
    text = extractPlainRichText(inner.caption);
  } else if (bType === "child_page") {
    text = `[Child Page] ${sanitizeText(inner.title)}`;
  } else if (bType === "child_database") {
    text = `[Child Database] ${sanitizeText(inner.title)}`;
  } else if (typeof inner.url === "string") {
    text = sanitizeText(inner.url);
  }

  return {
    id: String(block.id),
    type: bType,
    text,
    hasChildren: Boolean(block.has_children),
    checked: bType === "to_do" ? Boolean(inner.checked) : undefined,
  };
}

export async function getNotionStatus() {
  const creds = getNotionCredentials();
  const store = loadNotionStore();

  if (!creds.configured) {
    return {
      configured: false,
      enabled: store.enabled,
      connected: false,
      status: "unconfigured" as const,
      apiVersion: creds.apiVersion,
      message:
        "Missing server secret NOTION_API_KEY. Add NOTION_API_KEY in AI Studio Secrets (or .env) and share your Notion pages/databases with the integration.",
      workspaceName: null,
      botName: null,
      enforceAllowlist: store.enforceAllowlist,
      authorizedIds: store.authorizedIds,
      lastSyncAt: store.lastSyncAt,
      mappingsCount: Object.keys(store.mappings).length,
      linkedRecordsCount: store.recordLinks.length,
      pendingConflictsCount: store.conflicts.filter(
        (c) => c.resolution === "pending"
      ).length,
    };
  }

  if (!store.enabled) {
    return {
      configured: true,
      enabled: false,
      connected: false,
      status: "disconnected" as const,
      apiVersion: creds.apiVersion,
      message: "Notion integration is disconnected by user.",
      workspaceName: null,
      botName: null,
      enforceAllowlist: store.enforceAllowlist,
      authorizedIds: store.authorizedIds,
      lastSyncAt: store.lastSyncAt,
      mappingsCount: Object.keys(store.mappings).length,
      linkedRecordsCount: store.recordLinks.length,
      pendingConflictsCount: store.conflicts.filter(
        (c) => c.resolution === "pending"
      ).length,
    };
  }

  try {
    const me = await notionGetBotUser();
    const workspaceName =
      me?.bot?.workspace_name || me?.name || "Connected Notion Workspace";
    return {
      configured: true,
      enabled: true,
      connected: true,
      status: "connected" as const,
      apiVersion: creds.apiVersion,
      message: `Connected to ${sanitizeText(workspaceName)}.`,
      workspaceName: sanitizeText(workspaceName),
      botName: sanitizeText(me?.name || "Career Engine Bot"),
      enforceAllowlist: store.enforceAllowlist,
      authorizedIds: store.authorizedIds,
      lastSyncAt: store.lastSyncAt,
      mappingsCount: Object.keys(store.mappings).length,
      linkedRecordsCount: store.recordLinks.length,
      pendingConflictsCount: store.conflicts.filter(
        (c) => c.resolution === "pending"
      ).length,
    };
  } catch (err: any) {
    return {
      configured: true,
      enabled: true,
      connected: false,
      status: "error" as const,
      apiVersion: creds.apiVersion,
      message: sanitizeNotionError(err),
      workspaceName: null,
      botName: null,
      enforceAllowlist: store.enforceAllowlist,
      authorizedIds: store.authorizedIds,
      lastSyncAt: store.lastSyncAt,
      mappingsCount: Object.keys(store.mappings).length,
      linkedRecordsCount: store.recordLinks.length,
      pendingConflictsCount: store.conflicts.filter(
        (c) => c.resolution === "pending"
      ).length,
    };
  }
}

export async function connectNotionWorkspace() {
  const creds = getNotionCredentials();
  if (!creds.configured) {
    throw new NotionApiError(
      "Cannot connect: NOTION_API_KEY is not configured in server secrets.",
      400,
      "not_configured"
    );
  }
  const me = await notionGetBotUser();
  const store = loadNotionStore();
  store.enabled = true;
  saveNotionStore(store);

  const searchRes = await searchNotionWorkspace({ pageSize: 50 });
  // Auto-detect mappings if none exist yet
  if (Object.keys(store.mappings).length === 0) {
    const dbs = searchRes.results.filter((r) => r.objectType === "database");
    if (dbs.length > 0) {
      autoDetectMappingsIntoStore(dbs);
    }
  }

  return {
    connected: true,
    botName: sanitizeText(me?.name || "Notion Integration"),
    workspaceName: sanitizeText(
      me?.bot?.workspace_name || me?.name || "Notion Workspace"
    ),
    discoveredCount: searchRes.results.length,
  };
}

export function disconnectNotionWorkspace() {
  const store = loadNotionStore();
  store.enabled = false;
  saveNotionStore(store);
  return { connected: false, enabled: false };
}

export function updateAccessPolicy(params: {
  enforceAllowlist?: boolean;
  authorizedIds?: string[];
}) {
  const store = loadNotionStore();
  if (typeof params.enforceAllowlist === "boolean") {
    store.enforceAllowlist = params.enforceAllowlist;
  }
  if (Array.isArray(params.authorizedIds)) {
    store.authorizedIds = Array.from(
      new Set(
        params.authorizedIds
          .map((id) => normalizeNotionId(String(id)))
          .filter(isValidNotionId)
      )
    );
  }
  saveNotionStore(store);
  return {
    enforceAllowlist: store.enforceAllowlist,
    authorizedIds: store.authorizedIds,
  };
}

export async function searchNotionWorkspace(params: {
  query?: string;
  filterObject?: "page" | "database";
  startCursor?: string;
  pageSize?: number;
}) {
  const store = assertReady();
  const raw = await notionSearch(params);
  let results = (raw.results || []).map(toDocumentSummary);

  if (store.enforceAllowlist && store.authorizedIds.length > 0) {
    const allowedSet = new Set(store.authorizedIds.map(normalizeIdCompact));
    results = results.filter(
      (doc) =>
        allowedSet.has(normalizeIdCompact(doc.id)) ||
        (doc.parentId ? allowedSet.has(normalizeIdCompact(doc.parentId)) : false)
    );
  }

  // Match report for the 7 canonical documents
  const knownReport = KNOWN_NOTION_DOCUMENTS.map((spec) => {
    const match = results.find(
      (r) =>
        r.recognizedKey === spec.key ||
        r.title.toLowerCase().includes(spec.canonicalTitle.toLowerCase())
    );
    return {
      key: spec.key,
      canonicalTitle: spec.canonicalTitle,
      description: spec.description,
      preferredDomain: spec.preferredDomain || null,
      found: Boolean(match),
      document: match || null,
    };
  });

  return {
    results,
    hasMore: Boolean(raw.has_more),
    nextCursor: raw.next_cursor || null,
    knownDocuments: knownReport,
  };
}

export async function readNotionPage(pageId: string): Promise<NotionPageDetail> {
  const store = assertReady();
  const cleanId = assertValidObjectId(pageId, "page ID");

  const page = await notionGetPage(cleanId);
  const parentId =
    page?.parent?.data_source_id ||
    page?.parent?.database_id ||
    page?.parent?.page_id ||
    undefined;
  assertAllowlistIfEnabled(store, cleanId, parentId);

  const blocks: NotionBlockItem[] = [];
  let cursor: string | undefined;
  let guard = 0;
  do {
    const res = await notionGetBlockChildren(cleanId, cursor);
    for (const blk of res.results || []) {
      blocks.push(extractBlockText(blk));
    }
    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
    guard += 1;
  } while (cursor && guard < 4);

  const plainText = blocks
    .map((b) => {
      if (!b.text) return "";
      if (b.type === "heading_1") return `# ${b.text}`;
      if (b.type === "heading_2") return `## ${b.text}`;
      if (b.type === "heading_3") return `### ${b.text}`;
      if (b.type === "to_do") return `- [${b.checked ? "x" : " "}] ${b.text}`;
      if (b.type === "bulleted_list_item") return `- ${b.text}`;
      if (b.type === "numbered_list_item") return `1. ${b.text}`;
      return b.text;
    })
    .filter(Boolean)
    .join("\n");

  return {
    id: String(page.id),
    title: extractObjectTitle(page),
    url: String(page.url || ""),
    lastEditedTime: String(page.last_edited_time || ""),
    createdTime: String(page.created_time || ""),
    parentType: page?.parent?.type,
    parentId,
    properties: page.properties || {},
    normalizedProperties: normalizePageProperties(page.properties),
    blocks,
    plainText: sanitizeText(plainText),
    sanitized: true,
  };
}

export async function listNotionDatabases() {
  const all: NotionDocumentSummary[] = [];
  let cursor: string | undefined;
  let guard = 0;
  do {
    const searchRes = await searchNotionWorkspace({
      filterObject: "database",
      startCursor: cursor,
      pageSize: 100,
    });
    for (const d of searchRes.results) {
      if (d.objectType === "database" && !all.some((x) => x.id === d.id)) {
        all.push(d);
      }
    }
    cursor = searchRes.hasMore && searchRes.nextCursor ? searchRes.nextCursor : undefined;
    guard += 1;
  } while (cursor && guard < 4);
  return all;
}

export async function getNotionDatabaseRecords(
  databaseId: string,
  params: { startCursor?: string; pageSize?: number } = {}
): Promise<{
  database: NotionDocumentSummary;
  records: NotionDatabaseRecord[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const store = assertReady();
  const cleanDbId = assertValidObjectId(databaseId, "database ID");
  assertAllowlistIfEnabled(store, cleanDbId);

  const [dbMeta, queryRes] = await Promise.all([
    notionGetDatabase(cleanDbId),
    notionQueryDatabase(cleanDbId, params),
  ]);

  const database = toDocumentSummary(dbMeta);
  const records: NotionDatabaseRecord[] = (queryRes.results || []).map((row) => ({
    id: String(row.id),
    title: extractObjectTitle(row),
    url: String(row.url || ""),
    lastEditedTime: String(row.last_edited_time || ""),
    createdTime: String(row.created_time || ""),
    properties: row.properties || {},
    normalizedFields: normalizePageProperties(row.properties),
  }));

  return {
    database,
    records,
    hasMore: Boolean(queryRes.has_more),
    nextCursor: queryRes.next_cursor || null,
  };
}

function autoMatchFieldToSchema(
  domain: NotionDomainKey,
  schema: Record<string, NotionPropertySchema>
): Record<string, string> {
  const spec = DOMAIN_FIELD_SPECS[domain];
  const propEntries = Object.values(schema);
  const mapped: Record<string, string> = {};

  for (const field of spec.fields) {
    // 1. Exact lowercase match against aliases
    let found = propEntries.find((p) =>
      field.aliases.includes(p.name.toLowerCase().trim())
    );
    // 2. Partial match
    if (!found) {
      found = propEntries.find((p) => {
        const lower = p.name.toLowerCase();
        return field.aliases.some((alias) => lower.includes(alias));
      });
    }
    // 3. Fallback to the database's single title property if expecting title
    if (!found && field.expectedTypes[0] === "title") {
      found = propEntries.find((p) => p.type === "title");
    }
    if (found) {
      mapped[field.key] = found.name;
    }
  }
  return mapped;
}

export function autoDetectMappingsIntoStore(databases: NotionDocumentSummary[]) {
  const store = loadNotionStore();
  const domains: NotionDomainKey[] = [
    "applications",
    "portfolio",
    "skills",
    "profile",
  ];

  for (const domain of domains) {
    // Prefer database matching recognized canonical domain or keyword in title
    let candidate = databases.find((db) => {
      const spec = KNOWN_NOTION_DOCUMENTS.find((k) => k.key === db.recognizedKey);
      return spec?.preferredDomain === domain;
    });

    if (!candidate) {
      candidate = databases.find((db) => {
        const t = db.title.toLowerCase();
        if (domain === "applications") return t.includes("job") || t.includes("tracker") || t.includes("application");
        if (domain === "portfolio") return t.includes("portfolio") || t.includes("project");
        if (domain === "skills") return t.includes("skill") || t.includes("resume data");
        if (domain === "profile") return t.includes("resume") || t.includes("profile");
        return false;
      });
    }

    if (candidate && candidate.properties) {
      store.mappings[domain] = {
        domain,
        databaseId: candidate.id,
        databaseTitle: candidate.title,
        fieldToProperty: autoMatchFieldToSchema(domain, candidate.properties),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  saveNotionStore(store);
  return store.mappings;
}

export function getMappings() {
  const store = loadNotionStore();
  return store.mappings;
}

export function saveDomainMapping(mapping: {
  domain: NotionDomainKey;
  databaseId: string;
  databaseTitle: string;
  fieldToProperty: Record<string, string>;
}) {
  if (!["profile", "skills", "applications", "portfolio"].includes(mapping.domain)) {
    throw new NotionApiError("Unsupported domain key.", 400, "invalid_domain");
  }
  const cleanDbId = assertValidObjectId(mapping.databaseId, "databaseId");
  const store = loadNotionStore();
  store.mappings[mapping.domain] = {
    domain: mapping.domain,
    databaseId: cleanDbId,
    databaseTitle: sanitizeText(mapping.databaseTitle || "Notion Database"),
    fieldToProperty: mapping.fieldToProperty || {},
    updatedAt: new Date().toISOString(),
  };
  saveNotionStore(store);
  return store.mappings;
}

function buildNotionPropertyValue(
  schema: NotionPropertySchema,
  value: unknown
): any | undefined {
  if (value === undefined || value === null) return undefined;

  switch (schema.type) {
    case "title": {
      const text = sanitizeText(value, 1800);
      if (!text) return undefined;
      return { title: [{ text: { content: text } }] };
    }
    case "rich_text": {
      const text = Array.isArray(value)
        ? value.map((v) => sanitizeText(v)).join(", ")
        : sanitizeText(value, 1900);
      return { rich_text: text ? [{ text: { content: text } }] : [] };
    }
    case "url": {
      const urlStr = sanitizeText(value, 500);
      return { url: /^https?:\/\//i.test(urlStr) ? urlStr : null };
    }
    case "email": {
      const em = sanitizeText(value, 200);
      return { email: em || null };
    }
    case "phone_number": {
      const ph = sanitizeText(value, 60);
      return { phone_number: ph || null };
    }
    case "number": {
      const num =
        typeof value === "number"
          ? value
          : Number(String(value).replace(/[^0-9.-]/g, ""));
      return { number: Number.isFinite(num) ? num : null };
    }
    case "checkbox": {
      if (typeof value === "boolean") return { checkbox: value };
      const str = String(value).toLowerCase();
      return {
        checkbox:
          str === "true" || str === "yes" || str === "remote" || str === "ohio",
      };
    }
    case "select": {
      const text = sanitizeText(value, 100);
      return { select: text ? { name: text } : null };
    }
    case "status": {
      const text = sanitizeText(value, 100);
      if (!text) return undefined;
      if (schema.options && schema.options.length > 0) {
        const matchedOpt =
          schema.options.find((o) => o.toLowerCase() === text.toLowerCase()) ||
          schema.options.find((o) =>
            o.toLowerCase().includes(text.toLowerCase())
          );
        if (!matchedOpt) return undefined;
        return { status: { name: matchedOpt } };
      }
      return { status: { name: text } };
    }
    case "multi_select": {
      const arr = Array.isArray(value)
        ? value.map((v) => sanitizeText(v, 80)).filter(Boolean)
        : String(value)
            .split(",")
            .map((v) => sanitizeText(v, 80))
            .filter(Boolean);
      return {
        multi_select: arr.slice(0, 20).map((name) => ({ name })),
      };
    }
    case "date": {
      const raw = sanitizeText(value, 40);
      if (!raw) return { date: null };
      const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
      return isoMatch ? { date: { start: isoMatch[0] } } : undefined;
    }
    default:
      return undefined;
  }
}

function recordToNotionProperties(
  record: Record<string, any>,
  schema: Record<string, NotionPropertySchema>,
  fieldToProperty: Record<string, string>
): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const [domainField, value] of Object.entries(record)) {
    const notionPropName = fieldToProperty[domainField];
    if (!notionPropName) continue;
    const propSchema = schema[notionPropName];
    if (!propSchema) continue;
    const formatted = buildNotionPropertyValue(propSchema, value);
    if (formatted !== undefined) {
      payload[notionPropName] = formatted;
    }
  }

  // Ensure a title property exists for database page creation if mapped field was empty
  const titleProp = Object.values(schema).find((s) => s.type === "title");
  if (titleProp && !payload[titleProp.name]) {
    const fallbackTitle =
      record.jobTitle ||
      record.projectName ||
      record.existingSkills ||
      record.name ||
      record.title;
    if (fallbackTitle) {
      payload[titleProp.name] = {
        title: [{ text: { content: sanitizeText(fallbackTitle, 200) } }],
      };
    }
  }

  return payload;
}

export async function createNotionPageVerified(params: {
  parentDatabaseId?: string;
  parentPageId?: string;
  title?: string;
  contentParagraphs?: string[];
  properties?: Record<string, any>;
  domain?: NotionDomainKey;
  domainRecord?: Record<string, any>;
}) {
  const store = assertReady();

  if (params.parentDatabaseId) {
    const dbId = assertValidObjectId(params.parentDatabaseId, "parentDatabaseId");
    assertAllowlistIfEnabled(store, dbId);
    const db = await notionGetDatabase(dbId);
    const schema = extractDatabaseSchema(db.properties);

    let propsPayload: Record<string, any> = {};

    if (params.domain && params.domainRecord) {
      const mapping =
        store.mappings[params.domain]?.fieldToProperty ||
        autoMatchFieldToSchema(params.domain, schema);
      propsPayload = recordToNotionProperties(params.domainRecord, schema, mapping);
    }

    if (params.properties && typeof params.properties === "object") {
      for (const [k, v] of Object.entries(params.properties)) {
        const propSchema = schema[k];
        if (!propSchema) continue;
        // Support both raw scalar values and preformatted Notion property objects
        if (v && typeof v === "object" && !Array.isArray(v) && (v.title || v.rich_text || v.select || v.status || v.multi_select || v.date !== undefined || v.url !== undefined || v.number !== undefined || v.checkbox !== undefined)) {
          propsPayload[k] = v;
        } else {
          const built = buildNotionPropertyValue(propSchema, v);
          if (built !== undefined) propsPayload[k] = built;
        }
      }
    }

    const titleProp = Object.values(schema).find((s) => s.type === "title");
    if (titleProp && !propsPayload[titleProp.name] && params.title) {
      propsPayload[titleProp.name] = {
        title: [{ text: { content: sanitizeText(params.title, 250) } }],
      };
    }

    const children = (params.contentParagraphs || [])
      .map((p) => sanitizeText(p, 1900))
      .filter(Boolean)
      .slice(0, 30)
      .map((text) => ({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
      }));

    const created = await notionCreatePage({
      parent: { database_id: dbId },
      properties: propsPayload,
      children: children.length > 0 ? children : undefined,
    });

    return {
      id: String(created.id),
      title: extractObjectTitle(created),
      url: String(created.url || ""),
      lastEditedTime: String(created.last_edited_time || ""),
      normalizedProperties: normalizePageProperties(created.properties),
    };
  }

  if (params.parentPageId) {
    const pId = assertValidObjectId(params.parentPageId, "parentPageId");
    assertAllowlistIfEnabled(store, pId);
    await notionGetPage(pId); // verify read/access permissions first

    const titleText = sanitizeText(params.title || "Career Engine Note", 250);
    const children = (params.contentParagraphs || [])
      .map((p) => sanitizeText(p, 1900))
      .filter(Boolean)
      .slice(0, 50)
      .map((text) => ({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
      }));

    const created = await notionCreatePage({
      parent: { page_id: pId },
      properties: {
        title: {
          title: [{ text: { content: titleText } }],
        },
      },
      children: children.length > 0 ? children : undefined,
    });

    return {
      id: String(created.id),
      title: extractObjectTitle(created),
      url: String(created.url || ""),
      lastEditedTime: String(created.last_edited_time || ""),
      normalizedProperties: normalizePageProperties(created.properties),
    };
  }

  throw new NotionApiError(
    "Either parentDatabaseId or parentPageId is required to create a Notion page.",
    400,
    "missing_parent"
  );
}

export async function updateNotionPageVerified(
  pageId: string,
  params: {
    properties?: Record<string, any>;
    domain?: NotionDomainKey;
    domainRecord?: Record<string, any>;
    appendParagraphs?: string[];
    expectedLastEditedTime?: string;
    forceOverwrite?: boolean;
  }
) {
  const store = assertReady();
  const cleanPageId = assertValidObjectId(pageId, "pageId");

  const existing = await notionGetPage(cleanPageId);
  const parentDbId =
    existing?.parent?.data_source_id || existing?.parent?.database_id;
  const parentPageId = existing?.parent?.page_id;
  assertAllowlistIfEnabled(store, cleanPageId, parentDbId || parentPageId);

  // Conflict check: never overwrite newer Notion edits unless explicitly forced
  if (
    params.expectedLastEditedTime &&
    !params.forceOverwrite &&
    existing.last_edited_time &&
    new Date(existing.last_edited_time).getTime() >
      new Date(params.expectedLastEditedTime).getTime()
  ) {
    throw new NotionApiError(
      `Conflict detected: Notion page "${extractObjectTitle(
        existing
      )}" was modified at ${existing.last_edited_time}, which is newer than your last synced timestamp (${
        params.expectedLastEditedTime
      }).`,
      409,
      "sync_conflict"
    );
  }

  let propsPayload: Record<string, any> = {};

  if (parentDbId) {
    const db = await notionGetDatabase(parentDbId);
    const schema = extractDatabaseSchema(db.properties);

    if (params.domain && params.domainRecord) {
      const mapping =
        store.mappings[params.domain]?.fieldToProperty ||
        autoMatchFieldToSchema(params.domain, schema);
      propsPayload = recordToNotionProperties(params.domainRecord, schema, mapping);
    }

    if (params.properties && typeof params.properties === "object") {
      for (const [k, v] of Object.entries(params.properties)) {
        const propSchema = schema[k];
        if (!propSchema) continue;
        if (v && typeof v === "object" && !Array.isArray(v) && (v.title || v.rich_text || v.select || v.status || v.multi_select || v.date !== undefined || v.url !== undefined || v.number !== undefined || v.checkbox !== undefined)) {
          propsPayload[k] = v;
        } else {
          const built = buildNotionPropertyValue(propSchema, v);
          if (built !== undefined) propsPayload[k] = built;
        }
      }
    }
  } else if (params.properties?.title || params.domainRecord?.title) {
    const t = sanitizeText(params.properties?.title || params.domainRecord?.title, 250);
    if (t) {
      propsPayload.title = { title: [{ text: { content: t } }] };
    }
  }

  let updated = existing;
  if (Object.keys(propsPayload).length > 0) {
    updated = await notionUpdatePage(cleanPageId, { properties: propsPayload });
  }

  if (Array.isArray(params.appendParagraphs) && params.appendParagraphs.length > 0) {
    const blocks = params.appendParagraphs
      .map((p) => sanitizeText(p, 1900))
      .filter(Boolean)
      .slice(0, 20)
      .map((text) => ({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
      }));
    if (blocks.length > 0) {
      await notionAppendBlockChildren(cleanPageId, blocks);
    }
  }

  return {
    id: String(updated.id),
    title: extractObjectTitle(updated),
    url: String(updated.url || ""),
    lastEditedTime: String(updated.last_edited_time || ""),
    normalizedProperties: normalizePageProperties(updated.properties),
  };
}

function readField(
  normalized: Record<string, any>,
  mapping: Record<string, string>,
  fieldKey: string,
  fallbackAliases: string[]
): any {
  const mappedName = mapping[fieldKey];
  if (mappedName && normalized[mappedName] !== undefined) {
    return normalized[mappedName];
  }
  for (const [k, v] of Object.entries(normalized)) {
    const lower = k.toLowerCase();
    if (fallbackAliases.some((a) => lower === a || lower.includes(a))) {
      return v;
    }
  }
  return undefined;
}

function toStringArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => sanitizeText(x)).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/[,;\n]/)
      .map((s) => sanitizeText(s))
      .filter(Boolean);
  }
  return [];
}

function computeHash(obj: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex")
    .slice(0, 16);
}

export async function importFromNotion(params: {
  sourceType: "page" | "database";
  id: string;
  domain?: NotionDomainKey;
}) {
  assertReady();
  const cleanId = assertValidObjectId(params.id, "source id");

  if (params.sourceType === "page") {
    const page = await readNotionPage(cleanId);
    const props = page.normalizedProperties;
    const inferredSkills = toStringArr(
      props.Skills || props.skills || props.Software || props.software
    );
    return {
      sourceType: "page" as const,
      documentTitle: page.title,
      url: page.url,
      lastEditedTime: page.lastEditedTime,
      plainText: page.plainText,
      normalizedProperties: props,
      imported: {
        profileNotes: page.plainText,
        skills: inferredSkills,
      },
    };
  }

  const dbData = await getNotionDatabaseRecords(cleanId, { pageSize: 100 });
  const store = loadNotionStore();
  const domain =
    params.domain ||
    (dbData.database.title.toLowerCase().includes("portfolio") ||
    dbData.database.title.toLowerCase().includes("project")
      ? "portfolio"
      : dbData.database.title.toLowerCase().includes("skill")
      ? "skills"
      : "applications");

  const mapping =
    store.mappings[domain]?.databaseId === dbData.database.id
      ? store.mappings[domain]!.fieldToProperty
      : autoMatchFieldToSchema(domain, dbData.database.properties || {});

  const importedRecords = dbData.records.map((rec) => {
    const n = rec.normalizedFields;
    if (domain === "applications") {
      const jobTitle = String(
        readField(n, mapping, "jobTitle", ["job title", "role", "title", "name"]) ||
          rec.title
      );
      const company = String(
        readField(n, mapping, "company", ["company", "employer"]) ||
          "Notion Import"
      );
      const jobUrl = String(
        readField(n, mapping, "jobUrl", ["url", "link"]) || rec.url
      );
      const status = String(
        readField(n, mapping, "status", ["status", "stage"]) || "Discovered"
      );
      const remoteRaw = readField(n, mapping, "remoteEligibility", [
        "remote",
        "work arrangement",
      ]);
      const ohioRaw = readField(n, mapping, "ohioEligibility", [
        "ohio",
        "location",
      ]);
      const appDate = String(
        readField(n, mapping, "applicationDate", ["application date", "applied"]) ||
          ""
      );
      const followUpDate = String(
        readField(n, mapping, "followUpDate", ["follow-up", "follow up"]) || ""
      );
      const salaryRaw = readField(n, mapping, "salary", ["salary", "pay", "rate"]);
      const nextAction = String(
        readField(n, mapping, "nextAction", ["next action", "notes"]) || ""
      );

      return {
        notionPageId: rec.id,
        notionLastEdited: rec.lastEditedTime,
        domain: "applications" as const,
        data: {
          jobTitle,
          company,
          jobUrl,
          status,
          workArrangement:
            remoteRaw === true || String(remoteRaw || "").toLowerCase().includes("remote")
              ? "Remote"
              : String(remoteRaw || "").toLowerCase().includes("hybrid")
              ? "Hybrid"
              : "On-site",
          location:
            typeof ohioRaw === "string" && ohioRaw
              ? ohioRaw
              : ohioRaw === true
              ? "Ohio / Remote"
              : "Remote / Ohio",
          applicationDate: appDate,
          followUpDate,
          salary:
            typeof salaryRaw === "number"
              ? salaryRaw
              : Number(String(salaryRaw || "").replace(/[^0-9]/g, "")) || 55000,
          salaryLabel: salaryRaw ? String(salaryRaw) : "",
          nextAction,
        },
      };
    }

    if (domain === "portfolio") {
      return {
        notionPageId: rec.id,
        notionLastEdited: rec.lastEditedTime,
        domain: "portfolio" as const,
        data: {
          projectName: String(
            readField(n, mapping, "projectName", ["project", "name", "title"]) ||
              rec.title
          ),
          category: String(
            readField(n, mapping, "category", ["category", "division"]) ||
              "Architecture"
          ),
          software: toStringArr(
            readField(n, mapping, "software", ["software", "tools"])
          ),
          skillsDemonstrated: toStringArr(
            readField(n, mapping, "skillsDemonstrated", ["skills"])
          ),
          deliverables: String(
            readField(n, mapping, "deliverables", ["deliverables", "summary"]) || ""
          ),
          projectStatus: String(
            readField(n, mapping, "projectStatus", ["status", "stage"]) ||
              "In Progress"
          ),
          portfolioUrl: String(
            readField(n, mapping, "portfolioUrl", ["url", "link"]) || rec.url
          ),
        },
      };
    }

    if (domain === "skills") {
      return {
        notionPageId: rec.id,
        notionLastEdited: rec.lastEditedTime,
        domain: "skills" as const,
        data: {
          existingSkills: String(
            readField(n, mapping, "existingSkills", ["skill", "name", "title"]) ||
              rec.title
          ),
          proficiency: readField(n, mapping, "proficiency", [
            "proficiency",
            "level",
            "status",
          ]),
          evidence: String(
            readField(n, mapping, "evidence", ["evidence", "proof"]) || ""
          ),
          developingSkills: toStringArr(
            readField(n, mapping, "developingSkills", ["developing"])
          ),
          missingSkills: toStringArr(
            readField(n, mapping, "missingSkills", ["missing", "gap"])
          ),
          learningPriorities: String(
            readField(n, mapping, "learningPriorities", ["priority", "learning"]) ||
              ""
          ),
        },
      };
    }

    return {
      notionPageId: rec.id,
      notionLastEdited: rec.lastEditedTime,
      domain: "profile" as const,
      data: {
        name: String(
          readField(n, mapping, "name", ["name", "title"]) || rec.title
        ),
        employmentHistory: String(
          readField(n, mapping, "employmentHistory", ["employment", "experience"]) ||
            ""
        ),
        education: String(
          readField(n, mapping, "education", ["education", "school"]) || ""
        ),
        verifiedExperience: String(
          readField(n, mapping, "verifiedExperience", ["verified"]) || ""
        ),
        skills: toStringArr(readField(n, mapping, "skills", ["skills"])),
      },
    };
  });

  return {
    sourceType: "database" as const,
    documentTitle: dbData.database.title,
    databaseId: dbData.database.id,
    domain,
    schema: dbData.database.properties,
    mapping,
    recordsCount: importedRecords.length,
    records: importedRecords,
  };
}

export async function runManualSync(params: {
  direction: "pull" | "push" | "bidirectional";
  domains: NotionDomainKey[];
  localData?: {
    applications?: {
      id: string;
      jobTitle: string;
      company: string;
      jobUrl?: string;
      status: string;
      workArrangement?: string;
      location?: string;
      applicationDate?: string;
      followUpDate?: string;
      salary?: number;
      nextAction?: string;
      updatedAt?: string;
    }[];
    portfolio?: {
      id: string;
      projectName: string;
      category: string;
      software: string[];
      skillsDemonstrated: string[];
      deliverables?: string;
      projectStatus: string;
      portfolioUrl?: string;
      updatedAt?: string;
    }[];
    skills?: {
      id: string;
      existingSkills: string;
      proficiency: string;
      evidence?: string;
      developingSkills?: string[];
      missingSkills?: string[];
      learningPriorities?: string;
      updatedAt?: string;
    }[];
    profile?: {
      id: string;
      name: string;
      employmentHistory: string;
      education: string;
      verifiedExperience: string;
      skills: string[];
      updatedAt?: string;
    }[];
  };
  forceConflictIds?: string[];
}) {
  const store = assertReady();
  const domains: NotionDomainKey[] =
    Array.isArray(params.domains) && params.domains.length > 0
      ? params.domains
      : ["applications", "portfolio", "skills"];

  let created = 0;
  let updated = 0;
  let skippedDuplicates = 0;
  let conflictsDetected = 0;
  const errors: string[] = [];
  const pulledByDomain: Record<string, any[]> = {};

  for (const domain of domains) {
    const mapping = store.mappings[domain];
    if (!mapping || !mapping.databaseId) {
      errors.push(
        `No Notion database mapped for "${domain}". Map an existing database first.`
      );
      continue;
    }

    try {
      const dbResult = await getNotionDatabaseRecords(mapping.databaseId, {
        pageSize: 100,
      });
      const schema = dbResult.database.properties || {};

      // Track pulled records so client can merge safely
      if (params.direction === "pull" || params.direction === "bidirectional") {
        const imp = await importFromNotion({
          sourceType: "database",
          id: mapping.databaseId,
          domain,
        });
        pulledByDomain[domain] = imp.records || [];

        // Record mapping links for pulled records
        for (const row of imp.records || []) {
          const existingLink = store.recordLinks.find(
            (l) =>
              normalizeIdCompact(l.notionPageId) ===
              normalizeIdCompact(row.notionPageId)
          );
          const nowIso = new Date().toISOString();
          const titleVal =
            row.data.jobTitle ||
            row.data.projectName ||
            row.data.existingSkills ||
            row.data.name ||
            "Record";

          if (!existingLink) {
            store.recordLinks.push({
              localId: `notion-${normalizeIdCompact(row.notionPageId).slice(0, 10)}`,
              notionPageId: row.notionPageId,
              domain,
              title: String(titleVal),
              lastLocalEditedAt: row.notionLastEdited || nowIso,
              lastNotionEditedAt: row.notionLastEdited || nowIso,
              lastSyncedAt: nowIso,
              lastSyncHash: computeHash(row.data),
            });
          } else {
            existingLink.lastNotionEditedAt = row.notionLastEdited || nowIso;
            existingLink.lastSyncedAt = nowIso;
            existingLink.lastSyncHash = computeHash(row.data);
          }
        }
      }

      if (params.direction === "push" || params.direction === "bidirectional") {
        const localRows: any[] = params.localData?.[domain] || [];
        const existingTitlesMap = new Map<
          string,
          { id: string; lastEditedTime: string; title: string }
        >();

        for (const rec of dbResult.records) {
          const companyVal = String(
            readField(rec.normalizedFields, mapping.fieldToProperty, "company", [
              "company",
            ]) || ""
          );
          const composite =
            domain === "applications" && companyVal
              ? `${rec.title.toLowerCase().trim()}::${companyVal
                  .toLowerCase()
                  .trim()}`
              : rec.title.toLowerCase().trim();
          existingTitlesMap.set(composite, {
            id: rec.id,
            lastEditedTime: rec.lastEditedTime,
            title: rec.title,
          });
        }

        for (const item of localRows) {
          const localId = String(item.id || "");
          const title = String(
            item.jobTitle ||
              item.projectName ||
              item.existingSkills ||
              item.name ||
              "Untitled"
          );
          const compositeKey =
            domain === "applications" && item.company
              ? `${title.toLowerCase().trim()}::${String(item.company)
                  .toLowerCase()
                  .trim()}`
              : title.toLowerCase().trim();

          const currentHash = computeHash(item);
          const link = store.recordLinks.find(
            (l) => l.localId === localId && l.domain === domain
          );
          const matchedExisting = existingTitlesMap.get(compositeKey);
          const targetNotionId = link?.notionPageId || matchedExisting?.id;

          if (targetNotionId) {
            // Skip unchanged
            if (link && link.lastSyncHash === currentHash) {
              skippedDuplicates += 1;
              continue;
            }

            const liveRecord = dbResult.records.find(
              (r) => normalizeIdCompact(r.id) === normalizeIdCompact(targetNotionId)
            );
            const liveEdited = liveRecord?.lastEditedTime || matchedExisting?.lastEditedTime || "";
            const lastKnownNotionEdited = link?.lastNotionEditedAt || "";

            const isForced = Boolean(
              params.forceConflictIds?.includes(targetNotionId) ||
                params.forceConflictIds?.includes(localId)
            );

            // Conflict protection: never overwrite newer Notion edits without explicit resolution
            if (
              !isForced &&
              liveEdited &&
              (!lastKnownNotionEdited ||
                new Date(liveEdited).getTime() >
                  new Date(lastKnownNotionEdited).getTime())
            ) {
              conflictsDetected += 1;
              const alreadyOpen = store.conflicts.find(
                (c) =>
                  normalizeIdCompact(c.notionPageId) ===
                    normalizeIdCompact(targetNotionId) && c.resolution === "pending"
              );
              if (!alreadyOpen) {
                store.conflicts.unshift({
                  id: `conf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  domain,
                  localId,
                  notionPageId: targetNotionId,
                  title,
                  reason:
                    "Notion record has newer edits than Career Engine's last synchronized timestamp.",
                  localUpdatedAt: item.updatedAt || new Date().toISOString(),
                  notionUpdatedAt: liveEdited,
                  resolution: "pending",
                  detectedAt: new Date().toISOString(),
                });
              }
              continue;
            }

            const updatedPage = await updateNotionPageVerified(targetNotionId, {
              domain,
              domainRecord: item,
              forceOverwrite: true,
            });
            updated += 1;

            const nowIso = new Date().toISOString();
            if (link) {
              link.lastNotionEditedAt = updatedPage.lastEditedTime || nowIso;
              link.lastSyncedAt = nowIso;
              link.lastSyncHash = currentHash;
            } else {
              store.recordLinks.push({
                localId,
                notionPageId: updatedPage.id,
                domain,
                title,
                lastLocalEditedAt: item.updatedAt || nowIso,
                lastNotionEditedAt: updatedPage.lastEditedTime || nowIso,
                lastSyncedAt: nowIso,
                lastSyncHash: currentHash,
              });
            }
          } else {
            // Create new Notion row using existing mapped schema
            const propsPayload = recordToNotionProperties(
              item,
              schema,
              mapping.fieldToProperty
            );
            const createdPage = await notionCreatePage({
              parent: { database_id: mapping.databaseId },
              properties: propsPayload,
            });
            created += 1;
            const nowIso = new Date().toISOString();
            store.recordLinks.push({
              localId,
              notionPageId: String(createdPage.id),
              domain,
              title,
              lastLocalEditedAt: item.updatedAt || nowIso,
              lastNotionEditedAt: String(createdPage.last_edited_time || nowIso),
              lastSyncedAt: nowIso,
              lastSyncHash: currentHash,
            });
          }
        }
      }
    } catch (err: any) {
      errors.push(`${domain}: ${sanitizeNotionError(err)}`);
    }
  }

  const now = new Date().toISOString();
  store.lastSyncAt = now;

  const entry: SyncHistoryEntry = {
    id: `sync-${Date.now()}`,
    timestamp: now,
    direction: params.direction,
    domains,
    created,
    updated,
    skippedDuplicates,
    conflicts: conflictsDetected,
    errors,
    status:
      errors.length === 0
        ? "success"
        : created + updated > 0
        ? "partial"
        : "error",
    summary: `${params.direction.toUpperCase()} (${domains.join(
      ", "
    )}): +${created} created, ${updated} updated, ${skippedDuplicates} unchanged, ${conflictsDetected} conflicts`,
  };

  store.syncHistory = [entry, ...store.syncHistory].slice(0, 60);
  saveNotionStore(store);

  return {
    entry,
    pulledByDomain,
    conflicts: store.conflicts.filter((c) => c.resolution === "pending"),
    recordLinksCount: store.recordLinks.length,
  };
}

export function getSyncStatusSummary() {
  const store = loadNotionStore();
  return {
    lastSyncAt: store.lastSyncAt,
    linkedRecordsCount: store.recordLinks.length,
    recordLinks: store.recordLinks.slice(0, 100),
    pendingConflicts: store.conflicts.filter((c) => c.resolution === "pending"),
    allConflicts: store.conflicts.slice(0, 50),
    history: store.syncHistory.slice(0, 30),
    mappings: store.mappings,
  };
}

export async function resolveConflict(
  conflictId: string,
  resolution: "keep_notion" | "force_local",
  localRecord?: Record<string, any>
) {
  const store = assertReady();
  const conflict = store.conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    throw new NotionApiError("Sync conflict not found.", 404, "not_found");
  }

  if (resolution === "force_local") {
    if (!localRecord) {
      throw new NotionApiError(
        "localRecord payload is required to overwrite Notion.",
        400,
        "missing_local_record"
      );
    }
    const updated = await updateNotionPageVerified(conflict.notionPageId, {
      domain: conflict.domain,
      domainRecord: localRecord,
      forceOverwrite: true,
    });
    const link = store.recordLinks.find(
      (l) =>
        normalizeIdCompact(l.notionPageId) ===
        normalizeIdCompact(conflict.notionPageId)
    );
    if (link) {
      link.lastNotionEditedAt = updated.lastEditedTime;
      link.lastSyncedAt = new Date().toISOString();
      link.lastSyncHash = computeHash(localRecord);
    }
  } else {
    // Keep Notion version: update link's baseline hash/timestamp
    const page = await readNotionPage(conflict.notionPageId);
    const link = store.recordLinks.find(
      (l) =>
        normalizeIdCompact(l.notionPageId) ===
        normalizeIdCompact(conflict.notionPageId)
    );
    if (link) {
      link.lastNotionEditedAt = page.lastEditedTime;
      link.lastSyncedAt = new Date().toISOString();
    }
  }

  conflict.resolution = resolution;
  saveNotionStore(store);

  return {
    resolved: conflict,
    syncStatus: getSyncStatusSummary(),
  };
}
