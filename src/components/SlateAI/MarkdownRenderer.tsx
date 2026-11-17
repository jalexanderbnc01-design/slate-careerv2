import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

function highlightCodeTokens(code: string, lang: string): React.ReactNode[] {
  const keywords =
    /\b(const|let|var|function|return|import|export|from|default|if|else|for|while|async|await|try|catch|throw|new|class|interface|type|extends|implements|true|false|null|undefined|def|print|SELECT|FROM|WHERE|INSERT|UPDATE)\b/g;

  return code.split("\n").map((line, lineIdx) => {
    // Simple comment line detection
    const trimmed = line.trim();
    if (
      trimmed.startsWith("//") ||
      (lang !== "markdown" && trimmed.startsWith("#"))
    ) {
      return (
        <div key={lineIdx} className="text-slate-500 italic">
          {line || " "}
        </div>
      );
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = new RegExp(
      `(${keywords.source}|"[^"]*"|'[^']*'|` + "`[^`]*`" + `|\\b\\d+(?:\\.\\d+)?\\b)`,
      "g"
    );
    let match: RegExpExecArray | null;
    let tokenIdx = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      const token = match[0];
      let cls = "text-slate-100";
      if (token.startsWith('"') || token.startsWith("'") || token.startsWith("`")) {
        cls = "text-emerald-300";
      } else if (/^\d/.test(token)) {
        cls = "text-amber-300";
      } else {
        cls = "text-sky-300 font-medium";
      }
      parts.push(
        <span key={tokenIdx++} className={cls}>
          {token}
        </span>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return (
      <div key={lineIdx} className="min-h-[1.25em]">
        {parts.length > 0 ? parts : " "}
      </div>
    );
  });
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span>{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed text-slate-200 select-text">
        <code>{highlightCodeTokens(code, language)}</code>
      </pre>
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(
        <code
          key={idx++}
          className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11.5px] text-sky-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={idx++} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(
        <em key={idx++} className="italic text-slate-200">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        tokens.push(
          <a
            key={idx++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        tokens.push(token);
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

function renderTextSegment(segment: string, baseKey: number) {
  const lines = segment.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls =
        level === 1
          ? "text-base font-semibold text-white mt-3 mb-1.5"
          : level === 2
          ? "text-sm font-semibold text-white mt-3 mb-1"
          : "text-xs font-semibold text-slate-200 mt-2 mb-1";
      blocks.push(
        <div key={`${baseKey}-h-${i}`} className={cls}>
          {renderInline(headingMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // Markdown table
    if (
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|/.test(lines[i + 1])
    ) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().includes("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const parseCells = (row: string) =>
        row
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const headers = parseCells(tableLines[0]);
      const rows = tableLines.slice(2).map(parseCells);
      blocks.push(
        <div key={`${baseKey}-tbl-${i}`} className="my-2.5 overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
            <thead className="bg-slate-950 text-slate-300">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 border-b border-slate-800 font-medium">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rows.map((r, ri) => (
                <tr key={ri} className="bg-slate-900/40">
                  {r.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`${baseKey}-ul-${i}`} className="list-disc pl-5 my-1.5 space-y-1 text-xs text-slate-200">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`${baseKey}-ol-${i}`} className="list-decimal pl-5 my-1.5 space-y-1 text-xs text-slate-200">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={`${baseKey}-bq-${i}`}
          className="my-2 px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 italic"
        >
          {renderInline(quoteLines.join(" "))}
        </blockquote>
      );
      continue;
    }

    // Standard paragraph
    blocks.push(
      <p key={`${baseKey}-p-${i}`} className="text-xs leading-relaxed text-slate-200 my-1.5">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return blocks;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const segments: React.ReactNode[] = [];
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let segKey = 0;

  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push(
        <React.Fragment key={segKey++}>
          {renderTextSegment(content.slice(lastIndex, match.index), segKey)}
        </React.Fragment>
      );
    }
    segments.push(
      <React.Fragment key={`code-${segKey++}`}>
        <CodeBlock language={match[1]} code={match[2].replace(/\n$/, "")} />
      </React.Fragment>
    );
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push(
      <React.Fragment key={segKey++}>
        {renderTextSegment(content.slice(lastIndex), segKey)}
      </React.Fragment>
    );
  }

  return <div className="space-y-1">{segments}</div>;
}
