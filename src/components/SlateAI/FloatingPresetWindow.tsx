import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Cpu, Minus, Maximize2, Minimize2, ChevronUp, X } from "lucide-react";

import type { UserProfile } from "../../types";

export interface PresetChatRunPayload {
  action?: "start" | "continue" | "revise";
  presetNumber: number;
  presetName?: string;
  steps?: number;
  stepNumber?: number;
  message: string;
}

interface FloatingPresetWindowProps {
  isOpen: boolean;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  onRunPresetInChat?: (payload: PresetChatRunPayload) => Promise<string>;
  userProfile?: UserProfile;
}

const MIN_WIDTH = 320;
const MIN_HEIGHT = 260;
const TITLE_BAR_HEIGHT = 40;
const MOBILE_BREAKPOINT = 780;

function getDefaultRect() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const width = Math.max(MIN_WIDTH, Math.min(1040, vw - 48));
  const height = Math.max(MIN_HEIGHT, Math.min(720, vh - 80));
  const x = Math.max(0, Math.round((vw - width) / 2));
  const y = Math.max(0, Math.round((vh - height) / 2));
  return { x, y, width, height };
}

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  isMinimized: boolean
) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const effectiveHeight = isMinimized ? TITLE_BAR_HEIGHT : height;
  const maxX = Math.max(0, vw - width);
  const maxY = Math.max(0, vh - effectiveHeight);
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
}

