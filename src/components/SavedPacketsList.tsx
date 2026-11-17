import React from "react";
import { ApplicationPacket } from "../types";
import { FolderHeart, Calendar, ChevronRight, Trash2, FileHeart } from "lucide-react";

interface SavedPacketsListProps {
  packets: ApplicationPacket[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SavedPacketsList({ packets, activeId, onSelect, onDelete }: SavedPacketsListProps) {
  if (packets.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 text-center space-y-4 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-slate-950 text-slate-400 flex items-center justify-center border border-slate-850 mx-auto">
          <FolderHeart className="w-5 h-5 text-blue-500 animate-pulse" />
        </div>
        
        <div className="space-y-1">
          <h5 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">No Saved Packets</h5>
          <p className="text-[10px] text-slate-400 leading-normal max-w-[230px] mx-auto font-sans">
            Build and compile customized job portfolios to display them here.
          </p>
        </div>

        {/* Instructive Step-by-Step checklist inside the Empty State as recommended in Section 9 */}
        <div className="p-3 bg-slate-955/40 rounded-lg border border-slate-850 text-left font-sans text-[10px] text-slate-400 space-y-2 max-w-[260px] mx-auto">
          <span className="block font-mono text-[9px] uppercase font-bold tracking-wider text-slate-500">Quick Start Guide:</span>
          
          <div className="flex items-start gap-1.5">
            <span className="font-mono text-blue-400 font-bold shrink-0">01.</span>
            <span>Select a job in the left <strong>Live Jobs</strong> list.</span>
          </div>
          
          <div className="flex items-start gap-1.5">
            <span className="font-mono text-blue-400 font-bold shrink-0">02.</span>
            <span>Refine career baseline properties in the left sidebar.</span>
          </div>

          <div className="flex items-start gap-1.5">
            <span className="font-mono text-blue-450 font-bold shrink-0">03.</span>
            <span>Click <strong>"Instant Compile"</strong> inside the row.</span>
          </div>

          <div className="flex items-start gap-1.5">
            <span className="font-mono text-blue-450 font-bold shrink-0">04.</span>
            <span>Click <strong>"Save Application Packet"</strong> in the Action Desk.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden shadow-xs space-y-1">
      {/* Header Panel */}
      <div className="px-3 py-1.5 bg-slate-950 border-b border-slate-850 flex items-center gap-2">
        <FileHeart className="w-4 h-4 text-blue-400" />
        <h5 className="font-sans font-bold text-slate-100 text-[10px] uppercase tracking-wider font-mono">My Saved Packs ({packets.length})</h5>
      </div>

      {/* List Scroller */}
      <div className="p-1.5 max-h-[30vh] overflow-y-auto space-y-1.5">
        {packets.map((pkt) => {
          const isActive = pkt.id === activeId;
          const score = pkt.analysis?.matchScore?.overallScore;
          
          return (
            <div
              key={pkt.id}
              className={`group flex items-center justify-between p-2 rounded border transition-all cursor-pointer ${
                isActive
                  ? "bg-blue-955/20 border-blue-800/80 text-blue-300"
                  : "bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-800/60 hover:border-slate-705"
              }`}
              onClick={() => onSelect(pkt.id)}
            >
              {/* Left Item Summary */}
              <div className="flex-1 min-w-0 pr-2 font-sans">
                <div className="flex items-center gap-1.5">
                  <span className={`block font-sans font-bold text-xs leading-none truncate ${isActive ? "text-blue-300" : "text-slate-100"}`}>
                    {pkt.jobTitle || "CAD Draftsman"}
                  </span>
                  {score !== undefined && (
                    <span className="shrink-0 text-[9px] font-mono font-bold bg-slate-900 border border-slate-800 px-1 rounded text-blue-400">
                      {score}%
                    </span>
                  )}
                </div>
                
                <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                  {pkt.companyName || "Target Company"} • {pkt.resumeStyle}
                </span>

                <div className="flex items-center gap-1 text-[9px] text-slate-450 font-mono mt-0.5">
                  <Calendar className="w-2.5 h-2.5 text-slate-500" />
                  <span>{new Date(pkt.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions Right */}
              <div className="flex items-center gap-1 font-sans">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete ${pkt.jobTitle || 'Packet'} assembly?`)) {
                      onDelete(pkt.id);
                    }
                  }}
                  className="p-1 text-slate-500 hover:text-rose-500 rounded hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Purge Application Packet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
