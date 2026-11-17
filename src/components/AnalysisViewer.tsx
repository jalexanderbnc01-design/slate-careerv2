import React from "react";
import { JobAnalysis } from "../types";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Compass, Terminal, Cpu } from "lucide-react";

interface AnalysisViewerProps {
  analysis: JobAnalysis | null;
  isLoading: boolean;
}

export default function AnalysisViewer({ analysis, isLoading }: AnalysisViewerProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[350px]">
        <div className="w-8 h-8 rounded-full border-2 border-slate-800 border-t-blue-500 animate-spin mb-3"></div>
        <p className="text-slate-100 text-xs font-bold font-sans">Analyzing Job Requirements...</p>
        <p className="text-slate-400 text-[11px] font-mono mt-1">Cross-referencing criteria with candidate OSP portfolio</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded p-8 flex flex-col items-center justify-center min-h-[350px] text-center">
        <div className="w-10 h-10 rounded bg-slate-950 text-slate-300 flex items-center justify-center border border-slate-800 mb-3">
          <Terminal className="w-5 h-5 animate-pulse text-blue-400" />
        </div>
        <h4 className="font-sans font-bold text-slate-100 text-xs uppercase font-mono tracking-wider">Analytical Engine Ready</h4>
        <p className="text-slate-400 text-xs leading-relaxed max-w-sm mt-1.5 font-sans">
          Paste a target job description in the left input panel and click <strong className="text-blue-400 font-bold">"Analyze Job"</strong> to extract softwares, alignments, keywords, and compute a real-time OSP fit index.
        </p>
      </div>
    );
  }

  const {
    requiredSkills = [],
    preferredSkills = [],
    software = [],
    yearsOfExperience = "Unspecified",
    location = "Unspecified",
    workSetup = "Unspecified",
    keywords = [],
    redFlags = [],
    bestResumeAngle = "",
    matchScore
  } = analysis;

  const score = matchScore?.overallScore ?? 70;

  // Compute color based on score
  const scoreColor = score >= 80 ? "text-emerald-500 stroke-emerald-500" : score >= 60 ? "text-blue-500 stroke-blue-500" : "text-amber-500 stroke-amber-500";
  const bgScoreColor = score >= 80 ? "bg-emerald-950/80 border-emerald-850 text-emerald-300" : score >= 60 ? "bg-blue-950/80 border-blue-850 text-blue-300" : "bg-amber-950/80 border-amber-850 text-amber-300";

  return (
    <div className="space-y-4 font-sans">
      
      {/* Overview Block with Score Ring */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Cpu className="w-3.5 h-3.5 text-blue-400" /> Matches Report
            </div>
            <h3 className="font-sans font-bold text-slate-100 text-xs uppercase font-mono">Vacancy Fit Evaluation</h3>
            <p className="text-xs text-slate-355 leading-normal font-sans mt-1">
              Auto-extracted properties locate essential software needs, remote suitability, and tenure requested.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-850">
            <div className="p-2 bg-slate-950 rounded border border-slate-800">
              <span className="block text-[9px] uppercase font-mono text-slate-400 font-bold mb-0.5">Experience</span>
              <span className="block text-xs font-bold text-slate-205 truncate">{yearsOfExperience}</span>
            </div>
            <div className="p-2 bg-slate-950 rounded border border-slate-800">
              <span className="block text-[9px] uppercase font-mono text-slate-400 font-bold mb-0.5">Work Setup</span>
              <span className="block text-xs font-bold text-blue-400 truncate">{workSetup}</span>
            </div>
            <div className="p-2 bg-slate-950 rounded border border-slate-800">
              <span className="block text-[9px] uppercase font-mono text-slate-400 font-bold mb-0.5">Job Location</span>
              <span className="block text-xs font-bold text-slate-205 truncate" title={location}>{location}</span>
            </div>
          </div>
        </div>

        {/* Big Score Radial Ring */}
        <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] uppercase font-mono text-slate-450 font-bold tracking-wider mb-2 block">Match Strength</span>
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                className="stroke-slate-800 fill-none"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                className={`fill-none transition-all duration-1000 ${scoreColor}`}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - score / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-base font-bold text-slate-100 font-mono tracking-tighter">{score}%</span>
              <span className="text-[7px] text-slate-450 font-mono uppercase tracking-widest">Score</span>
            </div>
          </div>
          
          <div className="mt-2.5">
            <span className={`px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded border ${bgScoreColor}`}>
              {score >= 80 ? "Ideal Fit" : score >= 60 ? "Strong Match" : "Plausible Fit"}
            </span>
          </div>
        </div>
      </div>

      {/* Strategic Tone / Resume Angle */}
      {bestResumeAngle && (
        <div className="bg-blue-950/40 border border-blue-900 rounded p-3.5 flex gap-3 text-xs leading-normal">
          <Compass className="w-4.5 h-4.5 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-blue-300 block mb-0.5">Recommended Tailoring Angle:</span>
            <p className="text-slate-300 font-sans leading-relaxed">{bestResumeAngle}</p>
          </div>
        </div>
      )}

      {/* Red Flags Alert Block */}
      {redFlags && redFlags.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-900 rounded p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 font-mono uppercase">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Extracted Job Considerations</span>
          </div>
          <ul className="space-y-1 pl-4 list-disc text-xs text-slate-300 font-sans leading-relaxed">
            {redFlags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Extracted Tools, Softwares, and Keywords */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Identified Software Criteria */}
        <div className="bg-slate-900 border border-slate-800 rounded p-3.5 space-y-2">
          <h4 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Requested Software Tools</h4>
          <div className="flex flex-wrap gap-1">
            {software.length > 0 ? (
              software.map((sw, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 text-[11px] rounded font-mono">
                  {sw}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-450 font-mono">No software specified explicitly in posting</span>
            )}
          </div>
        </div>

        {/* Critical Keywords */}
        <div className="bg-slate-900 border border-slate-800 rounded p-3.5 space-y-2">
          <h4 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Optimization Keywords</h4>
          <div className="flex flex-wrap gap-1">
            {keywords.length > 0 ? (
              keywords.map((kw, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-blue-950/50 border border-blue-900 text-blue-400 text-[11px] rounded font-sans font-medium">
                  #{kw}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-455 font-mono">No niche keywords extracted</span>
            )}
          </div>
        </div>
      </div>

      {/* Match Score Matrix breakdown */}
      {matchScore && (
        <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">
          <h4 className="font-sans font-bold text-slate-100 text-xs pb-2 border-b border-slate-850 uppercase tracking-wider font-mono">Profile Reconciliation Matrix</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Close Matches */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                STRONG MATCHES
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-300 list-none font-sans leading-normal">
                {matchScore.strongMatches.map((item, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-emerald-500 mt-0.5 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Partial Matches */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-400 font-mono">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                PARTIAL MATCHES
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-300 list-none font-sans leading-normal">
                {matchScore.partialMatches.map((item, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-blue-550 mt-0.5 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Items */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400 font-mono">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                KNOWLEDGE GAPS
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-300 list-none font-sans leading-normal">
                {matchScore.missingItems.length > 0 ? (
                  matchScore.missingItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-rose-500 mt-0.5 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-450 font-mono italic text-[10px]">No critical missing items!</li>
                )}
              </ul>
            </div>
          </div>

          {/* Portfolio & Keywords Suggestion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3.5 border-t border-slate-850">
            <div className="p-2.5 bg-slate-950 border border-slate-805 rounded">
              <span className="text-[10px] font-bold text-slate-100 block mb-1 font-mono uppercase tracking-wider">Keywords to Inject</span>
              <div className="flex flex-wrap gap-1">
                {matchScore.keywordsToAdd.map((kw, i) => (
                  <span key={i} className="px-1 text-slate-300 bg-slate-900 rounded text-[10px] border border-slate-800 font-mono">
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-2.5 bg-slate-950 border border-slate-805 rounded">
              <span className="text-[10px] font-bold text-slate-100 block mb-1 font-mono uppercase tracking-wider">Portfolio Drawing Anchors</span>
              <ul className="list-disc pl-4 text-[10px] space-y-0.5 text-slate-300 font-sans">
                {matchScore.portfolioSuggestions.map((sug, i) => (
                  <li key={i}>{sug}</li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* Skills Extract Lists */}
      <div className="bg-slate-900 border border-slate-800 rounded p-3.5 space-y-2">
        <h4 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Competencies Summary</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-slate-455 text-[10px] font-bold block mb-1 font-mono uppercase">Essential Requirements</span>
            <ul className="space-y-1 text-xs text-slate-300 pl-4 list-disc font-sans leading-relaxed">
              {requiredSkills.map((sk, i) => (
                <li key={i}>{sk}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="text-slate-455 text-[10px] font-bold block mb-1 font-mono uppercase">Preferred Qualifications</span>
            <ul className="space-y-1 text-xs text-slate-300 pl-4 list-disc font-sans leading-relaxed">
              {preferredSkills.map((sk, i) => (
                <li key={i}>{sk}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
    </div>
  );
}