export default function FloatingPresetWindow({
  isOpen,
  isMinimized,
  onToggleMinimize,
  onClose,
  onRunPresetInChat,
  userProfile,
}: FloatingPresetWindowProps) {
  const [rect, setRect] = useState(getDefaultRect);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );
  const [activeInteraction, setActiveInteraction] = useState<"drag" | "resize" | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onRunPresetRef = useRef(onRunPresetInChat);
  onRunPresetRef.current = onRunPresetInChat;
  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;

  const postProfileToIframe = () => {
    const iframeWin = iframeRef.current?.contentWindow;
    if (!iframeWin || !userProfileRef.current) return;
    iframeWin.postMessage(
      { type: "preset-panel:profile", profile: userProfileRef.current },
      window.location.origin
    );
  };

  const interactionRef = useRef<{
    type: "drag" | "resize";
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin || event.source !== iframeWin) return;
      const data = event.data;
      if (!data) return;
      if (data.type === "preset-panel:ready") {
        postProfileToIframe();
        return;
      }
      if (data.type !== "preset-panel:run" || typeof data.runId !== "string") return;

      try {
        if (!onRunPresetRef.current) {
          throw new Error("AI chat handler is unavailable.");
        }
        const replyText = await onRunPresetRef.current({
          action: data.action === "continue" || data.action === "revise" ? data.action : "start",
          presetNumber: Number(data.presetNumber),
          presetName: typeof data.presetName === "string" ? data.presetName : undefined,
          steps: typeof data.steps === "number" ? data.steps : undefined,
          stepNumber: typeof data.stepNumber === "number" ? data.stepNumber : undefined,
          message: String(data.message || ""),
        });
        iframeWin.postMessage(
          { type: "preset-panel:result", runId: data.runId, ok: true, text: replyText },
          window.location.origin
        );
      } catch (err: any) {
        iframeWin.postMessage(
          {
            type: "preset-panel:result",
            runId: data.runId,
            ok: false,
            error: err?.message || "Failed to run preset in AI chat.",
          },
          window.location.origin
        );
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    postProfileToIframe();
  }, [userProfile, isOpen]);

  useEffect(() => {
    const syncToViewport = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setIsMobileViewport(vw <= MOBILE_BREAKPOINT);
      setRect((prev) => {
        const width = Math.max(MIN_WIDTH, Math.min(prev.width, Math.max(MIN_WIDTH, vw)));
        const height = Math.max(MIN_HEIGHT, Math.min(prev.height, Math.max(MIN_HEIGHT, vh)));
        const pos = clampPosition(prev.x, prev.y, width, height, isMinimized);
        return { x: pos.x, y: pos.y, width, height };
      });
    };

    syncToViewport();
    window.addEventListener("resize", syncToViewport);
    return () => window.removeEventListener("resize", syncToViewport);
  }, [isMinimized, isOpen]);

  useEffect(() => {
    if (!activeInteraction) return;

    const handleMouseMove = (event: MouseEvent) => {
      const current = interactionRef.current;
      if (!current) return;
      const dx = event.clientX - current.startMouseX;
      const dy = event.clientY - current.startMouseY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (current.type === "drag") {
        setRect((prev) => {
          const pos = clampPosition(
            current.startX + dx,
            current.startY + dy,
            prev.width,
            prev.height,
            isMinimized
          );
          return { ...prev, x: pos.x, y: pos.y };
        });
      } else {
        setRect((prev) => {
          const maxWidth = Math.max(MIN_WIDTH, vw - prev.x);
          const maxHeight = Math.max(MIN_HEIGHT, vh - prev.y);
          const nextWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, current.startWidth + dx));
          const nextHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, current.startHeight + dy));
          return { ...prev, width: nextWidth, height: nextHeight };
        });
      }
    };

    const handleMouseUp = () => {
      interactionRef.current = null;
      setActiveInteraction(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeInteraction, isMinimized]);

  if (!isOpen || typeof document === "undefined") return null;

  const isFullscreen = !isMinimized && (isExpanded || isMobileViewport);

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    if (isFullscreen || isMobileViewport) return;
    event.preventDefault();
    interactionRef.current = {
      type: "drag",
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: rect.x,
      startY: rect.y,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    setActiveInteraction("drag");
  };

  const startResize = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isFullscreen || isMinimized || isMobileViewport) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      type: "resize",
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: rect.x,
      startY: rect.y,
      startWidth: rect.width,
      startHeight: rect.height,
    };
    setActiveInteraction("resize");
  };

  const handleToggleExpand = () => {
    if (isMinimized) {
      onToggleMinimize();
      setIsExpanded(true);
    } else {
      setIsExpanded((v) => !v);
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    onClose();
  };

  const windowStyle: React.CSSProperties = isFullscreen
    ? {
        left: 0,
        top: 0,
        width: "100vw",
        height: "100dvh",
      }
    : isMinimized && isMobileViewport
    ? {
        left: 0,
        bottom: 0,
        width: "100vw",
        height: `${TITLE_BAR_HEIGHT}px`,
      }
    : {
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: isMinimized ? `${TITLE_BAR_HEIGHT}px` : `${rect.height}px`,
      };

  return createPortal(
    <div
      role="dialog"
      aria-label="PRESET PANEL"
      style={windowStyle}
      className={`fixed z-[70] flex flex-col bg-slate-950 border border-slate-700/90 shadow-2xl shadow-black/80 overflow-hidden ring-1 ring-blue-500/30 ${
        isFullscreen || (isMinimized && isMobileViewport) ? "rounded-none" : "rounded-lg"
      }`}
    >
      <div
        onMouseDown={startDrag}
        className={`h-[40px] shrink-0 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between gap-2 select-none ${
          isFullscreen || isMobileViewport
            ? "cursor-default"
            : activeInteraction === "drag"
            ? "cursor-grabbing"
            : "cursor-grab"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50 shrink-0" />
          <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-100 truncate">
            PRESET PANEL
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleMinimize}
            title={isMinimized ? "Restore" : "Minimize"}
            aria-label={isMinimized ? "Restore" : "Minimize"}
            className="w-7 h-7 rounded bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/60 text-slate-300 hover:text-blue-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMinimized ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleToggleExpand}
            title={isExpanded ? "Restore size" : "Expand"}
            aria-label={isExpanded ? "Restore size" : "Expand"}
            className="w-7 h-7 rounded bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/60 text-slate-300 hover:text-blue-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isExpanded && !isMinimized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Close (Esc)"
            aria-label="Close"
            className="w-7 h-7 rounded bg-slate-950/60 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-500/60 text-slate-300 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className={`flex-1 min-h-0 min-w-0 relative bg-[#f4f6f4] ${
          isMinimized ? "hidden" : "flex flex-col"
        } ${activeInteraction ? "pointer-events-none select-none" : ""}`}
      >
        <iframe
          ref={iframeRef}
          src="/preset-panel.html?embed=1"
          title="Preset Panel"
          onLoad={postProfileToIframe}
          className="w-full h-full border-0 bg-[#f4f6f4]"
        />
      </div>

      {!isMinimized && !isFullscreen && !isMobileViewport && (
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          aria-label="Resize PRESET PANEL window"
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 text-slate-400 hover:text-blue-400 transition-colors"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 1L1 9M9 5L5 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>,
    document.body
  );
}
