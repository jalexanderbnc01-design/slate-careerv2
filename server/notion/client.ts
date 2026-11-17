export const DEFAULT_NOTION_VERSION = "2022-06-28";

export class NotionApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 500, code = "notion_error") {
    super(message);
    this.name = "NotionApiError";
    this.status = status;
    this.code = code;
  }
}

export function getNotionCredentials(): {
  apiKey: string;
  apiVersion: string;
  baseUrl: string;
  configured: boolean;
} {
  const apiKey = (process.env.NOTION_API_KEY || "").trim();
  const apiVersion =
    (process.env.NOTION_API_VERSION || DEFAULT_NOTION_VERSION).trim() ||
    DEFAULT_NOTION_VERSION;
  const baseUrl = (
    process.env.NOTION_API_BASE_URL || "https://api.notion.com/v1"
  )
    .trim()
    .replace(/\/+$/, "");

  const configured = Boolean(
    apiKey &&
      apiKey.length >= 10 &&
      !apiKey.includes("MY_NOTION_API_KEY") &&
      !apiKey.includes("your_notion")
  );

  return { apiKey, apiVersion, baseUrl, configured };
}

export function sanitizeNotionError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
      ? err
      : "Unexpected Notion API error.";

  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(secret|ntn)_[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_TOKEN]")
    .slice(0, 500);
}

export function normalizeNotionId(id: string): string {
  return id.trim().replace(/^https?:\/\/(www\.)?notion\.so\/.*?-([a-f0-9]{32}).*$/i, "$2");
}

export function isValidNotionId(id: string): boolean {
  const clean = normalizeNotionId(id).replace(/-/g, "");
  return /^[a-f0-9]{32}$/i.test(clean);
}

async function notionFetch<T = any>(
  endpoint: string,
  init: RequestInit = {},
  retryOnRateLimit = true
): Promise<T> {
  const { apiKey, apiVersion, baseUrl, configured } = getNotionCredentials();
  if (!configured) {
    throw new NotionApiError(
      "Notion API is not configured. Set NOTION_API_KEY and NOTION_API_VERSION in AI Studio Secrets or server environment.",
      400,
      "not_configured"
    );
  }

  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": apiVersion,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch (err: any) {
    throw new NotionApiError(
      `Failed to reach Notion API: ${sanitizeNotionError(err)}`,
      502,
      "network_error"
    );
  }

  if (res.status === 429 && retryOnRateLimit) {
    const retrySec = Number(res.headers.get("retry-after") || "1");
    await new Promise((r) => setTimeout(r, Math.min(3000, Math.max(400, retrySec * 1000))));
    return notionFetch<T>(endpoint, init, false);
  }

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    const notionCode = json?.code || "api_error";
    const safeMsg = sanitizeNotionError(
      json?.message || `Notion API returned HTTP ${res.status}`
    );

    if (res.status === 401) {
      throw new NotionApiError(
        `Notion authentication failed (${safeMsg}). Check NOTION_API_KEY in server secrets.`,
        401,
        "unauthorized"
      );
    }
    if (res.status === 403 || res.status === 404) {
      throw new NotionApiError(
        `Notion access denied or object not shared with integration (${safeMsg}). Share the page/database with your integration in Notion.`,
        res.status,
        notionCode
      );
    }
    throw new NotionApiError(safeMsg, res.status, notionCode);
  }

  return json as T;
}

export async function notionGetBotUser() {
  return notionFetch<any>("/users/me", { method: "GET" });
}

export function isDataSourceApiVersion(apiVersion: string): boolean {
  return apiVersion.trim() >= "2025-09-03";
}

