import React, { useState, useEffect } from "react";
import { ResumeData } from "../types";
import { FileText, Copy, Check, Info, Save, RotateCcw } from "lucide-react";

interface ResumeViewerProps {
  resume: ResumeData | null;
  isLoading: boolean;
  onUpdate: (resume: ResumeData) => void;
}

export default function ResumeViewer({ resume, isLoading, onUpdate }: ResumeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [localResume, setLocalResume] = useState<ResumeData | null>(null);

  useEffect(() => {
    if (resume) {
      setLocalResume({ ...resume });
    }
  }, [resume]);

  const handleCopy = () => {
    if (!localResume) return;

    // Compile into clean text format for clipboard
    let text = `${localResume.name}\n${localResume.contact}\n`;
    if (localResume.portfolioUrl) text += `Portfolio: ${localResume.portfolioUrl}\n`;
    text += `\nPROFESSIONAL SUMMARY\n${localResume.summary}\n`;
    
    text += `\nCORE SKILLS\n${localResume.skills.join(", ")}\n`;
    text += `\nSOFTWARE PROFICIENCY\n${localResume.software.join(", ")}\n`;
    
    text += `\nPROFESSIONAL EXPERIENCE\n`;
    localResume.experience.forEach((exp) => {
      text += `\n${exp.role} | ${exp.company} (${exp.period})\n`;
      exp.bullets.forEach((bullet) => {
        text += `- ${bullet}\n`;
      });
    });

    text += `\nEDUCATION\n`;
    localResume.education.forEach((edu) => {
      text += `\n${edu.degree} - ${edu.school} (${edu.period})\n`;
      if (edu.details) text += `${edu.details}\n`;
    });

    text += `\nTECHNICAL PORTFOLIO PROJECTS\n`;
    localResume.projects.forEach((proj) => {
      text += `\n${proj.name} (Tech: ${proj.technologies.join(", ")})\n${proj.description}\n`;
    });

    text += `\nCERTIFICATIONS & TRAINING\n`;
    localResume.certifications.forEach((cert) => {
      text += `- ${cert}\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateField = (field: keyof ResumeData, value: any) => {
    if (!localResume) return;
    const updated = { ...localResume, [field]: value };
    setLocalResume(updated);
    onUpdate(updated);
  };

  const updateExperienceBullet = (expIdx: number, bulletIdx: number, value: string) => {
    if (!localResume) return;
    const updatedExp = localResume.experience.map((exp, eIdx) => {
      if (eIdx === expIdx) {
        const updatedBullets = exp.bullets.map((b, bIdx) => (bIdx === bulletIdx ? value : b));
        return { ...exp, bullets: updatedBullets };
      }
      return exp;
    });
    updateField("experience", updatedExp);
  };

  const updateExperienceHeader = (expIdx: number, field: "role" | "company" | "period", value: string) => {
    if (!localResume) return;
    const updatedExp = localResume.experience.map((exp, eIdx) => {
      if (eIdx === expIdx) {
        return { ...exp, [field]: value };
      }
      return exp;
    });
    updateField("experience", updatedExp);
  };

  const updateProjectField = (projIdx: number, field: "name" | "description", value: string) => {
    if (!localResume) return;
    const updatedProj = localResume.projects.map((proj, pIdx) => {
      if (pIdx === projIdx) {
        return { ...proj, [field]: value };
      }
      return proj;
    });
    updateField("projects", updatedProj);
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-blue-500 animate-spin mb-3"></div>
        <p className="text-slate-100 text-xs font-bold font-sans">Formulating Target Resume Draft...</p>
        <p className="text-slate-400 text-[11px] font-mono mt-1">Applying CAD/Structural parameters with matched keywords</p>
      </div>
    );
  }

  if (!localResume) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-10 h-10 rounded bg-slate-950 text-slate-350 flex items-center justify-center border border-slate-800 mb-3">
          <FileText className="w-5 h-5 animate-pulse text-blue-400" />
        </div>
        <h4 className="font-sans font-bold text-slate-100 text-xs uppercase font-mono tracking-wider">Resume Template Generator</h4>
        <p className="text-slate-400 text-xs leading-relaxed max-w-sm mt-1.5 font-sans">
          Select your target role style (e.g. <strong className="text-slate-200">BIM Technician</strong> or <strong className="text-slate-200">Civil CAD</strong>) and click <strong className="text-blue-400 font-bold">"Build Resume"</strong> or <strong className="text-blue-400 font-bold">"Create Full Packet"</strong> to compile a clean tailored draft.
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
          <span><strong className="text-slate-100 font-bold">Interactive Editor Mode:</strong> Edit directly in the text blocks below to refine your draft.</span>
        </div>
        <button
          onClick={handleCopy}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer font-mono uppercase tracking-wider text-[10px]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Resume"}
        </button>
      </div>

      {/* Styled Printable Resume Canvas */}
      <div className="bg-slate-900 border border-slate-805 rounded p-6 sm:p-10 shadow-sm text-slate-100 font-sans max-w-4xl mx-auto min-h-[11in] transition-all">
        
        {/* Document Header (Editable Name / Contacts) */}
        <div className="text-center pb-5 border-b-2 border-slate-800">
          <input
            type="text"
            className="text-xl font-bold tracking-tight text-slate-100 bg-transparent text-center w-full focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5"
            value={localResume.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
          <input
            type="text"
            className="text-xs text-slate-350 bg-transparent text-center w-full focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded mt-1 px-1.5 py-0.5 font-mono"
            value={localResume.contact}
            onChange={(e) => updateField("contact", e.target.value)}
            placeholder="[Your Contact Details Placeholder]"
          />
          <input
            type="text"
            className="text-xs text-blue-400 hover:text-blue-300 bg-transparent text-center w-full focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded mt-0.5 px-1.5 py-0.5 font-semibold"
            value={localResume.portfolioUrl || ""}
            onChange={(e) => updateField("portfolioUrl", e.target.value)}
            placeholder="[Portfolio Link Placeholder, e.g., portfolio.design/alexmercer]"
          />
        </div>

        {/* Professional Summary Section */}
        <div className="pt-4 space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-0.5 font-mono">Professional Summary</h4>
          <textarea
            className="text-xs leading-relaxed text-slate-300 w-full h-20 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-750 hover:bg-slate-950/40 rounded p-1.5 resize-none font-sans"
            value={localResume.summary}
            onChange={(e) => updateField("summary", e.target.value)}
          />
        </div>

        {/* Skills Section */}
        <div className="pt-4 space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-0.5 font-mono">Core Specialties & Methods</h4>
          <textarea
            className="text-xs leading-relaxed text-slate-305 w-full h-12 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-750 hover:bg-slate-950/40 rounded p-1.5 resize-none font-sans"
            value={localResume.skills.join(", ")}
            onChange={(e) => updateField("skills", e.target.value.split(",").map(s => s.trim()))}
            placeholder="Dynamic, plan revisions, site layouts, permit ready..."
          />
        </div>

        {/* Software Section */}
        <div className="pt-4 space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-0.5 font-mono">Software & Technical Stack</h4>
          <textarea
            className="text-xs leading-relaxed text-slate-310 w-full h-12 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-750 hover:bg-slate-950/40 rounded p-1.5 resize-none font-mono"
            value={localResume.software.join(", ")}
            onChange={(e) => updateField("software", e.target.value.split(",").map(s => s.trim()))}
            placeholder="AutoCAD, Civil 3D, Revit, Bluebeam..."
          />
        </div>

        {/* Experience Section */}
        <div className="pt-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-0.5 font-mono">Professional Experience</h4>
          
          <div className="space-y-3">
            {localResume.experience.map((exp, expIdx) => (
              <div key={expIdx} className="space-y-1">
                {/* Exp Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex gap-2 items-center flex-1">
                    <input
                      type="text"
                      className="text-xs font-bold text-slate-100 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5 font-sans"
                      value={exp.role}
                      onChange={(e) => updateExperienceHeader(expIdx, "role", e.target.value)}
                    />
                    <span className="text-slate-500 text-xs shadow-none">@</span>
                    <input
                      type="text"
                      className="text-xs font-bold text-blue-400 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5"
                      value={exp.company}
                      onChange={(e) => updateExperienceHeader(expIdx, "company", e.target.value)}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      className="text-xs font-mono text-slate-450 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded text-right px-1.5 py-0.5"
                      value={exp.period}
                      onChange={(e) => updateExperienceHeader(expIdx, "period", e.target.value)}
                    />
                  </div>
                </div>

                {/* Bullets */}
                <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs text-slate-100">
                  {exp.bullets.map((bullet, bulletIdx) => (
                    <li key={bulletIdx} className="pl-1">
                      <textarea
                        className="text-xs leading-normal text-slate-300 w-full h-12 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-755 hover:bg-slate-950/40 rounded p-1 resize-none font-sans"
                        value={bullet}
                        onChange={(e) => updateExperienceBullet(expIdx, bulletIdx, e.target.value)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Education Section */}
        <div className="pt-4 space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-0.5 font-mono">Academic Background</h4>
          {localResume.education.map((edu, eduIdx) => (
            <div key={eduIdx} className="text-xs">
              <div className="flex justify-between items-center font-bold text-slate-100">
                <span>{edu.degree}</span>
                <span className="font-mono text-[10px] text-slate-450 font-normal">{edu.period}</span>
              </div>
              <div className="text-slate-300 mt-0.5 font-medium">{edu.school}</div>
              {edu.details && <div className="text-slate-450 mt-0.5 italic leading-relaxed font-sans">{edu.details}</div>}
            </div>
          ))}
        </div>

        {/* Projects Section */}
        <div className="pt-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-0.5 font-mono">Technical Design Projects</h4>
          <div className="space-y-2.5">
            {localResume.projects.map((proj, projIdx) => (
              <div key={projIdx} className="space-y-0.5">
                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    className="text-xs font-bold text-slate-105 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-700 rounded px-1.5 py-0.5"
                    value={proj.name}
                    onChange={(e) => updateProjectField(projIdx, "name", e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({proj.technologies.join(", ")})
                  </span>
                </div>
                <textarea
                  className="text-xs leading-relaxed text-slate-300 w-full h-12 bg-transparent focus:bg-slate-950 focus:outline-none border border-transparent hover:border-slate-750 hover:bg-slate-950/40 rounded p-1 resize-none"
                  value={proj.description}
                  onChange={(e) => updateProjectField(projIdx, "description", e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Certifications and training */}
        <div className="pt-4 space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100 border-b border-slate-800 pb-0.5 font-mono">Certifications & Accreditations</h4>
          <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-slate-300 font-sans">
            {localResume.certifications.map((cert, certIdx) => (
              <li key={certIdx} className="leading-snug pl-1">
                {cert}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
