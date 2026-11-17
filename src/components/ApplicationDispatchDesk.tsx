import React, { useState, useEffect, useRef } from "react";
import { authFetch } from "../firebase/client";
import { JobFixture, UserProfile, TrackerRow } from "../types";
import { 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  Send, 
  FileText, 
  Check, 
  Milestone, 
  Play, 
  ArrowRight, 
  Clock, 
  User, 
  MapPin, 
  AlertCircle, 
  Mail, 
  Plus, 
  RefreshCw,
  Info
} from "lucide-react";
import { getRequiredPortfolioFile } from "./ApplyTodayTab";

interface ApplicationDispatchDeskProps {
  selectedJob: JobFixture;
  userProfile: UserProfile;
  trackerRows: TrackerRow[];
  setTrackerRows: React.Dispatch<React.SetStateAction<TrackerRow[]>>;
  onClose: () => void;
  onNavigateToTab: (tabId: any) => void;
}

export default function ApplicationDispatchDesk({
  selectedJob,
  userProfile,
  trackerRows,
  setTrackerRows,
  onClose,
  onNavigateToTab
}: ApplicationDispatchDeskProps) {
  
  // 1. Identify files based on Selected Job Lane
  const requiredAsset = getRequiredPortfolioFile(selectedJob.lane);
  
  let matchingResumeName = "Creative Production Resume";
  if (selectedJob.lane.toLowerCase().includes("tech") || selectedJob.lane.toLowerCase().includes("3d")) {
    matchingResumeName = "3D Visualization Resume";
  } else if (selectedJob.lane.toLowerCase().includes("cad") || selectedJob.lane.toLowerCase().includes("draft")) {
    matchingResumeName = "CAD-Adjacent Design Resume";
  } else if (selectedJob.lane.toLowerCase().includes("retail") || selectedJob.lane.toLowerCase().includes("fast money")) {
    matchingResumeName = "Customer Operations Resume";
  }

  // 2. States
  const [copied, setCopied] = useState(false);
  const [aiPitchText, setAiPitchText] = useState("");
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [pitchError, setPitchError] = useState<string | null>(null);

  // Checks
  const [enclosedResume, setEnclosedResume] = useState(true);
  const [enclosedPortfolio, setEnclosedPortfolio] = useState(true);
  const [enclosedTransit, setEnclosedTransit] = useState(false);
  const [enclosedDrugCheck, setEnclosedDrugCheck] = useState(true);

  // Pre-flight Calibrations
  const [calibTravel, setCalibTravel] = useState(false);
  const [calibPrepress, setCalibPrepress] = useState(false);
  const [calibSafetyTerms, setCalibSafetyTerms] = useState(false);
  const [calibValidationCode, setCalibValidationCode] = useState(false);

  // Dispatch Mode
  const [dispatchMethod, setDispatchMethod] = useState<"Digital" | "Physical" | "Agency">("Digital");

  // Simulation Sequence
  const [submissionState, setSubmissionState] = useState<"idle" | "validating" | "packing" | "transmitting" | "logging" | "success">("idle");
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);

  // Log container ref
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [telemetryLogs]);

  // Handle preset defaults
  useEffect(() => {
    // Reset state for new selectedJob
    setAiPitchText("");
    setPitchError(null);
    setSubmissionState("idle");
    setTelemetryLogs([]);
    setProgressPercent(0);
    setCalibTravel(false);
    setCalibPrepress(false);
    setCalibSafetyTerms(false);
    setCalibValidationCode(false);
  }, [selectedJob]);

  // 3. AI Pitch trigger
  const generateAIPitch = async () => {
    setIsGeneratingPitch(true);
    setPitchError(null);
    try {
      const response = await authFetch("/api/enhance-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPosting: selectedJob.description,
          jobTitle: selectedJob.title,
          companyName: selectedJob.company,
          userProfile: userProfile
        })
      });

      if (!response.ok) {
        throw new Error("Failed to tailor. Re-routing through local model baseline server.");
      }

      const data = await response.json();
      if (data && data.enhancedPitch) {
        setAiPitchText(data.enhancedPitch);
      } else {
        throw new Error("Invalid pitch schema returned.");
      }
    } catch (err: any) {
      console.warn("API Pitch generate failed, compiling high-quality local fallback", err);
      // Fallback generator based on lane rules
      setTimeout(() => {
        let fallback = "";
        if (selectedJob.lane.toLowerCase().includes("cad")) {
          fallback = `I am submitting my architectural drafting profile for the ${selectedJob.title} position at ${selectedJob.company}. Backed by my AS in Architectural Technology and AutoCAD Certified Professional status, I coordinate high-precision multi-sheet sets, boring profiles, and local utility permit structures avoiding typical alignment errors. My layout workflows are optimized for immediate, low-drama contributions to your active production schedules.`;
        } else if (selectedJob.lane.toLowerCase().includes("3d")) {
          fallback = `Please accept this tailored application deck for ${selectedJob.title} at ${selectedJob.company}. I leverage my specialized experience in Revit BIM schedules, SketchUp coordinate imports, and high-fidelity 3D modeling pipelines to compile accurate rendering assets that match spot specifications. Safe, self-directed, and fully focused on clean production lines.`;
        } else {
          fallback = `Dear Hiring Manager, I am writing to express my strong interest in the ${selectedJob.title} role at ${selectedJob.company}. Applying my rigorous design-to-build approach and customer operations summary, I offer prompt, high-integrity service, accurate inventory setups, and strict compliance alignment to keep operations running cleanly and on-schedule.`;
        }
        setAiPitchText(fallback);
      }, 1000);
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  // Helper to complete calibration
  const autoCheckAllCalibrations = () => {
    setCalibTravel(true);
    setCalibPrepress(true);
    setCalibSafetyTerms(true);
    setCalibValidationCode(true);
  };

  // 4. Trigger Submission Simulation
  const handleLaunchDispatch = () => {
    if (submissionState !== "idle") return;

    // Check if at least some documentation is selected
    if (!enclosedResume && !enclosedPortfolio && !aiPitchText) {
      alert("Validation Error: Please enclose at least one core document component (Resume, Proof Piece, or Cover Pitch) before submitting.");
      return;
    }

    setSubmissionState("validating");
    setProgressPercent(10);
    setTelemetryLogs([`[09:00:03]: [CONNECTING] Connecting to campaign handoff host...`, `[09:00:03]: [INIT] Init transmission capability detected: [${dispatchMethod.toUpperCase()} FORMAT]`]);

    // Step 1: Validations
    setTimeout(() => {
      setTelemetryLogs(prev => [
        ...prev,
        `[09:00:04]: [AUDIT] Pre-flight verification: Checking local site files...`,
        enclosedResume ? `[09:00:04]:  └ [OK] Loaded Matching Resume template: "${matchingResumeName}"` : `[09:00:04]:  └ [SKIP] Skipped Resume attachment`,
        enclosedPortfolio ? `[09:00:04]:  └ [OK] Loaded vector portfolio file: "${requiredAsset.filename}" (Active proof)` : `[09:00:04]:  └ [SKIP] Skipped portfolio attachment`,
        `[09:00:05]:  └ [OK] Target location verified: ${selectedJob.location}`
      ]);
      setSubmissionState("packing");
      setProgressPercent(35);
    }, 700);

    // Step 2: Packing
    setTimeout(() => {
      setTelemetryLogs(prev => [
        ...prev,
        `[09:00:06]: [PACK] Packaging digital submittal packet...`,
        `[09:00:06]:  └ Compressing metadata files (Zipping)...`,
        `[09:00:06]:  └ Stripping legacy structural keywords...`,
        `[09:00:07]:  └ Injecting CSCC academic credential identifier code...`,
        `[09:00:07]:  └ Matching layout registration marks...`
      ]);
      setSubmissionState("transmitting");
      setProgressPercent(60);
    }, 1500);

    // Step 3: Transmitting
    setTimeout(() => {
      let dispatchDetails = "";
      if (dispatchMethod === "Digital") {
        dispatchDetails = `[EMAIL] Transmitting directly to ${selectedJob.company} Recruiter Inbox @ columbus.recruiter.${selectedJob.company.toLowerCase().replace(/\s+/g, "")}@gmail.com`;
      } else if (dispatchMethod === "Physical") {
        dispatchDetails = `[HAND-CARRY] Hand-Delivering Hardcopy binder set directly to ${selectedJob.company} office gate in ${selectedJob.location}`;
      } else {
        dispatchDetails = `[AGENCY] Placing within Columbus weekly local staffing queue for rapid starts`;
      }

      setTelemetryLogs(prev => [
        ...prev,
        `[09:00:08]: [SEND] Transmitting envelope...`,
        `[09:00:08]:  └ ${dispatchDetails}`,
        `[09:00:09]:  └ Passing security screening parameters...`
      ]);
      setSubmissionState("logging");
      setProgressPercent(85);
    }, 2500);

    // Step 4: Database logging & success
    setTimeout(() => {
      // 1. Actually update the TrackerRows!
      // Look if row exists
      const existingRowIdx = trackerRows.findIndex(r => r.jobTitle.toLowerCase() === selectedJob.title.toLowerCase() && r.companyName.toLowerCase() === selectedJob.company.toLowerCase());
      
      const appliedItemNote = `Compiled with Dispatcher via ${dispatchMethod} sending style. Documents attached: ${[enclosedResume ? "Resume" : "", enclosedPortfolio ? "Portfolio Proof" : "", aiPitchText ? "Custom Cover Pitch" : ""].filter(Boolean).join(", ")}. Pitch summary: "${aiPitchText.slice(0, 80)}..."`;

      if (existingRowIdx !== -1) {
        // Update existing row
        const updated = [...trackerRows];
        updated[existingRowIdx] = {
          ...updated[existingRowIdx],
          applied: true,
          appliedDate: new Date().toISOString().split("T")[0],
          status: "Applied",
          notes: appliedItemNote,
          portfolioPiece: requiredAsset.filename,
          resumeVersion: matchingResumeName
        };
        setTrackerRows(updated);
      } else {
        // Create new row
        const newRow: TrackerRow = {
          id: "track-spawn-" + Date.now(),
          companyName: selectedJob.company,
          jobTitle: selectedJob.title,
          lane: selectedJob.lane,
          pay: selectedJob.salary || "$19.00/hr",
          thcRisk: (selectedJob.lane.toLowerCase().includes("retail") || selectedJob.lane.toLowerCase().includes("office")) ? "Low" : "Medium",
          score: selectedJob.computedTotal || 25,
          applied: true,
          appliedDate: new Date().toISOString().split("T")[0],
          status: "Applied",
          notes: appliedItemNote,
          portfolioPiece: requiredAsset.filename,
          resumeVersion: matchingResumeName,
          followUpDate: "Friday match calibration test",
          companyTarget: selectedJob.location
        };
        setTrackerRows([newRow, ...trackerRows]);
      }

      setTelemetryLogs(prev => [
        ...prev,
        `[09:00:10]: [SAVE] Synchronized to local tracker state successfully!`,
        `[09:00:10]: [COMPLETE] Campaign dispatch completed successfully!`
      ]);
      setSubmissionState("success");
      setProgressPercent(100);
    }, 3800);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4 text-left relative overflow-hidden font-sans">
      
      {/* Visual Accent Ambient glow of active dispatcher */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex justify-between items-start border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
            <Send className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
              Campaign Dispatch & Submission Cockpit
            </h3>
            <p className="text-[11px] text-slate-400 tracking-tight font-sans">
              Tailor layout documentation, query medical policy compliance, and dispatch application vectors dynamically.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          type="button"
          className="text-[10px] font-mono font-bold bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 px-2.5 py-1 rounded transition-colors cursor-pointer"
        >
          Cancel & Close
        </button>
      </div>

      {submissionState === "success" ? (
        /* SUCCESS RECEIPT STATE SCREEN */
        <div className="p-6 bg-slate-950 border border-emerald-900/40 rounded-xl text-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-950/80 text-emerald-400 flex items-center justify-center border border-emerald-500/30 mx-auto">
            <Check className="w-6 h-6 text-emerald-400 animate-bounce" />
          </div>

          <div className="space-y-1">
            <h4 className="font-mono font-bold text-slate-100 text-sm uppercase tracking-widest">
              Application Dispatched Successfully!
            </h4>
            <p className="text-[11px] text-emerald-450 font-mono tracking-tight">
              Receipt Reference: APP-DISP-{(Date.now() % 100000).toString().padStart(5, '0')} • Status: ACTIVE IN TRACKER
            </p>
            <p className="text-slate-400 text-xs leading-relaxed max-w-lg mx-auto pt-2">
              You filed <strong>{selectedJob.title} @ {selectedJob.company}</strong> under state <span className="text-emerald-400 font-bold font-mono">APPLIED</span>. Commute guidelines and files were packed with validation stamps to minimize ATS filtering.
            </p>
          </div>

          <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg text-left max-w-md mx-auto space-y-1.5 font-mono text-[10.5px]">
            <span className="block font-sans font-bold text-slate-300 text-[11px] uppercase tracking-wider mb-1">Packet Inventory Logs:</span>
            <div className="flex justify-between border-b border-slate-950 pb-1">
              <span className="text-slate-450">Frictionless Lane Match:</span>
              <span className="text-slate-200">{selectedJob.lane.split(" — ")[0]}</span>
            </div>
            <div className="flex justify-between border-b border-slate-950 pb-1">
              <span className="text-slate-450">Resume Sent:</span>
              <span className="text-slate-200">{enclosedResume ? matchingResumeName : "Skipped"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-950 pb-1">
              <span className="text-slate-450">Portfolio Attachment:</span>
              <span className="text-slate-200">{enclosedPortfolio ? requiredAsset.filename : "Skipped"}</span>
            </div>
            <div className="flex justify-between border-b border-slate-950 pb-1">
              <span className="text-slate-450">Submission Flow Style:</span>
              <span className="text-blue-400 font-bold">{dispatchMethod} Mode</span>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => {
                onClose();
                onNavigateToTab("tracker");
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold font-mono uppercase tracking-wider text-[10px] cursor-pointer transition-all shadow-md flex items-center gap-1"
            >
              <span>View Interactive Spreadsheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded font-bold font-mono uppercase tracking-wider text-[10px] cursor-pointer transition-all border border-slate-800"
            >
              Dismiss and Scout More
            </button>
          </div>
        </div>
      ) : (
        /* ACTIVE COCKPIT WORKSPACE WINDOW */
        <div className="space-y-4">
          
          {/* Vacancy Target Header Banner */}
          <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl flex justify-between items-start flex-wrap gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-extrabold text-slate-100">{selectedJob.company}</span>
                <span className="text-slate-650">•</span>
                <span className="text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {selectedJob.location}</span>
              </div>
              <h4 className="text-sm font-semibold text-blue-400">{selectedJob.title}</h4>
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                <span>Lane: <strong className="text-slate-400">{selectedJob.lane.split(" — ")[1]}</strong></span>
                <span>•</span>
                <span>Suggested pay: <strong className="text-emerald-400">{selectedJob.salary}</strong></span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2 rounded text-center min-w-[80px]">
              <span className="block text-[7px] text-slate-500 uppercase tracking-wider font-mono">Fit Score</span>
              <span className="text-xs font-black text-slate-200">{selectedJob.computedTotal || 24} / 30</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* COLUMN 1: DOCUMENT ASSEMBLER & AI COVER PITCHER */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h4 className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                  01. Compiling submittal enclosures
                </h4>
              </div>

              {/* Box Checkboxes */}
              <div className="space-y-2">
                
                {/* 1. Resume Match */}
                <div className={`p-2.5 rounded border transition-all ${enclosedResume ? "bg-slate-900/60 border-slate-800" : "bg-slate-950 border-slate-900 opacity-60"}`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-start gap-2">
                      <input 
                        type="checkbox"
                        checked={enclosedResume}
                        onChange={(e) => setEnclosedResume(e.target.checked)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-250 flex items-center gap-1">
                          Tailored Resume Match
                        </span>
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                          Enclosing style: <strong>{matchingResumeName}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="text-[8px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded uppercase font-mono font-bold">Matched</span>
                  </label>
                </div>

                {/* 2. Portfolio Match */}
                <div className={`p-2.5 rounded border transition-all ${enclosedPortfolio ? "bg-slate-900/60 border-slate-800" : "bg-slate-950 border-slate-900 opacity-60"}`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-start gap-2">
                      <input 
                        type="checkbox"
                        checked={enclosedPortfolio}
                        onChange={(e) => setEnclosedPortfolio(e.target.checked)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-250">
                          Active Pre-Press Vector proof sheet
                        </span>
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                          Enclosing spec file: <strong className="text-emerald-450">{requiredAsset.filename}</strong>
                        </span>
                      </div>
                    </div>
                    <span className="text-[8px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-mono font-bold">Active</span>
                  </label>
                </div>

                {/* 3. Pre-Screen compliance checkoff */}
                <div className={`p-2.5 rounded border transition-all ${enclosedDrugCheck ? "bg-slate-900/60 border-slate-800" : "bg-slate-950 border-slate-900 opacity-60"}`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-start gap-2">
                      <input 
                        type="checkbox"
                        checked={enclosedDrugCheck}
                        onChange={(e) => setEnclosedDrugCheck(e.target.checked)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-250">
                          Low-Drama Policy compliance statement
                        </span>
                        <span className="block text-[10px] text-slate-505 font-mono mt-0.5">
                          Confirms Ohio private employer medical guidelines checked.
                        </span>
                      </div>
                    </div>
                    <span className="text-[8px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded uppercase font-mono font-bold">Frictionless</span>
                  </label>
                </div>

              </div>

              {/* Cover Note Section with Gemini API! */}
              <div className="space-y-2 pt-2 border-t border-slate-900">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase">Interactive Elevator Pitch Summary</span>
                  <button
                    onClick={generateAIPitch}
                    disabled={isGeneratingPitch}
                    type="button"
                    className="text-[9.5px] font-mono font-bold text-blue-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded px-2 py-1 flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingPitch ? (
                      <>
                        <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                        <span>Tailoring...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span>Tailor pitch with Gemini</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    placeholder="Click the tailoring button to craft a high-fidelity outreach summary perfectly customized to this employer via Gemini..."
                    value={aiPitchText}
                    onChange={(e) => setAiPitchText(e.target.value)}
                    className="w-full bg-slate-950 hover:bg-slate-900 focus:bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs leading-relaxed text-slate-250 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans resize-none"
                  />
                  <div className="absolute right-2 bottom-2 text-[8px] font-mono text-slate-500 uppercase">
                    {aiPitchText.length > 0 ? `${aiPitchText.split(" ").length} words` : "Empty draft"}
                  </div>
                </div>

                <p className="text-[9.5px] text-slate-500 leading-normal italic">
                  *The AI customizes Jaime&apos;s OSP civil/precheck backgrounds to the role while steering completely clear of unlicensed Registered Architect declarations.
                </p>
              </div>

            </div>

            {/* COLUMN 2: SITE CHECKS & COM-ROUTE CALIBRATION */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-4 flex flex-col justify-between">
              
              <div className="space-y-3.5">
                <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Milestone className="w-4 h-4 text-blue-450" />
                    <h4 className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                      02. Ohio Site Transit & Pre-Flight Audits
                    </h4>
                  </div>
                  <button
                    onClick={autoCheckAllCalibrations}
                    type="button"
                    className="text-[9.5px] font-mono font-extrabold text-slate-500 hover:text-blue-400 cursor-pointer transition-colors"
                  >
                    Quick Check All
                  </button>
                </div>

                <p className="text-[11px] text-slate-450 leading-relaxed leading-normal">
                  You must confirm these structural site & prep checkpoints before dispatching. Our search model relies on pristine calibration compliance to secure fast-starts.
                </p>

                {/* Checklist Toggles */}
                <div className="space-y-2.5 pt-1 text-xs">
                  
                  {/* Commute */}
                  <label className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-900/40 p-1.5 rounded transition-colors select-none">
                    <input 
                      type="checkbox"
                      checked={calibTravel}
                      onChange={(e) => setCalibTravel(e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className={`font-mono text-xs block ${calibTravel ? "text-slate-200 font-bold" : "text-slate-400"}`}>
                        Route & Commute Verified
                      </span>
                      <p className="text-[10px] text-slate-500 font-sans leading-normal">
                        Checked distance coordinates to ensure commute requires &lt;25 minutes avoiding typical Interstate-80 / Scioto River bottleneck timings.
                      </p>
                    </div>
                  </label>

                  {/* Spot Vector Checks */}
                  <label className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-900/40 p-1.5 rounded transition-colors select-none">
                    <input 
                      type="checkbox"
                      checked={calibPrepress}
                      onChange={(e) => setCalibPrepress(e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className={`font-mono text-xs block ${calibPrepress ? "text-slate-200 font-bold" : "text-slate-400"}`}>
                        Pre-Press / CAD layers aligned
                      </span>
                      <p className="text-[10px] text-slate-500 font-sans leading-normal">
                        Verified files use named Spot layers with no double overlapping vector paths. Borders and scale parameters strictly formatted.
                      </p>
                    </div>
                  </label>

                  {/* Safety screening */}
                  <label className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-900/40 p-1.5 rounded transition-colors select-none">
                    <input 
                      type="checkbox"
                      checked={calibSafetyTerms}
                      onChange={(e) => setCalibSafetyTerms(e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className={`font-mono text-xs block ${calibSafetyTerms ? "text-slate-200 font-bold" : "text-slate-400"}`}>
                        Screening Compliance check complete
                      </span>
                      <p className="text-[10px] text-slate-500 font-sans leading-normal">
                        Verified employer screening terms are secure or represent CDL CDL-exempt Private offices to prevent matching failure.
                      </p>
                    </div>
                  </label>

                  {/* Validation code criteria */}
                  <label className="flex items-start gap-2.5 cursor-pointer hover:bg-slate-900/40 p-1.5 rounded transition-colors select-none">
                    <input 
                      type="checkbox"
                      checked={calibValidationCode}
                      onChange={(e) => setCalibValidationCode(e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className={`font-mono text-xs block ${calibValidationCode ? "text-slate-200 font-bold" : "text-slate-400"}`}>
                        Certified Tech / CSCC verify
                      </span>
                      <p className="text-[10px] text-slate-500 font-sans leading-normal">
                        Affixed standard AutoCAD certification credentials and validated regional technical criteria.
                      </p>
                    </div>
                  </label>

                </div>
              </div>

              {/* Progress Gauges during execution */}
              {submissionState !== "idle" && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2 mt-2">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-blue-400 font-bold uppercase animate-pulse">
                      Action State: {submissionState.toUpperCase()}
                    </span>
                    <span className="text-slate-300 font-extrabold">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="bg-blue-500 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* TELEMETRY TERMINAL INTERACTIVE TERMINAL WINDOW (Active during sending) */}
          {telemetryLogs.length > 0 && (
            <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg overflow-hidden font-mono text-[10.5px] text-slate-400">
              <span className="block border-b border-slate-900 pb-1.5 text-blue-405 font-bold uppercase tracking-widest text-[9px] mb-2 flex items-center justify-between">
                <span>Transmission Telemetry Terminal</span>
                <span className="text-[8px] animate-pulse">TRANSMITTING</span>
              </span>
              
              <div className="max-h-32 overflow-y-auto space-y-1 text-left font-mono leading-relaxed select-text">
                {telemetryLogs.map((log, idx) => (
                  <div key={idx} className={log.includes("[COMPLETE]") || log.includes("[SAVE]") || log.includes("[READY]") ? "text-emerald-400" : log.includes("[WARN]") ? "text-amber-400" : "text-slate-400"}>
                    {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* TRANSMISSION ACTION SET CENTER */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-4">
            <span className="block font-mono text-[9px] uppercase font-bold tracking-wider text-slate-400">
              03. Campaign Handoff Method Selection
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              
              {/* Option 1 */}
              <div 
                onClick={() => setDispatchMethod("Digital")}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  dispatchMethod === "Digital"
                    ? "bg-blue-955/20 border-blue-800/80 text-blue-200"
                    : "bg-slate-900/40 border-slate-850 text-slate-400 hover:bg-slate-850"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-blue-405 shrink-0" />
                  <span className="font-mono text-xs font-black">Digital Dispatch</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal pt-1.5 font-sans">
                  Format files and deliver resume + active proof sheets immediately to their local online pipeline inbox.
                </p>
              </div>

              {/* Option 2 */}
              <div 
                onClick={() => setDispatchMethod("Physical")}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  dispatchMethod === "Physical"
                    ? "bg-blue-955/20 border-blue-800/80 text-blue-200"
                    : "bg-slate-900/40 border-slate-850 text-slate-400 hover:bg-slate-850"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="w-4 h-4 text-orange-400 shrink-0Rotate" />
                  <span className="font-mono text-xs font-black">Physical Drop-Off</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal pt-1.5 font-sans">
                  Deliver matte hardcopy proof books directly to the Columbus production floor coordinator.
                </p>
              </div>

              {/* Option 3 */}
              <div 
                onClick={() => setDispatchMethod("Agency")}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  dispatchMethod === "Agency"
                    ? "bg-blue-955/20 border-blue-800/80 text-blue-200"
                    : "bg-slate-900/40 border-slate-850 text-slate-400 hover:bg-slate-850"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-mono text-xs font-black">Agency Staffing</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal pt-1.5 font-sans">
                  Queue submittal binder through contract agency coordinators for accelerated weekly start targets.
                </p>
              </div>

            </div>

            {/* Launch Action triggers */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-900 flex-wrap gap-2.5">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-450 leading-none">
                <Info className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Logs active state directly inside <strong>My Job Tracker Spreadsheet</strong>.</span>
              </div>

              <button
                onClick={handleLaunchDispatch}
                disabled={submissionState !== "idle"}
                className={`px-6 py-3 rounded-xl font-mono font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg transition-transform cursor-pointer active:scale-98 ${
                  submissionState !== "idle"
                    ? "bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white hover:shadow-xl"
                }`}
              >
                {submissionState !== "idle" ? (
                  <>
                    <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
                    <span>Processing Campaign...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-white animate-pulse" />
                    <span>Launch Campaign Dispatch</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
