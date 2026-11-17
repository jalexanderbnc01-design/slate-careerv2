import React, { useState, useEffect } from "react";
import { CoverLetterData } from "../types";
import { Mail, Copy, Check, Info } from "lucide-react";

interface CoverLetterViewerProps {
  coverLetter: CoverLetterData | null;
  isLoading: boolean;
  onUpdate: (coverLetter: CoverLetterData) => void;
  applicantName?: string;
}

export default function CoverLetterViewer({ coverLetter, isLoading, onUpdate, applicantName = "" }: CoverLetterViewerProps) {
  const [copied, setCopied] = useState(false);
  const [localLetter, setLocalLetter] = useState<CoverLetterData | null>(null);

  useEffect(() => {
    if (coverLetter) {
      setLocalLetter({ ...coverLetter });
    }
  }, [coverLetter]);

  const handleCopy = () => {
    if (!localLetter) return;

    let text = `${localLetter.date}\n\n`;
    text += `${localLetter.recipientName}\n`;
    text += `${localLetter.companyName}\n\n`;
    text += `Dear ${localLetter.recipientName},\n\n`;
    localLetter.bodyParagraphs.forEach((para) => {
      text += `${para}\n\n`;
    });
    text += `${localLetter.closing}\n\n`;
    text += `${localLetter.signoff}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateParagraph = (index: number, value: string) => {
    if (!localLetter) return;
    const updatedParagraphs = localLetter.bodyParagraphs.map((para, idx) => (idx === index ? value : para));
    const updated = { ...localLetter, bodyParagraphs: updatedParagraphs };
    setLocalLetter(updated);
    onUpdate(updated);
  };

  const updateHeaderField = (field: keyof CoverLetterData, value: string) => {
    if (!localLetter) return;
    const updated = { ...localLetter, [field]: value };
    setLocalLetter(updated);
    onUpdate(updated);
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-blue-500 animate-spin mb-3"></div>
        <p className="text-slate-100 text-xs font-bold font-sans">Drafting Customized Letter...</p>
        <p className="text-slate-400 text-[11px] font-mono mt-1">Applying writing tone and matching municipal technical skillsets</p>
      </div>
    );
  }

  if (!localLetter) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-10 h-10 rounded bg-slate-950 text-slate-350 flex items-center justify-center border border-slate-800 mb-3">
          <Mail className="w-5 h-5 animate-pulse text-blue-400" />
        </div>
        <h4 className="font-sans font-bold text-slate-100 text-xs uppercase font-mono tracking-wider">Cover Letter Tailoring Desk</h4>
        <p className="text-slate-400 text-xs leading-relaxed max-w-sm mt-1.5 font-sans">
          Select your target writing tone (e.g. <strong className="text-slate-200">creative</strong> or <strong className="text-slate-200">confident</strong>) and click <strong className="text-blue-400 font-bold">"Build Cover Letter"</strong> to compose a targeted argument.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Editor Tip Toolbar */}
      <div className="flex justify-between items-center bg-slate-900 border border-slate-800 px-3 py-2 rounded">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-350 font-sans">
          <Info className="w-3.5 h-3.5 text-blue-450 shrink-0" />
          <span><strong className="text-slate-100 font-bold">Interactive Stationery:</strong> You can edit the paragraph contents directly on the paper page below.</span>
        </div>
        <button
          onClick={handleCopy}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer font-mono uppercase tracking-wider text-[10px]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Letter"}
        </button>
      </div>

      {/* Styled Printable Cover Letter Canvas */}
      <div className="bg-slate-900 border border-slate-805 rounded p-6 sm:p-10 shadow-sm text-slate-100 font-sans max-w-4xl mx-auto min-h-[11in] flex flex-col justify-between transition-all">
        
        {/* Core Letter Document */}
        <div className="space-y-4">
          
          {/* Header Date and Meta Info */}
          <div className="space-y-2 pb-3 border-b border-slate-800">
            <div>
              <input
                type="text"
                className="text-xs text-slate-400 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5 min-w-[120px] font-mono"
                value={localLetter.date}
                onChange={(e) => updateHeaderField("date", e.target.value)}
              />
            </div>

            <div className="text-xs space-y-1">
              <div>
                <input
                  type="text"
                  className="font-bold text-slate-100 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5 w-64 font-sans"
                  value={localLetter.recipientName}
                  onChange={(e) => updateHeaderField("recipientName", e.target.value)}
                  placeholder="Recipient (e.g. Lead Utility Recruiter)"
                />
              </div>
              <div className="font-semibold text-slate-300">
                <input
                  type="text"
                  className="bg-transparent focus:bg-slate-950 text-slate-350 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5 w-64 font-sans"
                  value={localLetter.companyName}
                  onChange={(e) => updateHeaderField("companyName", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Salutation */}
          <div className="text-xs font-bold text-slate-100 pl-1 font-mono">
            Dear {localLetter.recipientName || "Hiring Manager"},
          </div>

          {/* Body Paragraphs (Editable blocks) */}
          <div className="space-y-2">
            {localLetter.bodyParagraphs.map((para, idx) => (
              <textarea
                key={idx}
                className="text-xs leading-relaxed text-slate-300 w-full h-24 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-750 hover:bg-slate-950/40 rounded p-1.5 resize-none font-sans"
                value={para}
                onChange={(e) => updateParagraph(idx, e.target.value)}
              />
            ))}
          </div>

          {/* Closing call to action statement */}
          <div className="pt-2">
            <textarea
              className="text-xs leading-relaxed text-slate-100 w-full h-16 font-bold bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-750 hover:bg-slate-950/40 rounded p-1.5 resize-none font-sans"
              value={localLetter.closing}
              onChange={(e) => updateHeaderField("closing", e.target.value)}
            />
          </div>

        </div>

        {/* Corporate Letter Signoff Footer */}
        <div className="pt-6 border-t border-slate-800 flex justify-between items-end mt-8 bg-transparent">
          <div className="text-xs space-y-3">
            <div>
              <input
                type="text"
                className="text-xs text-slate-300 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5"
                value={localLetter.signoff}
                onChange={(e) => updateHeaderField("signoff", e.target.value)}
              />
            </div>
            
            <div className="font-bold text-slate-100 border-t border-slate-805 pt-1.5 pr-8 font-sans">
              {applicantName}
              <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Applicant of CAD / Specialist Architect Roles</span>
            </div>
          </div>

          <div className="text-[9px] font-mono text-slate-500 tracking-wider">
            Drafted with Career Builder
          </div>
        </div>

      </div>
    </div>
  );
}
