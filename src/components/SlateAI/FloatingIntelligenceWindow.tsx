import React, { useEffect, useRef, useState } from "react";
import { Cpu, Minus, Maximize2, X } from "lucide-react";

interface FloatingIntelligenceWindowProps {
  isOpen: boolean;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 240;
const TITLE_BAR_HEIGHT = 40;

function getDefaultRect() {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const width = Math.max(MIN_WIDTH, Math.min(960, vw - 40));
  const height = Math.max(MIN_HEIGHT, Math.min(640, vh - 112));
  const x = Math.max(0, Math.min(20, vw - width));
  const y = Math.max(0, Math.min(vh - height - 72, vh - height));
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

export default function FloatingIntelligenceWindow({
  isOpen,
  isMinimized,
  onToggleMinimize,
  onClose,
  children,
}: FloatingIntelligenceWindowProps) {
  const [rect, setRect] = useState(getDefaultRect);
  const [activeInteraction, setActiveInteraction] = useState<"drag" | "resize" | null>(null);

  const interactionRef = useRef<{
    type: "drag" | "resize";
    startMouseX: number;
    startMouseY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Close on Escape when window is open
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

  // Keep inside viewport on browser resize or un-minimize
  useEffect(() => {
    const syncToViewport = () => {
      setRect((prev) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
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

  // Drag & Resize listeners
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

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
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
    if (event.button !== 0) return;
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

  return (
    <div
      role="dialog"
      aria-label="XELIME INTELLIGENCE"
      aria-hidden={!isOpen}
      style={{
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: isMinimized ? `${TITLE_BAR_HEIGHT}px` : `${rect.height}px`,
        display: isOpen ? "flex" : "none",
      }}
      className="fixed z-50 flex-col bg-slate-950 border border-slate-700/90 shadow-2xl shadow-black/80 rounded-lg overflow-hidden ring-1 ring-blue-500/30"
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={startDrag}
        className={`h-[40px] shrink-0 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between gap-2 select-none ${
          activeInteraction === "drag" ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50 shrink-0" />
          <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-100 truncate">
            XELIME INTELLIGENCE
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleMinimize}
            title={isMinimized ? "Restore window" : "Minimize window"}
            aria-label={isMinimized ? "Restore window" : "Minimize window"}
            className="w-7 h-7 rounded bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/60 text-slate-300 hover:text-blue-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isMinimized ? (
              <Maximize2 className="w-3.5 h-3.5" />
            ) : (
              <Minus className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close window (Esc)"
            aria-label="Close window"
            className="w-7 h-7 rounded bg-slate-950/60 hover:bg-rose-950/70 border border-slate-800 hover:border-rose-500/60 text-slate-300 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preserved Window Body (stays mounted when minimized or closed) */}
      <div
        className={`flex-1 min-h-0 min-w-0 relative ${
          isMinimized ? "hidden" : "flex flex-col"
        } ${activeInteraction ? "pointer-events-none select-none" : ""}`}
      >
        {children}
      </div>

      {/* Bottom-Right Resize Handle */}
      {!isMinimized && (
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          aria-label="Resize XELIME INTELLIGENCE window"
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
    </div>
  );
}
