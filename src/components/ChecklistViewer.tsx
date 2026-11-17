import React, { useState, useEffect } from "react";
import { ChecklistItem } from "../types";
import { CheckSquare, Square, Trash2, Plus, ListTodo, Copy, Check } from "lucide-react";

interface ChecklistViewerProps {
  steps: ChecklistItem[] | null;
  isLoading: boolean;
  onUpdate: (steps: ChecklistItem[]) => void;
}

export default function ChecklistViewer({ steps, isLoading, onUpdate }: ChecklistViewerProps) {
  const [localSteps, setLocalSteps] = useState<ChecklistItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (steps) {
      setLocalSteps(steps);
    }
  }, [steps]);

  // If no steps generated yet, or is loading
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[350px]">
        <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-blue-500 animate-spin mb-3"></div>
        <p className="text-slate-100 text-xs font-bold font-sans">Drafting 10-Stage Pipeline Checklist...</p>
        <p className="text-slate-400 text-[11px] font-mono mt-1">Customizing follow-up advice and critical keyword tasks</p>
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[350px] text-center">
        <div className="w-10 h-10 rounded bg-slate-950 text-slate-300 flex items-center justify-center border border-slate-800 mb-3">
          <ListTodo className="w-5 h-5 animate-pulse text-blue-400" />
        </div>
        <h4 className="font-sans font-bold text-slate-100 text-xs uppercase font-mono tracking-wider">Checklist Pipeline Tracker</h4>
        <p className="text-slate-350 text-xs leading-relaxed max-w-sm mt-1.5 font-sans">
          Submit your posting and click <strong className="text-blue-400">"Build Application Steps"</strong> or <strong className="text-blue-400">"Create Full Packet"</strong> to compile your step-by-step roadmap.
        </p>
      </div>
    );
  }

  const completedCount = localSteps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / localSteps.length) * 100) || 0;

  const toggleStep = (id: string) => {
    const updated = localSteps.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s));
    setLocalSteps(updated);
    onUpdate(updated);
  };

  const removeStep = (id: string) => {
    const updated = localSteps.filter((s) => s.id !== id);
    setLocalSteps(updated);
    onUpdate(updated);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newStep: ChecklistItem = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || "User added custom application prompt.",
      completed: false,
      isCustom: true,
    };

    const updated = [...localSteps, newStep];
    setLocalSteps(updated);
    onUpdate(updated);

    setNewTitle("");
    setNewDesc("");
  };

  const copyStepsToClipboard = () => {
    let text = `APPLICATION PIPELINE CHECKLIST - PROGRESS: ${progressPercent}%\n\n`;
    localSteps.forEach((s, idx) => {
      text += `${idx + 1}. [${s.completed ? "X" : " "}] ${s.title}\n   ${s.description}\n\n`;
    });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      
      {/* Target Progress Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-sans font-bold text-slate-100 text-xs uppercase font-mono tracking-wider">Target Checklist Pipeline</h3>
          <p className="text-xs text-slate-400 leading-normal font-sans mt-0.5">
            Recommended roadmap for submitting site drawings and keeping touch logs with reviewers.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-950 px-3 py-2 border border-slate-800 rounded shrink-0">
          <div className="text-right">
            <span className="block text-[8px] uppercase font-mono text-slate-450 font-bold tracking-wider">Progress Percentage</span>
            <span className="text-[11px] font-bold text-blue-400 font-mono">{completedCount} of {localSteps.length} items ({progressPercent}%)</span>
          </div>
          <div className="h-2 w-28 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
          <button
            onClick={copyStepsToClipboard}
            className="p-1 px-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer rounded"
            title="Copy checklist"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Task List Grid */}
      <div className="space-y-2">
        {localSteps.map((step) => (
          <div
            key={step.id}
            id={`step-card-${step.id}`}
            className={`border rounded p-3 transition-all duration-150 flex gap-3 relative items-start hover:shadow-xs ${
              step.completed
                ? "bg-slate-950/80 border-slate-850 text-slate-500"
                : "bg-slate-900 border-slate-800 text-slate-100 hover:border-slate-700"
            }`}
          >
            {/* Custom Step Marker badge */}
            {step.isCustom && (
              <span className="absolute top-2.5 right-10 text-[8px] uppercase tracking-wider font-bold font-mono px-1.5 py-0.2 bg-blue-950/50 border border-blue-900 rounded text-blue-400">
                Custom
              </span>
            )}

            {/* Check Action Box */}
            <button
              onClick={() => toggleStep(step.id)}
              className="mt-0.5 text-slate-455 hover:text-blue-400 transition-colors shrink-0 focus:outline-none cursor-pointer"
            >
              {step.completed ? (
                <CheckSquare className="w-4.5 h-4.5 text-blue-500" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>

            {/* Title / Info Descriptions */}
            <div className="flex-1 space-y-0.5 pr-6 leading-tight">
              <span
                onClick={() => toggleStep(step.id)}
                className={`font-sans font-bold text-xs cursor-pointer select-none leading-normal transition-all ${
                  step.completed ? "line-through text-slate-500" : "text-slate-100"
                }`}
              >
                {step.title}
              </span>
              <p className={`text-[11px] leading-relaxed font-sans ${step.completed ? "text-slate-500" : "text-slate-300"}`}>
                {step.description}
              </p>
            </div>

            {/* Delete button */}
            <button
              onClick={() => removeStep(step.id)}
              className="absolute top-3 right-3 text-slate-450 hover:text-rose-500 transition-colors cursor-pointer"
              title="Remove step"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Append New Task Section */}
      <form onSubmit={handleAddCustom} className="bg-slate-900 border border-slate-800 rounded p-3.5 space-y-2.5">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Append custom pipeline milestone</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <input
            type="text"
            placeholder="e.g. Schedule drafting portfolio review session"
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-505 placeholder:text-slate-600"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            type="text"
            placeholder="e.g. Call supervisor to verify approvals"
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-505 placeholder:text-slate-600"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded flex items-center gap-1.5 cursor-pointer font-bold font-mono uppercase tracking-wider text-[10px] transition-colors border border-blue-500"
          >
            <Plus className="w-3.5 h-3.5 text-white" />
            Append Pipeline Task
          </button>
        </div>
      </form>
      
    </div>
  );
}