export async function notionSearch(params: {
  query?: string;
  filterObject?: "page" | "database";
  startCursor?: string;
  pageSize?: number;
}) {
  const { apiVersion } = getNotionCredentials();
  const body: Record<string, any> = {
    page_size: Math.min(100, Math.max(1, params.pageSize || 50)),
    sort: {
      direction: "descending",
      timestamp: "last_edited_time",
    },
  };
  if (params.query && params.query.trim()) {
    body.query = params.query.trim();
  }
  if (params.filterObject) {
    const filterValue =
      params.filterObject === "database" && isDataSourceApiVersion(apiVersion)
        ? "data_source"
        : params.filterObject;
    body.filter = { value: filterValue, property: "object" };
  }
  if (params.startCursor) {
    body.start_cursor = params.startCursor;
  }
  return notionFetch<{
    results: any[];
    has_more: boolean;
    next_cursor: string | null;
  }>("/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function notionGetPage(pageId: string) {
  return notionFetch<any>(`/pages/${encodeURIComponent(normalizeNotionId(pageId))}`, {
    method: "GET",
  });
}

export async function notionGetBlockChildren(blockId: string, startCursor?: string) {
  const qs = new URLSearchParams({ page_size: "100" });
  if (startCursor) qs.set("start_cursor", startCursor);
  return notionFetch<{
    results: any[];
    has_more: boolean;
    next_cursor: string | null;
  }>(`/blocks/${encodeURIComponent(normalizeNotionId(blockId))}/children?${qs.toString()}`, {
    method: "GET",
  });
}

export async function notionGetDatabase(databaseId: string) {
  const { apiVersion } = getNotionCredentials();
  const cleanId = encodeURIComponent(normalizeNotionId(databaseId));

  if (isDataSourceApiVersion(apiVersion)) {
    try {
      return await notionFetch<any>(`/data_sources/${cleanId}`, {
        method: "GET",
      });
    } catch (err: any) {
      if (err?.status !== 404) throw err;
      const db = await notionFetch<any>(`/databases/${cleanId}`, {
        method: "GET",
      });
      if (!db?.properties && Array.isArray(db?.data_sources) && db.data_sources[0]?.id) {
        const ds = await notionFetch<any>(
          `/data_sources/${encodeURIComponent(normalizeNotionId(db.data_sources[0].id))}`,
          { method: "GET" }
        );
        return { ...db, ...ds, properties: ds.properties || db.properties };
      }
      return db;
    }
  }

  return notionFetch<any>(`/databases/${cleanId}`, { method: "GET" });
}

export async function notionQueryDatabase(
  databaseId: string,
  params: {
    startCursor?: string;
    pageSize?: number;
    filter?: any;
    sorts?: any[];
  } = {}
) {
  const { apiVersion } = getNotionCredentials();
  const cleanId = encodeURIComponent(normalizeNotionId(databaseId));
  const body: Record<string, any> = {
    page_size: Math.min(100, Math.max(1, params.pageSize || 50)),
  };
  if (params.startCursor) body.start_cursor = params.startCursor;
  if (params.filter) body.filter = params.filter;
  if (params.sorts) body.sorts = params.sorts;

  if (isDataSourceApiVersion(apiVersion)) {
    try {
      return await notionFetch<{
        results: any[];
        has_more: boolean;
        next_cursor: string | null;
      }>(`/data_sources/${cleanId}/query`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      if (err?.status !== 404) throw err;
      const db = await notionFetch<any>(`/databases/${cleanId}`, {
        method: "GET",
      });
      const dsId = db?.data_sources?.[0]?.id;
      if (dsId) {
        return notionFetch<{
          results: any[];
          has_more: boolean;
          next_cursor: string | null;
        }>(`/data_sources/${encodeURIComponent(normalizeNotionId(dsId))}/query`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      throw err;
    }
  }

  return notionFetch<{
    results: any[];
    has_more: boolean;
    next_cursor: string | null;
  }>(`/databases/${cleanId}/query`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function notionCreatePage(payload: {
  parent: { database_id: string } | { data_source_id: string } | { page_id: string };
  properties: Record<string, any>;
  children?: any[];
}) {
  const { apiVersion } = getNotionCredentials();
  if (
    isDataSourceApiVersion(apiVersion) &&
    "database_id" in payload.parent
  ) {
    try {
      return await notionFetch<any>("/pages", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      if (err?.status === 400 || err?.status === 404) {
        return notionFetch<any>("/pages", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            parent: { data_source_id: payload.parent.database_id },
          }),
        });
      }
      throw err;
    }
  }
  return notionFetch<any>("/pages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function notionUpdatePage(
  pageId: string,
  payload: {
    properties?: Record<string, any>;
    archived?: boolean;
  }
) {
  return notionFetch<any>(
    `/pages/${encodeURIComponent(normalizeNotionId(pageId))}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function notionAppendBlockChildren(blockId: string, children: any[]) {
  return notionFetch<any>(
    `/blocks/${encodeURIComponent(normalizeNotionId(blockId))}/children`,
    {
      method: "PATCH",
      body: JSON.stringify({ children }),
    }
  );
}
