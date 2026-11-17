import { ChatMessageInput, ChatUsageReport } from "./types";

export function formatMessagesWithAttachments(
  messages: ChatMessageInput[],
  systemPrompt?: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  const formatted: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (systemPrompt && systemPrompt.trim()) {
    formatted.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const m of messages) {
    let content = m.content || "";
    if (m.attachments && m.attachments.length > 0) {
      const attBlock = m.attachments
        .map(
          (a) =>
            `\n\n--- Attachment: ${a.name} (${a.mimeType || "text/plain"}) ---\n${a.content.slice(
              0,
              24000
            )}`
        )
        .join("");
      content = `${content}${attBlock}`;
    }
    formatted.push({ role: m.role, content });
  }
  return formatted;
}

export async function runOpenAICompatCompletion(params: {
  url: string;
  headers: Record<string, string>;
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  signal?: AbortSignal;
  pricePer1MPrompt?: number;
  pricePer1MCompletion?: number;
}): Promise<{ content: string; usage: ChatUsageReport }> {
  const body: Record<string, any> = {
    messages: params.messages,
    stream: false,
  };
  if (params.model) body.model = params.model;
  if (typeof params.temperature === "number") body.temperature = params.temperature;

  const res = await fetch(params.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...params.headers,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
  }

  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content ?? "";
  const promptTokens = Number(data?.usage?.prompt_tokens || 0);
  const completionTokens = Number(data?.usage?.completion_tokens || 0);
  const totalTokens = Number(data?.usage?.total_tokens || promptTokens + completionTokens);

  const estimatedCostUsd =
    typeof data?.usage?.cost === "number"
      ? data.usage.cost
      : Number(
          (
            (promptTokens / 1_000_000) * (params.pricePer1MPrompt || 0) +
            (completionTokens / 1_000_000) * (params.pricePer1MCompletion || 0)
          ).toFixed(6)
        );

  return {
    content,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd,
    },
  };
}

export async function runOpenAICompatStream(params: {
  url: string;
  headers: Record<string, string>;
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  onDelta: (text: string) => void;
  signal?: AbortSignal;
  pricePer1MPrompt?: number;
  pricePer1MCompletion?: number;
}): Promise<ChatUsageReport> {
  const body: Record<string, any> = {
    messages: params.messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (params.model) body.model = params.model;
  if (typeof params.temperature === "number") body.temperature = params.temperature;

  const res = await fetch(params.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...params.headers,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300) || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let reportedCost: number | null = null;
  let charCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (dataStr === "[DONE]") continue;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          charCount += delta.length;
          params.onDelta(delta);
        }
        if (parsed?.usage) {
          promptTokens = Number(parsed.usage.prompt_tokens || promptTokens);
          completionTokens = Number(parsed.usage.completion_tokens || completionTokens);
          totalTokens = Number(
            parsed.usage.total_tokens || promptTokens + completionTokens
          );
          if (typeof parsed.usage.cost === "number") {
            reportedCost = parsed.usage.cost;
          }
        }
      } catch {
        // Ignore partial or non-JSON keepalive SSE comments
      }
    }
  }

  // Rough token fallback if upstream stream didn't include usage chunk
  if (totalTokens === 0 && charCount > 0) {
    completionTokens = Math.max(1, Math.round(charCount / 4));
    promptTokens = Math.max(
      1,
      Math.round(params.messages.reduce((s, m) => s + m.content.length, 0) / 4)
    );
    totalTokens = promptTokens + completionTokens;
  }

  const estimatedCostUsd =
    reportedCost !== null
      ? reportedCost
      : Number(
          (
            (promptTokens / 1_000_000) * (params.pricePer1MPrompt || 0) +
            (completionTokens / 1_000_000) * (params.pricePer1MCompletion || 0)
          ).toFixed(6)
        );

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
  };
}
