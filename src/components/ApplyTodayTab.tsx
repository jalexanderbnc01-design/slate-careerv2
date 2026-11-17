import React, { useState, useEffect } from "react";
import { JobFixture, TrackerRow, UserProfile } from "../types";
import { 
  Sparkles, 
  CheckSquare, 
  Square, 
  Target, 
  FileSpreadsheet, 
  Check, 
  Flame, 
  Lock, 
  Unlock, 
  ListRestart, 
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Heart,
  Timer,
  Moon,
  Zap,
  Coffee,
  CheckCircle2,
  Calendar
} from "lucide-react";
import ApplicationDispatchDesk from "./ApplicationDispatchDesk";

interface DailyMission {
  id: string;
  label: string;
  completed: boolean;
}

interface ApplyTodayTabProps {
  dailyMissions: DailyMission[];
  onToggleMission: (id: string) => void;
  filteredJobs: JobFixture[];
  selectedJob: JobFixture | null;
  onSelectJob: (job: JobFixture | null) => void;
  getApplyReadiness: (job: JobFixture) => { score: number; max: number };
  builtPortfolioFiles: string[];
  onNavigateToTab: (tabId: "jobs" | "map" | "strong" | "today" | "tracker" | "portfolio" | "companies" | "messages" | "prep" | "settings" | "people" | "bridge" | "workflows") => void;
  energyLevel: "high" | "normal" | "low" | "rest";
  onEnergyLevelChange: (level: "high" | "normal" | "low" | "rest") => void;
  trackerRows: TrackerRow[];
  setTrackerRows: React.Dispatch<React.SetStateAction<TrackerRow[]>>;
  userProfile: UserProfile;
}

// Maps lane to the specific portfolio asset required
export function getRequiredPortfolioFile(laneStr: string): { filename: string; title: string } {
  const lane = (laneStr || "").toLowerCase();
  if (lane.includes("creative tech") || lane.includes("3d") || lane.includes("lane c")) {
    return { filename: "osiris_garment_simulation_3d.zip", title: "3D Product Render Set" };
  }
  if (lane.includes("cad") || lane.includes("draft") || lane.includes("lane d")) {
    return { filename: "columbus_spatial_render_v4.dwg", title: "3D CAD Exhibit Floorplans" };
  }
  if (lane.includes("fast money") || lane.includes("retail") || lane.includes("lane a")) {
    return { filename: "jaime_customer_experience_manifesto.pdf", title: "Low-Drama Operations Handbook" };
  }
  // Default/Lane B
  return { filename: "jaime_apparel_vector_kit.pdf", title: "Screen-Print Apparel Prep Deck" };
}

