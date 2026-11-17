import net from "node:net";

export interface FetchedUrlResult {
  url: string;
  ok: boolean;
  title?: string;
  text?: string;
  error?: string;
}

const MAX_URLS_PER_MESSAGE = 2;
const MAX_RESPONSE_BYTES = 600_000;
const MAX_EXTRACTED_CHARS = 14_000;
const FETCH_TIMEOUT_MS = 10_000;

function isPrivateIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (clean === "::1" || clean === "::" || clean.startsWith("fe80:") || clean.startsWith("fc") || clean.startsWith("fd")) {
    return true;
  }
  const v4 = clean.startsWith("::ffff:") ? clean.slice(7) : clean;
  const parts = v4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isAllowedPublicUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL format." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Unsupported URL protocol." };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return { ok: false, reason: "Local or internal hostnames cannot be opened." };
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    return { ok: false, reason: "Private network addresses cannot be opened." };
  }
  return { ok: true, url: parsed };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    });
}

function extractReadableText(rawBody: string, contentType: string): { title?: string; text: string } {
  const looksHtml =
    contentType.includes("html") ||
    /^\s*(<!doctype|<html|<head|<body)/i.test(rawBody);

  if (!looksHtml) {
    return { text: rawBody.replace(/\r\n/g, "\n").trim() };
  }

  const titleMatch = rawBody.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim())
    : undefined;

  const stripped = rawBody
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|header|footer|aside|li|ul|ol|h[1-6]|tr|td|th|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const decoded = decodeHtmlEntities(stripped)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, text: decoded };
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
  const cleaned = matches
    .map((u) => u.replace(/[.,;:!?)'"\]]+$/, ""))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, MAX_URLS_PER_MESSAGE);
}

export async function fetchUrlContent(rawUrl: string): Promise<FetchedUrlResult> {
  const check = isAllowedPublicUrl(rawUrl);
  if ("reason" in check) {
    return { url: rawUrl, ok: false, error: check.reason };
  }

  try {
    const res = await fetch(check.url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      return {
        url: rawUrl,
        ok: false,
        error: `HTTP ${res.status} ${res.statusText || ""}`.trim(),
      };
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (
      contentType &&
      !contentType.includes("text/") &&
      !contentType.includes("html") &&
      !contentType.includes("json") &&
      !contentType.includes("xml")
    ) {
      return {
        url: rawUrl,
        ok: false,
        error: `Unsupported content type (${contentType}).`,
      };
    }

    const reader = res.body?.getReader();
    let rawBody = "";
    if (reader) {
      const decoder = new TextDecoder("utf-8", { fatal: false });
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        rawBody += decoder.decode(value, { stream: true });
        if (totalBytes >= MAX_RESPONSE_BYTES) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
      rawBody += decoder.decode();
    } else {
      rawBody = (await res.text()).slice(0, MAX_RESPONSE_BYTES);
    }

    const { title, text } = extractReadableText(rawBody, contentType);
    const lower = text.toLowerCase();

    const looksBlockedOrEmptyShell =
      text.length < 120 ||
      (text.length < 600 &&
        (lower.includes("enable javascript") ||
          lower.includes("javascript is disabled") ||
          lower.includes("just a moment") ||
          lower.includes("verify you are human") ||
          lower.includes("captcha") ||
          lower.includes("access denied")));

    if (looksBlockedOrEmptyShell) {
      return {
        url: rawUrl,
        ok: false,
        error: "Page requires JavaScript rendering, sign-in, or blocked automated access.",
      };
    }

    return {
      url: rawUrl,
      ok: true,
      title,
      text: text.slice(0, MAX_EXTRACTED_CHARS),
    };
  } catch (err: any) {
    return {
      url: rawUrl,
      ok: false,
      error: err?.name === "TimeoutError" ? "Request timed out." : err?.message || "Failed to fetch URL.",
    };
  }
}

export async function buildUrlContextAddendum(userMessageText: string): Promise<string> {
  const urls = extractUrlsFromText(userMessageText);
  if (urls.length === 0) return "";

  const results = await Promise.all(urls.map((u) => fetchUrlContent(u)));
  const blocks: string[] = [];

  for (const r of results) {
    if (r.ok && r.text) {
      blocks.push(
        [
          `[OPENED_LINK_CONTENT url="${r.url}"]`,
          r.title ? `Page Title: ${r.title}` : "",
          r.text,
          `[/OPENED_LINK_CONTENT]`,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } else {
      blocks.push(
        [
          `[LINK_OPEN_FAILED url="${r.url}" reason="${r.error || "Unable to open link"}"]`,
          `The link ${r.url} could not be opened (${r.error || "Unable to open link"}).`,
          `If the user did not also paste the job posting text directly in their message, clearly tell the user that the link could not be opened and ask them to paste the job posting text. Do not guess or invent job posting details from the URL.`,
          `[/LINK_OPEN_FAILED]`,
        ].join("\n")
      );
    }
  }

  return blocks.join("\n\n");
}
