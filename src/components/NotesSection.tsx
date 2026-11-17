import React, { useState, useEffect } from "react";
import { StickyNote, HelpCircle, CheckCheck } from "lucide-react";

interface NotesSectionProps {
  notesOriginal: string;
  onSaveNotes: (notes: string) => void;
}

export default function NotesSection({ notesOriginal, onSaveNotes }: NotesSectionProps) {
  const [localNotes, setLocalNotes] = useState(notesOriginal);
  const [isSavedFlag, setIsSavedFlag] = useState(false);

  useEffect(() => {
    setLocalNotes(notesOriginal);
  }, [notesOriginal]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLocalNotes(text);
    onSaveNotes(text);
    
    // Quick flash feedback
    setIsSavedFlag(true);
    const t = setTimeout(() => setIsSavedFlag(false), 800);
    return () => clearTimeout(t);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded overflow-hidden shadow-xs min-h-[350px] flex flex-col justify-between">
      {/* Header Info */}
      <div className="px-4 py-2 border-b border-slate-850 bg-slate-950 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-slate-350 shrink-0" />
          <h4 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Workspace Notes Notepad</h4>
        </div>
        <span className={`text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${isSavedFlag ? "text-emerald-400 opacity-100" : "text-slate-450 opacity-70"}`}>
          <CheckCheck className="w-3.5 h-3.5 text-emerald-450" />
          {isSavedFlag ? "Saved & Synced" : "Synced"}
        </span>
      </div>

      {/* Editor Space */}
      <div className="p-4 flex-1 flex flex-col space-y-3">
        <textarea
          placeholder="Paste draft details, list of professional references, questions for interview prep, or technical drawing cataloging index..."
          className="flex-1 w-full bg-slate-950 border border-slate-800 rounded p-3 font-sans text-xs text-slate-100 leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-slate-500 min-h-[200px]"
          value={localNotes}
          onChange={handleNotesChange}
        />
        
        {/* Help indicators */}
        <div className="p-3 bg-blue-955/40 border border-blue-900 rounded flex gap-2 text-xs text-slate-300 leading-normal">
          <HelpCircle className="w-4 h-4 text-blue-405 shrink-0 mt-0.5" />
          <div>
            Use this workspace notes drawer to prepare for permit queries, compile AutoCAD plan revision timestamps, or copy reference letters without altering the tailored documents in the other tabs.
          </div>
        </div>
      </div>
    </div>
  );
}