export default function ApplyTodayTab({
  dailyMissions,
  onToggleMission,
  filteredJobs,
  selectedJob,
  onSelectJob,
  getApplyReadiness,
  builtPortfolioFiles,
  onNavigateToTab,
  energyLevel,
  onEnergyLevelChange,
  trackerRows,
  setTrackerRows,
  userProfile
}: ApplyTodayTabProps) {
  
  // Velocity gate setting
  const [velocityLocked, setVelocityLocked] = useState(true);

  // 4-7-8 Breathing state for restorative Offline rest view
  const [breathPhase, setBreathPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale");
  const [breathSeconds, setBreathSeconds] = useState<number>(4);

  useEffect(() => {
    if (energyLevel !== "rest") return;

    const interval = setInterval(() => {
      setBreathSeconds((prev) => {
        if (prev <= 1) {
          if (breathPhase === "Inhale") {
            setBreathPhase("Hold");
            return 7;
          } else if (breathPhase === "Hold") {
            setBreathPhase("Exhale");
            return 8;
          } else {
            setBreathPhase("Inhale");
            return 4;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [breathPhase, energyLevel]);

  // If energy level changes to rest, reset breath stats
  useEffect(() => {
    if (energyLevel === "rest") {
      setBreathPhase("Inhale");
      setBreathSeconds(4);
    }
  }, [energyLevel]);

  // Listen for Escape key to close the window popup modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedJob) {
        onSelectJob(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedJob, onSelectJob]);

  // Group candidate items
  const readyTargets: JobFixture[] = [];
  const buildFirstTargets: { job: JobFixture; requiredAsset: { filename: string; title: string } }[] = [];

  filteredJobs.forEach(j => {
    const ready = getApplyReadiness(j);
    const rating = j.computedTotal ?? (j.scores.money + j.scores.creative + j.scores.thcRisk + j.scores.stress + j.scores.skill + j.scores.future);
    
    if (rating >= 24 || ready.score >= 5) {
      const requiredAsset = getRequiredPortfolioFile(j.lane);
      const isPortfolioBuilt = builtPortfolioFiles.includes(requiredAsset.filename);
      
      if (isPortfolioBuilt) {
        readyTargets.push(j);
      } else {
        buildFirstTargets.push({ job: j, requiredAsset });
      }
    }
  });

  const sortedReady = [...readyTargets].sort((a, b) => {
    const scoreA = a.computedTotal ?? 24;
    const scoreB = b.computedTotal ?? 24;
    return scoreB - scoreA;
  });

  // Dynamic overrides based on Energy Dial to automatically scale rules:
  // - High: 3 applies recommended
  // - Normal: 2 applies recommended
  // - Low: 1 apply recommended (+ show low stress reminder)
  const getVelocityLimit = (): number => {
    if (energyLevel === "high") return 3;
    if (energyLevel === "normal") return 2;
    return 1; // "low"
  };

  const activeLimit = getVelocityLimit();
  const displayedReadyJobs = velocityLocked ? sortedReady.slice(0, activeLimit) : sortedReady;

  // Filter daily missions list to match current energy level workload
  const getFilteredMissions = () => {
    if (energyLevel === "low") {
      // Return 2 absolute essential tasks only
      return dailyMissions.filter(m => m.id === "dm-2" || m.id === "dm-5");
    }
    if (energyLevel === "normal") {
      // 3 items
      return dailyMissions.filter(m => m.id === "dm-2" || m.id === "dm-3" || m.id === "dm-5");
    }
    // High energy: full list
    return dailyMissions;
  };

  const activeMissionsList = getFilteredMissions();
  const completedMissionsCount = activeMissionsList.filter(m => m.completed).length;
  const progressPercent = activeMissionsList.length > 0 
    ? Math.round((completedMissionsCount / activeMissionsList.length) * 100) 
    : 100;

  // Render REST MODE view
  if (energyLevel === "rest") {
    return (
      <div className="space-y-4 text-left font-sans animate-[fadeIn_0.5s_ease-out]">
        
        {/* Dynamic Energy Selection Bar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
          <span className="block text-xs font-medium text-slate-400">
            Daily burnout shield & rest controller
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "high", icon: <Zap className="w-3.5 h-3.5 text-amber-400" />, label: "Full Speed", desc: "Heavy Day" },
              { id: "normal", icon: <Coffee className="w-3.5 h-3.5 text-blue-400" />, label: "Balanced", desc: "Standard Pace" },
              { id: "low", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, label: "Minimum Day", desc: "Low Energy" },
              { id: "rest", icon: <Moon className="w-3.5 h-3.5 text-violet-400" />, label: "Recharge", desc: "No Guilt Off" }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => onEnergyLevelChange(btn.id as any)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col items-center gap-1.5 text-center ${
                  energyLevel === btn.id
                    ? "bg-violet-950 border-violet-500 text-violet-300 shadow font-extrabold"
                    : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-white"
                }`}
              >
                {btn.icon}
                <div className="leading-none">
                  <span className="block text-xs font-sans font-medium">{btn.label}</span>
                  <span className="text-[9px] text-slate-500">{btn.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Rest Mode Screen */}
        <div className="bg-gradient-to-b from-indigo-950/20 to-slate-950 border border-indigo-900/40 p-8 rounded-xl space-y-6 text-center max-w-3xl mx-auto flex flex-col items-center py-12 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 p-8 text-slate-800 pointer-events-none">
            <Moon className="w-36 h-36 opacity-10 rotate-12" />
          </div>

          <div className="space-y-2 max-w-xl z-10">
            <div className="bg-violet-550/10 text-violet-400 border border-violet-900/50 p-2.5 inline-block rounded-full mb-2 animate-pulse">
              <Heart className="w-6 h-6 text-violet-400" />
            </div>
            <h3 className="font-sans font-medium text-base text-indigo-100">
              Offline recovery area active
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed font-sans font-normal">
              You clicked **Recharge / Off** for today. Searching Columbus vacancies under toxic burnout conditions triggers mistakes. Action is suspended. Rejuvenation is the only legal protocol today. No stress. No guilt.
            </p>
          </div>

          {/* Interactive Breathing Bubble (4-7-8 method helper) */}
          <div className="flex flex-col items-center space-y-4">
            <div className="text-xs text-indigo-400 font-medium flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Diaphragmatic 4-7-8 breathing lock</span>
            </div>
            
            {/* Animated Ring */}
            <div className="relative flex items-center justify-center w-40 h-40">
              <div 
                className={`absolute rounded-full border border-violet-500/30 transition-all duration-1000 bg-violet-950/20 ${
                  breathPhase === "Inhale" ? "w-36 h-36 scale-110" : breathPhase === "Hold" ? "w-36 h-36 scale-110 border-indigo-500/40" : "w-16 h-16 scale-90 border-blue-500/30"
                }`}
              />
              <div className="z-10 text-center font-mono space-y-1 select-none">
                <span className="block text-2xl font-medium text-white">{breathSeconds}s</span>
                <span className="block text-xs text-violet-300 font-medium animate-pulse">{breathPhase}</span>
              </div>
            </div>

            <div className="max-w-md text-xs text-slate-450 leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-850">
              <span className="block text-xs font-semibold text-indigo-400 mb-1">Instructions:</span>
              Inhale through nose for <strong>4s</strong> (expand stomach) • Hold breath for <strong>7s</strong> • Exhale fully through mouth for <strong>8s</strong>. Relax your draft shoulders.
            </div>
          </div>

          <div className="border-t border-slate-850/60 pt-6 w-full max-w-md text-xs text-slate-400 space-y-2 font-sans leading-relaxed">
            <p className="text-xs font-medium text-blue-300">Escape strategy recommendations for Columbus:</p>
            <ul className="text-[11px] list-disc list-inside space-y-1 text-slate-400">
              <li>Head down to the <strong>Olentangy Trail</strong> for 45 minutes of silent walking.</li>
              <li>Grab a coffee and watch the water at the <strong>Scioto Mile Downtown</strong>.</li>
              <li>Read a physical print magazine or draw random doodles on scrap vector paper.</li>
              <li>No applications allowed until tomorrow. The database will survive.</li>
            </ul>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-4 text-left font-sans animate-[fadeIn_0.5s_ease-out]">
      
      {/* Dynamic Energy Selection Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <span className="block text-xs font-medium text-slate-400">
            Daily burnout shield & mental health check-in
          </span>
          <span className="text-[9.5px] font-mono text-slate-500">
            Current capacity: <strong className="text-emerald-400">{energyLevel === "high" ? "100% MAXIMUM POWER" : energyLevel === "normal" ? "75% REGULAR PACE" : "30% BASIC SURVIVAL ONLY"}</strong>
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: "high", icon: <Zap className="w-3.5 h-3.5 text-amber-500" />, label: "Full Speed", desc: "3 Apps, 2 Messages" },
            { id: "normal", icon: <Coffee className="w-3.5 h-3.5 text-blue-400" />, label: "Balanced", desc: "2 Apps, 1 Message" },
            { id: "low", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />, label: "Minimum Day", desc: "1 App + No Stress" },
            { id: "rest", icon: <Moon className="w-3.5 h-3.5 text-violet-400" />, label: "Recharge", desc: "No Guilt Rest" }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => onEnergyLevelChange(btn.id as any)}
              className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col items-center gap-1.5 text-center ${
                energyLevel === btn.id
                  ? "bg-blue-950 border-blue-500 text-blue-300 shadow font-extrabold"
                  : "bg-slate-955/60 border-slate-850 text-slate-500 hover:text-white"
              }`}
            >
              {btn.icon}
              <div className="leading-none">
                <span className="block text-xs font-sans font-medium">{btn.label}</span>
                <span className="text-[7.5px] opacity-70 leading-none block mt-0.5">{btn.desc}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Daily Milestones Checklist Dashboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-805 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600/10 p-2 rounded-lg border border-emerald-500/20">
              <Flame className="w-4 h-4 text-emerald-405" />
            </div>
            <div>
              <h3 className="font-sans font-medium text-sm text-slate-100 flex items-center gap-2">
                <span>Daily tracker milestones</span>
                {energyLevel === "low" && <span className="text-[9px] bg-teal-950 text-teal-400 border border-teal-850 py-0.5 px-2 rounded">Minimum viable day shield</span>}
              </h3>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                {energyLevel === "low" 
                  ? "Take it easy today. We scaled down your objectives to protect your health. Just checking these is a complete win!"
                  : "Check off your key hunt goals today. Steady local outreach yields immediate Columbus contracts."}
              </p>
            </div>
          </div>
          
          {/* Progress gauge */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-550 mr-0.5">Progress:</span>
            <div className="w-24 bg-slate-950 h-2 rounded overflow-hidden border border-slate-850">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-emerald-405 font-bold">{completedMissionsCount}/{activeMissionsList.length}</span>
          </div>
        </div>

        {/* Missions list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          {activeMissionsList.map((mission) => (
            <button
              key={mission.id}
              onClick={() => onToggleMission(mission.id)}
              className={`p-3 rounded-lg border transition-all text-left flex items-start gap-3 cursor-pointer ${
                mission.completed 
                  ? "bg-emerald-950/20 border-emerald-900 text-slate-300" 
                  : "bg-slate-955/40 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-300"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {mission.completed ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <span className={`text-xs ${mission.completed ? "line-through text-slate-500 font-sans" : "font-sans font-medium"}`}>
                {mission.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ACTIVE JOB DISPATCH WORKSPACE DECK POP-UP WINDOW */}
      {selectedJob && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
          onClick={() => onSelectJob(null)}
        >
          <div 
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <ApplicationDispatchDesk
              selectedJob={selectedJob}
              userProfile={userProfile}
              trackerRows={trackerRows}
              setTrackerRows={setTrackerRows}
              onClose={() => onSelectJob(null)}
              onNavigateToTab={onNavigateToTab}
            />
          </div>
        </div>
      )}

      {/* VELOCITY GATE HEADER CARD */}
      <div className="bg-gradient-to-r from-blue-950/25 to-indigo-950/25 border border-blue-900/40 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-400 font-sans text-xs font-medium">
            <Unlock className="w-3.5 h-3.5 animate-pulse" />
            <span>Apply velocity gate: Enforcing standard limits</span>
          </div>
          <p className="text-[11.5px] text-slate-400 leading-normal max-w-2xl">
            {energyLevel === "low" 
              ? "Since you&apos;re feeling tired, the gate strictly limits focus to exactly **1 match** today. Stop spraying resumes. Do one outstanding job, then rest your head."
              : `Concentrate deep. Spraying 50 vacancies blocks local interest. Focus 100% of your energy on exactly **${activeLimit} matches for today** based on standard profile scores.`}
          </p>
        </div>

        <button
          onClick={() => setVelocityLocked(!velocityLocked)}
          type="button"
          className={`px-3 py-1.5 rounded text-xs font-sans font-medium transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer ${
            velocityLocked
              ? "bg-blue-950 text-blue-401 border-blue-900/80 hover:bg-blue-900/20"
              : "bg-slate-900 text-slate-450 border-slate-800 hover:text-white"
          }`}
        >
          {velocityLocked ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Show All ({sortedReady.length})</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Enforce {activeLimit} Job Limit</span>
            </>
          )}
        </button>
      </div>

      {/* Recommended Focus Targets */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-805 pb-2">
          <h2 className="text-sm font-sans font-semibold text-slate-100 flex items-center gap-1.5">
            {velocityLocked ? `Bespoke Focus: Pick ${activeLimit} For Today` : "Qualified Ready Targets"}
          </h2>
          <span className="text-xs font-sans bg-emerald-950/40 text-emerald-400 px-2 py-0.5 rounded font-medium">
            Portfolio validated
          </span>
        </div>

        <div className="space-y-2 pt-1 font-sans">
          {displayedReadyJobs.map((j) => {
            const ready = getApplyReadiness(j);
            const isSelected = selectedJob?.id === j.id;
            const requiredAsset = getRequiredPortfolioFile(j.lane);

            return (
              <div
                key={j.id}
                onClick={() => onSelectJob(j)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-4 flex-wrap hover:bg-slate-850 ${
                  isSelected 
                    ? "bg-slate-850/60 border-blue-500/80 shadow-md animate-pulse" 
                    : "bg-slate-950/30 border-slate-850"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-sans">
                    <span className="text-xs font-medium text-slate-100">{j.company}</span>
                    <span className="bg-blue-950/40 text-blue-400 border border-blue-900/30 text-[10px] font-medium px-2 py-0.5 rounded">
                      {j.lane.split(" — ")[0]}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-blue-400 font-sans">{j.title}</h4>
                  
                  {/* Portfolio proof badge */}
                  <div className="flex items-center gap-2.5 pt-0.5 text-[10px] font-mono text-slate-450">
                    <span>{j.location}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400 animate-pulse" />
                      Proof Attached: {requiredAsset.filename}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="block text-[9px] text-slate-500">Apply readiness</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-16 bg-slate-950 h-1.5 rounded overflow-hidden border border-slate-850">
                        <div 
                           className="bg-emerald-500 h-full" 
                           style={{ width: `${(ready.score / ready.max) * 100}%` }}
                        />
                      </div>
                      <span className="text-emerald-405 font-medium font-sans text-xs shrink-0">{ready.score}/10</span>
                    </div>
                  </div>
                  
                  <div className="bg-slate-950/40 border border-slate-850 py-1.5 px-2.5 rounded font-sans text-center min-w-[50px]">
                    <span className="block text-[9px] text-slate-500">Fit score</span>
                    <span className="text-xs font-semibold text-white">{j.computedTotal || 24}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {displayedReadyJobs.length === 0 && (
            <div className="p-8 text-center text-slate-500 italic font-mono bg-slate-955/20 border border-slate-850 rounded-lg text-xs">
              No jobs currently clear the Active Portfolio Gate. Check out of the Build First projects queue below and complete recommended proof pieces to launch jobs here!
            </div>
          )}
        </div>
      </div>

      {/* PORTFOLIO BUILD FIRST QUEUE (HARD BLOCKERS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-805 pb-2">
          <h3 className="font-sans font-medium text-sm text-slate-100 flex items-center gap-1.5">
            Portfolio build first queue ({buildFirstTargets.length})
          </h3>
          <span className="text-xs font-sans bg-amber-950/40 text-amber-400 px-2 py-0.5 rounded font-medium flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Applications blocked</span>
          </span>
        </div>
        
        <p className="text-[11px] text-slate-450 leading-relaxed font-sans">
          You are legally forbidden from tech-larping a career portfolio you haven&apos;t built yet. Under strict Jaime search guidelines, these vacancies have excellent score compatibility but are <strong>HARD-LOCKED</strong> because their matching vector specs or operations manuals are not marked complete. 
        </p>

        <div className="space-y-2 pt-1 font-sans">
          {buildFirstTargets.map(({ job, requiredAsset }) => {
            const isSelected = selectedJob?.id === job.id;
            return (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className={`p-3.5 rounded-lg border border-slate-850 relative bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all cursor-pointer ${
                  isSelected ? "border-amber-900 bg-slate-900/10" : ""
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-slate-400 font-bold block bg-slate-950/75 border border-slate-850 text-[10px] px-1.5 rounded">{job.company}</span>
                    <span className="text-slate-650">•</span>
                    <span className="text-blue-450 font-bold text-[11px] font-mono leading-none">{job.title}</span>
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-2 text-[10.5px] font-mono text-slate-500">
                    <span className="font-extrabold text-amber-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Locked: Needs proof sheet: <strong>{requiredAsset.filename}</strong>
                    </span>
                    <span className="hidden sm:inline text-slate-700">|</span>
                    <span className="text-slate-455 italic shrink-0" title={requiredAsset.title}>({requiredAsset.title})</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigateToTab("portfolio");
                    }}
                    className="bg-amber-950 hover:bg-amber-900/40 text-amber-500 border border-amber-900/60 px-3 py-1.5 rounded font-mono font-bold text-[9.5px] uppercase tracking-wider cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <span>Draft Asset Specs</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                  </button>
                  
                  <div className="bg-slate-950 border border-slate-850 px-2.5 py-1 rounded font-mono text-center">
                    <span className="block text-[6.5px] text-slate-600 font-bold uppercase">Fit Score</span>
                    <span className="text-[10.5px] font-bold text-slate-400">{job.computedTotal || 24}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {buildFirstTargets.length === 0 && (
            <div className="p-4 text-center text-emerald-450 font-mono text-[10.5px] bg-emerald-950/15 border border-emerald-900/40 rounded-lg">
              100% Verified! All qualified matches have their corresponding proof files built and toggled active. No blockers sit in your active pipeline.
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
