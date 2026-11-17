import React, { useState } from "react";
import { TrackerRow } from "../types";
import { 
  Plus, 
  Trash2, 
  ListTodo, 
  FileSpreadsheet, 
  RefreshCw, 
  Mic, 
  Sparkles, 
  AlertTriangle, 
  Inbox, 
  CheckCircle, 
  Mail, 
  Calendar,
  XCircle,
  Clock,
  CornerDownLeft,
  Flame
} from "lucide-react";

interface MyTrackerTabProps {
  trackerRows: TrackerRow[];
  onToggleApplied: (id: string) => void;
  onDeleteRow: (id: string) => void;
  onAddRow: (row: Omit<TrackerRow, "id">) => void;
  onResetDefaults: () => void;
  onUpdateRow: (id: string, updatedFields: Partial<TrackerRow>) => void;
}

export default function MyTrackerTab({
  trackerRows,
  onToggleApplied,
  onDeleteRow,
  onAddRow,
  onResetDefaults,
  onUpdateRow
}: MyTrackerTabProps) {
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [lane, setLane] = useState("Lane B — Creative Production");
  const [pay, setPay] = useState("");
  const [thcRisk, setThcRisk] = useState("Low");
  const [notes, setNotes] = useState("");
  
  // Advanced fields
  const [contactName, setContactName] = useState("");
  const [resumeVersion, setResumeVersion] = useState("Creative Production Resume");
  const [portfolioPiece, setPortfolioPiece] = useState("jaime_apparel_vector_kit.pdf");

  // 60-Second Apply Log State
  const [swiftQuery, setSwiftQuery] = useState("");
  const [swiftLogSuccess, setSwiftLogSuccess] = useState<string | null>(null);
  const [isMicSimulating, setIsMicSimulating] = useState(false);

  // Momentum Dashboard toggle and calculators
  const [showMomentumPanel, setShowMomentumPanel] = useState(true);

  // Momentum metrics
  const totalApplied = trackerRows.filter(r => r.applied).length;
  
  // Calculate Streak or Applied in last 7 days
  const recentAppliedCount = trackerRows.filter(r => {
    if (!r.applied || !r.appliedDate) return false;
    const today = new Date("2026-06-04").getTime();
    const appTime = new Date(r.appliedDate).getTime();
    const diffDays = (today - appTime) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  }).length;

  // Compute conversion per lane:
  const isConverted = (s?: string) => 
    s === "Phone screen" || s === "Interviewing" || s === "Interview" || s === "Offer" || s === "Callback";

  const getLaneStats = (laneKeyword: string, displayName: string) => {
    const laneRows = trackerRows.filter(r => (r.lane || "").toLowerCase().includes(laneKeyword.toLowerCase()));
    const appliedCount = laneRows.filter(r => r.applied).length;
    const convertedCount = laneRows.filter(r => r.applied && isConverted(r.status)).length;
    const rate = appliedCount > 0 ? Math.round((convertedCount / appliedCount) * 100) : 0;
    return { appliedCount, convertedCount, rate, displayName };
  };

  const laneStats = [
    getLaneStats("Lane A", "Lane A — Fast Money / Retail"),
    getLaneStats("Lane B", "Lane B — Creative Production"),
    getLaneStats("Lane C", "Lane C — Creative Tech / 3D / AI"),
    getLaneStats("Lane D", "Lane D — CAD-Adjacent Layouts")
  ];

  // Threshold score efficacy check
  const strongApplied = trackerRows.filter(r => r.applied && r.score >= 25);
  const strongConverted = strongApplied.filter(r => isConverted(r.status)).length;
  const strongRate = strongApplied.length > 0 ? Math.round((strongConverted / strongApplied.length) * 100) : 0;

  const weakApplied = trackerRows.filter(r => r.applied && r.score < 25);
  const weakConverted = weakApplied.filter(r => isConverted(r.status)).length;
  const weakRate = weakApplied.length > 0 ? Math.round((weakConverted / weakApplied.length) * 100) : 0;

  const calibrationStatus = strongApplied.length === 0 
    ? "No high-score application responses logged yet to verify threshold calibrations."
    : strongRate >= weakRate
    ? "CALIBRATION STRONG: Your 25+ score threshold is correctly isolating high-probability creative local lanes! You waste zero time."
    : "THRESHOLD SLIPPAGE DETECTED: Low-scoring vacancies are responding faster. Adjust safety or interest weights in your profile settings to realign metrics.";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !jobTitle) return;
    
    onAddRow({
      companyName,
      jobTitle,
      lane,
      pay: pay || "$18.00/hr",
      thcRisk,
      score: 23, // default manual input score
      applied: false,
      followUpDate: "—",
      notes: notes || "Manually saved to tracker list.",
      contactName,
      resumeVersion,
      portfolioPiece,
      appliedDate: new Date().toISOString().split("T")[0],
      status: "Draft"
    });

    // Reset fields
    setCompanyName("");
    setJobTitle("");
    setPay("");
    setNotes("");
    setContactName("");
  };

  // 60-Second Heuristic Parser
  const runSwiftParser = (text: string) => {
    if (!text.trim()) return;
    
    const lowercase = text.toLowerCase();
    
    // Default values
    let extractedCompany = "Columbus Local Shop";
    let extractedTitle = "Creative Production Assistant";
    let extractedLane = "Lane B — Creative Production";
    let extractedPay = "$19.00/hr";
    let extractedRisk = "Low";
    let extractedPortfolio = "jaime_apparel_vector_kit.pdf";
    let extractedResume = "Creative Production Resume";

    // 1. Pay parsing (e.g. $22, 18.50, 20/hr, 25 an hour)
    const payMatch = lowercase.match(/(?:(?:at|paying|for|\$)\s*)(\d+(?:\.\d+)?)/);
    if (payMatch) {
      extractedPay = `$${payMatch[1]}/hr`;
    }

    // 2. Company & Title extraction (Using "at [company]" or similar)
    const atIndices = lowercase.indexOf(" at ");
    if (atIndices !== -1) {
      // Something before "at": title!
      const beforeAt = text.substring(0, atIndices).trim();
      if (beforeAt) {
        extractedTitle = beforeAt;
      }
      
      // Something after "at": company!
      const afterAt = text.substring(atIndices + 4).trim();
      // Split on punctuation/keywords
      const afterAtClean = afterAt.split(/[,.!?;\(]|\b(?:paying|for|with|met|today)\b/i)[0].trim();
      if (afterAtClean) {
        extractedCompany = afterAtClean;
      }
    } else {
      // Just split based on typical spaces
      const tokens = text.split(/\s+/);
      if (tokens.length >= 2) {
        extractedTitle = tokens.slice(0, Math.min(3, tokens.length - 1)).join(" ");
        extractedCompany = tokens.slice(Math.min(3, tokens.length - 1)).join(" ");
      }
    }

    // 3. Lane deduction based on keywords
    if (lowercase.includes("3d") || lowercase.includes("blender") || lowercase.includes("render") || lowercase.includes("simulation")) {
      extractedLane = "Lane C — Creative Tech / 3D / AI";
      extractedPortfolio = "osiris_garment_simulation_3d.zip";
      extractedResume = "3D Visualization Resume";
    } else if (lowercase.includes("cad") || lowercase.includes("draft") || lowercase.includes("autocad") || lowercase.includes("blueprint") || lowercase.includes("floorplan")) {
      extractedLane = "Lane D — CAD-Adjacent Layouts";
      extractedPortfolio = "columbus_spatial_render_v4.dwg";
      extractedResume = "CAD-Adjacent Design Resume";
    } else if (lowercase.includes("dispensary") || lowercase.includes("retail") || lowercase.includes("cashier") || lowercase.includes("budtender") || lowercase.includes("inventory")) {
      extractedLane = "Lane A — Fast Money / Retail";
      extractedPortfolio = "jaime_customer_experience_manifesto.pdf";
      extractedResume = "Customer Operations Resume";
    }

    // Risk alignment
    if (extractedLane.includes("Retail")) {
      extractedRisk = "Low";
    } else if (extractedLane.includes("Tech")) {
      extractedRisk = "Low";
    } else {
      extractedRisk = "Medium";
    }

    // Auto-Commit row Immediately!
    onAddRow({
      companyName: extractedCompany,
      jobTitle: extractedTitle,
      lane: extractedLane,
      pay: extractedPay,
      thcRisk: extractedRisk,
      score: 25, // Quick matched gets qualified score baseline
      applied: true, // Marked applied immediately as requested
      appliedDate: new Date().toISOString().split("T")[0], // applied today
      status: "Applied",
      followUpDate: "Friday Check-in",
      notes: `Swift logged context: "${text}"`,
      portfolioPiece: extractedPortfolio,
      resumeVersion: extractedResume
    });

    setSwiftLogSuccess(`Auto-logged! Registered "${extractedTitle}" @ ${extractedCompany} under ${extractedLane.split(" — ")[0]} (${extractedPay})!`);
    setSwiftQuery("");
    setTimeout(() => setSwiftLogSuccess(null), 5000);
  };

  // Simulating Voice Dictation Input Preset
  const handleSimulateVoice = () => {
    setIsMicSimulating(true);
    const mockPhrases = [
      "Screen Print Assistant at Scioto Valley Screenworks paying 20 an hour met Marcus today",
      "Retail Associate at Buckeye dispensary for 18.50 hourly log this",
      "3D Environment Modeler at Osiris Digital Studio for 28.00 an hour",
      "Drafting specialist at Alliance CAD planners paying 24.50"
    ];
    const chosen = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
    
    let currentText = "";
    let tokenIndex = 0;
    const tokens = chosen.split(" ");
    
    const interval = setInterval(() => {
      if (tokenIndex < tokens.length) {
        currentText += (tokenIndex === 0 ? "" : " ") + tokens[tokenIndex];
        setSwiftQuery(currentText);
        tokenIndex++;
      } else {
        clearInterval(interval);
        setIsMicSimulating(false);
        runSwiftParser(chosen);
      }
    }, 150);
  };

  // Dead Jobs scanner (applied > 7 days ago, still marked as 'Applied')
  const getDeadApplications = (): { row: TrackerRow, ageDays: number }[] => {
    const today = new Date("2026-06-04").getTime(); // fixed anchor time
    return trackerRows
      .filter(row => row.applied && row.status === "Applied" && row.appliedDate)
      .map(row => {
        const appTime = new Date(row.appliedDate!).getTime();
        const diffTime = today - appTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { row, ageDays: diffDays };
      })
      .filter(item => item.ageDays > 7);
  };

  const deadApps = getDeadApplications();

  const handlePruneStaleJob = (id: string, company: string) => {
    onUpdateRow(id, { status: "Silent rejection", notes: "Marked as Silent Rejection during weekly dead jobs calibration." });
    setSwiftLogSuccess(`Archived stale case: Mark "${company}" state to Silent Rejection.`);
    setTimeout(() => setSwiftLogSuccess(null), 4000);
  };

  const handleFollowupStaleJob = (id: string, company: string) => {
    onUpdateRow(id, { 
      notes: "Followed up on June 04, 25. High energy request sent.", 
      followUpDate: "Sent follow-up email",
      status: "Interview"
    });
    setSwiftLogSuccess(`Status Shift: Marked "${company}" as active Interview Callback track!`);
    setTimeout(() => setSwiftLogSuccess(null), 4000);
  };

  return (
    <div className="space-y-4 font-sans text-left">
      
      {/* MOMENTUM TRACKER & ANALYTICS CALIBRATOR PANEL */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
                Momentum Tracker & Calibration Engine
              </h3>
              <p className="text-[11px] text-slate-400 leading-normal font-sans">
                Real-time conversion statistics, local lane velocity analysis, and fit-score threshold calibrations.
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowMomentumPanel(!showMomentumPanel)}
            type="button"
            className="text-[10px] font-mono font-bold bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-850 px-3 py-1.5 rounded transition-all cursor-pointer"
          >
            {showMomentumPanel ? "Collapse Analytics" : "Expand Analytics"}
          </button>
        </div>

        {showMomentumPanel && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-850">
            {/* 1. Velocity Block */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-2.5">
              <span className="block font-mono text-[9px] uppercase font-bold text-blue-400">
                Application Velocity & Streak
              </span>
              
              <div className="flex justify-between items-end">
                <div>
                  <span className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Weekly Velocity</span>
                  <span className="text-xl font-black font-mono text-white mt-1 block">
                    {recentAppliedCount} Applied
                  </span>
                </div>
                <div className="text-right">
                  <span className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Active Streak</span>
                  <span className="text-xs font-bold font-mono text-emerald-405 flex items-center gap-0.5 justify-end">
                    <Flame className="w-3.5 h-3.5 text-orange-500 animate-pulse mt-0.5" />
                    {recentAppliedCount > 0 ? "Active Week" : "0 Days"}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-450">
                  <span>Weekly Pace ({recentAppliedCount}/3 targets)</span>
                  <span className="font-bold">{Math.round((recentAppliedCount / 3) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-900 h-2 rounded overflow-hidden border border-slate-800">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300" 
                    style={{ width: `${Math.min(100, (recentAppliedCount / 3) * 100)}%` }}
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-normal font-sans">
                {recentAppliedCount >= 3 
                  ? "Optimal Velocity met! You applied to at least 3 high-quality local matches this week. Stop spraying and let calibration mature."
                  : "Ice Warning: Aim for 3 bespoke applications/week to keep momentum warm. Log new applications to fuel the calibration engine!"}
              </p>
            </div>

            {/* 2. Lane Conversion Ratio Stats */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-2.5">
              <span className="block font-mono text-[9px] uppercase font-bold text-blue-400 font-semibold">
                Lane Callback Ratios
              </span>

              <div className="space-y-1.5 max-h-[120px] overflow-y-auto font-mono">
                {laneStats.map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10.5px] border-b border-slate-900/50 pb-1 last:border-0">
                    <span className="text-slate-400 text-[10px] truncate max-w-[125px]" title={stat.displayName}>
                      {stat.displayName.split(" — ")[1] || stat.displayName}
                    </span>
                    <div className="flex items-center gap-1.5 font-sans shrink-0">
                      <span className="text-[9.5px] text-slate-500">({stat.convertedCount}/{stat.appliedCount})</span>
                      <span className={`font-bold font-mono text-xs ${stat.rate > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                        {stat.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] text-slate-500 leading-normal font-sans pt-0.5 border-t border-slate-900">
                Conversion monitors which search focus (Creative Prod vs Tech renders vs Dispensary Retail) responds fastest to your specs file.
              </p>
            </div>

            {/* 3. Fit Score Calibration Box */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-1.5">
                <span className="block font-mono text-[9px] uppercase font-bold text-blue-400">
                  Fit-Score threshold check
                </span>
                
                <div className="flex justify-between items-center text-xs font-mono">
                  <div className="space-y-0.5">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase">Strong Fits (25+)</span>
                    <span className="text-slate-200 mt-0.5 block font-extrabold">{strongRate}% callback</span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase">Weak Fits (&lt;25)</span>
                    <span className="text-slate-400 mt-0.5 block font-extrabold">{weakRate}% callback</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-900 font-sans text-[10px] text-slate-400 leading-relaxed border border-slate-850">
                <span className="font-bold text-slate-200 block uppercase text-[8px] font-mono tracking-wider mb-1">
                  Calibration Report:
                </span>
                {calibrationStatus}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 60-SECOND SWIFT APPLY LOG PANEL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="bg-blue-500/10 p-1.5 rounded border border-blue-500/20">
              <Mic className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                60-Second swift Apply Logging Station
              </h4>
              <p className="text-[10px] text-slate-400">
                Log a role in 1 tap. Type or dictate. Heuristic engine auto-populates salary, company, position, and matches safety lanes in milliseconds.
              </p>
            </div>
          </div>
          
          <span className="text-[9px] bg-blue-950 text-blue-405 border border-blue-900 px-2 py-0.5 rounded font-mono font-bold">
            Frictionless Engine Active
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Main Swift input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder='Try typing: "Drafter at CAD Planners for 24 an hour" or tap Mic dictation simulation...'
              value={swiftQuery}
              onChange={(e) => setSwiftQuery(e.target.value)}
              disabled={isMicSimulating}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  runSwiftParser(swiftQuery);
                }
              }}
              className="w-full pl-3.5 pr-20 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
            />
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={handleSimulateVoice}
                title="Dictate with simulated microphone"
                className={`p-1.5 cursor-pointer rounded transition-all ${
                  isMicSimulating ? "bg-red-650 text-white animate-ping" : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={() => runSwiftParser(swiftQuery)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-[9.5px] px-2 py-1 rounded cursor-pointer leading-none"
              >
                Log It
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Log Notifications */}
        {swiftLogSuccess && (
          <div className="bg-emerald-950/30 border border-emerald-900/60 p-2.5 rounded text-[10.5px] text-emerald-400 font-mono text-center animate-pulse flex items-center justify-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-450 shrink-0" />
            <span>{swiftLogSuccess}</span>
          </div>
        )}
      </div>

      {/* "DEAD JOBS" AUDIT & STALE PRUNING BOX (If stale trackers exist) */}
      {deadApps.length > 0 && (
        <div className="bg-amber-950/10 border border-amber-900/40 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2 border-b border-amber-950/40 pb-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                Stale Applications Audit Required ({deadApps.length} Dead Leads)
              </h4>
              <p className="text-[10px] text-slate-400 leading-normal font-sans mt-0.5">
                The applications listed below have been sitting over <strong>7 days</strong> with zero response. Dead data creates false hope noise and clogs your matching thresholds. Follow up to push the state, or prune the file now!
              </p>
            </div>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {deadApps.map(({ row, ageDays }) => (
              <div key={row.id} className="p-3 bg-slate-950 border border-slate-900 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-extrabold text-white">{row.companyName}</span>
                    <span className="text-[9px] text-slate-500">•</span>
                    <span className="text-blue-300 font-bold">{row.jobTitle}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" /> 
                      Applied: <strong className="text-slate-400">{row.appliedDate}</strong> ({ageDays} days ago)
                    </span>
                    <span>•</span>
                    <span className="text-slate-400">Current state: <strong className="uppercase">{row.status || "Applied"}</strong></span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleFollowupStaleJob(row.id, row.companyName)}
                    className="bg-blue-950 hover:bg-blue-900/40 text-blue-405 border border-blue-900 px-2.5 py-1.5 rounded font-mono font-bold text-[9.5px] uppercase tracking-wide cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <Mail className="w-3 h-3" />
                    <span>Send Followup</span>
                  </button>

                  <button
                    onClick={() => handlePruneStaleJob(row.id, row.companyName)}
                    className="bg-amber-950/20 hover:bg-amber-900/30 text-amber-500 border border-amber-900/40 px-2.5 py-1.5 rounded font-mono font-bold text-[9.5px] uppercase tracking-wide cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <XCircle className="w-3 h-3" />
                    <span>Prune Case</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick spreadsheet editor view */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
              <ListTodo className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
                My Job Tracker Spreadsheet
              </h3>
              <p className="text-[11px] text-slate-400 leading-normal font-sans">
                Score targets, prepare assets, log follow-up actions, and monitor active pipelines dynamically.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm("Restore custom tracker to default recommended print shop & 3D rows?")) {
                onResetDefaults();
              }
            }}
            className="text-[10px] font-mono font-bold bg-slate-950 hover:bg-slate-850 hover:text-blue-405 border border-slate-800 text-slate-400 px-3 py-1.5 rounded transition-all cursor-pointer"
          >
            Reset Default Items
          </button>
        </div>

        {/* Custom Interactive Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-855 bg-slate-955/50">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[9px] uppercase font-bold tracking-wider">
                <th className="p-3">Company Info</th>
                <th className="p-3">Position</th>
                <th className="p-3">Lane & Pay</th>
                <th className="p-3">THC risk</th>
                <th className="p-3 text-center">Score /30</th>
                <th className="p-3 text-center">Applied?</th>
                <th className="p-3">Log Date</th>
                <th className="p-3">Job State</th>
                <th className="p-3">Portfolio Piece</th>
                <th className="p-3">Contact Recruiter</th>
                <th className="p-3">Next Action</th>
                <th className="p-3">Notes</th>
                <th className="p-3 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {trackerRows.map((row) => (
                <tr key={row.id} className={`hover:bg-slate-900/40 bg-slate-955/15 transition-all ${
                  ["Silent rejection", "Auto-rejection", "Rejected after interview", "Withdrew"].includes(row.status) ? "opacity-50 line-through text-slate-500" : ""
                }`}>
                  <td className="p-3">
                    <span className="block font-bold text-slate-200">{row.companyName}</span>
                    <span className="text-[10px] font-mono text-slate-500">{row.companyTarget || "Columbus, OH"}</span>
                  </td>
                  <td className="p-3 text-blue-450 font-bold">{row.jobTitle}</td>
                  <td className="p-3">
                    <span className="block font-mono text-[10px] text-slate-400">{row.lane?.split(" — ")[0]}</span>
                    <span className="block font-mono text-emerald-400 font-bold mt-0.5">{row.pay}</span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 select-none border rounded text-[9px] font-bold font-mono ${
                      row.thcRisk.toLowerCase() === "low" 
                        ? "bg-emerald-950/40 text-emerald-405 border-emerald-900/50" 
                        : "bg-amber-950/40 text-amber-400 border-amber-900/50"
                    }`}>
                      {row.thcRisk} Risk
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      row.score >= 25 
                        ? "bg-emerald-950/45 text-emerald-400 border border-emerald-900" 
                        : row.score >= 18 
                        ? "bg-blue-950/45 text-blue-405 border border-blue-900" 
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {row.score}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => onToggleApplied(row.id)}
                      className="focus:outline-none cursor-pointer inline-block"
                    >
                      {row.applied ? (
                        <span className="bg-emerald-600 text-white rounded text-[9px] px-2.5 py-0.5 font-bold uppercase tracking-wider font-mono shadow-sm">
                          YES
                        </span>
                      ) : (
                        <span className="bg-slate-800 text-slate-400 rounded text-[9px] px-2.5 py-0.5 font-bold uppercase tracking-wider font-mono border border-slate-700">
                          NO
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-400">{row.appliedDate || "—"}</td>
                  
                  {/* Dynamic editable job status selectors */}
                  <td className="p-3">
                    <select
                      value={row.status || (row.applied ? "Applied" : "Draft")}
                      onChange={(e) => onUpdateRow(row.id, { 
                        status: e.target.value as any,
                        applied: e.target.value !== "Draft"
                      })}
                      className="bg-slate-900 border border-slate-800 text-slate-200 text-[10.5px] rounded p-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Draft">Draft / Preparing</option>
                      <option value="Applied">Applied Sent</option>
                      <option value="Silent rejection">Silent rejection (7+ days)</option>
                      <option value="Auto-rejection">Auto-rejection email</option>
                      <option value="Phone screen">Phone screen</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Offer">Offer Received!</option>
                      <option value="Rejected after interview">Rejected post-interview</option>
                      <option value="Withdrew">Withdrew application</option>
                    </select>
                  </td>

                  <td className="p-3 font-medium text-slate-350 truncate max-w-[120px]" title={row.portfolioPiece}>
                    {row.portfolioPiece || "—"}
                  </td>
                  <td className="p-3 font-mono text-slate-400">{row.contactName || "—"}</td>
                  <td className="p-3 text-blue-300 font-mono text-[11px]">{row.followUpDate}</td>
                  <td className="p-3 text-slate-450 italic max-w-[150px] truncate" title={row.notes}>
                    {row.notes}
                  </td>
                  <td className="p-3 text-center font-mono">
                    <button
                      onClick={() => onDeleteRow(row.id)}
                      className="p-1.5 hover:bg-rose-950/40 hover:text-rose-450 text-slate-500 rounded-lg cursor-pointer transition-all"
                      title="Delete Tracker Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {trackerRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-500 font-mono italic bg-slate-955/20">
                    No active target jobs logs recorded yet. Score opportunities inside the "Live Jobs" dashboard!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Manual ADD item directly form row */}
        <form onSubmit={handleSubmit} className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3">
          <span className="block text-[10px] uppercase font-bold font-mono text-slate-300 tracking-wider">
            Append job target manually
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Company Name *</label>
              <input
                type="text" required
                placeholder="e.g. Buckeye Signs"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-800 rounded bg-slate-900 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Job Title *</label>
              <input
                type="text" required
                placeholder="e.g. Production Artist"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-800 rounded bg-slate-900 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Est Pay Rate</label>
              <input
                type="text"
                placeholder="e.g. $22.00 / hr"
                value={pay}
                onChange={(e) => setPay(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-800 rounded bg-slate-900 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Job Seek Lane</label>
              <select
                value={lane}
                onChange={(e) => setLane(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-800 rounded bg-slate-900 text-xs text-white focus:outline-none font-mono"
              >
                <option value="Lane B — Creative Production">Lane B — Creative Production</option>
                <option value="Lane A — Fast Money / Retail">Lane A — Fast Money / Retail</option>
                <option value="Lane C — Creative Tech / 3D / AI">Lane C — Creative Tech / 3D / AI</option>
                <option value="Lane D — CAD-Adjacent Layouts">Lane D — CAD-Adjacent Layouts</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">THC Screening Risk</label>
              <select
                value={thcRisk}
                onChange={(e) => setThcRisk(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-800 rounded bg-slate-900 text-xs text-white focus:outline-none font-mono"
              >
                <option value="Low">Low Risk (Dispensary/Office)</option>
                <option value="Medium">Medium Risk (General Trades)</option>
                <option value="High">High Risk (CDL/Safety Sensitive)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Recruiter / Contact Name</label>
              <input
                type="text"
                placeholder="e.g. Sarah Jenkins (Shop Manager)"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-800 rounded bg-slate-900 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Interactive Workspace notes</label>
              <input
                type="text"
                placeholder="e.g. Placed application vector, waiting for screening check."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-800 rounded bg-slate-900 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-900">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold font-mono uppercase tracking-wider text-[10px] flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Add Tracker Row</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
