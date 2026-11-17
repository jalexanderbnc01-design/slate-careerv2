import React, { useState, useEffect } from "react";
import { getUserStoreValue, setUserStoreValue, useUserStoreReady } from "../utils/userStore";
import { authFetch } from "../firebase/client";
import { JobFixture, UserProfile } from "../types";
import { 
  GitFork, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Clock, 
  Clipboard, 
  Copy, 
  Check, 
  Send, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from "lucide-react";

interface WorkflowTask {
  id: string;
  label: string;
  details: string;
  completed: boolean;
  estimatedMinutes: number;
}

interface WorkflowStage {
  stageName: string;
  description: string;
  tasks: WorkflowTask[];
  customScript?: string;
}

interface CustomWorkflow {
  workflowName: string;
  strategyDescription: string;
  recommendedTimeline: string;
  stages: WorkflowStage[];
}

interface WorkflowsTabProps {
  selectedJob: JobFixture | null;
  allJobs: JobFixture[];
  onSelectJob: (job: JobFixture) => void;
  userProfile: UserProfile;
}

const defaultStrategies = [
  {
    id: "ats_blitz",
    name: "All-Digital ATS Blitz",
    short: "Quick keyword alignment",
    description: "Align your resumes, cover letters, and keyword triggers to clear structural filters on standard HR platform submissions.",
    icon: <Zap className="w-4 h-4 text-amber-400" />,
    timeline: "3 to 5 Days"
  },
  {
    id: "physical_loop",
    name: "Physical In-Person Drop Loop",
    short: "Direct shop-floor handoff",
    description: "Print hard-copy high-fidelity drawings, bundle vector separations, and drive down to municipal Columbus offices to pitch directly.",
    icon: <Clipboard className="w-4 h-4 text-indigo-400" />,
    timeline: "5 to 7 Days"
  },
  {
    id: "wellness_shield",
    name: "Wellness & THC Shield Check",
    short: "Discreet contract safety",
    description: "Structure subtle pre-screening questions, verify city-wide or company policy clauses, and avoid high-stress risks discrete-first.",
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    timeline: "2 to 3 Days"
  },
  {
    id: "agency_handoff",
    name: "Columbus Agency Connection",
    short: "Direct municipal recruiter pitch",
    description: "Prepare and pack neat CAD portfolios, pre-flight coordinates, and hand off straight to regional contract agencies in Ohio.",
    icon: <GitFork className="w-4 h-4 text-cyan-400" />,
    timeline: "4 to 6 Days"
  }
];

export default function WorkflowsTab({
  selectedJob,
  allJobs,
  onSelectJob,
  userProfile
}: WorkflowsTabProps) {
  const storeReady = useUserStoreReady();
  const [selectedStrategy, setSelectedStrategy] = useState("physical_loop");
  const [activeWorkflow, setActiveWorkflow] = useState<CustomWorkflow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedScriptId, setCopiedScriptId] = useState<number | null>(null);
  const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
  
  // Custom task inputs
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [newTaskDetails, setNewTaskDetails] = useState("");
  const [newTaskMinutes, setNewTaskMinutes] = useState(30);

  // Fallback workflow generator helper
  const generateLocalTailoredWorkflow = (style: string, job: JobFixture): CustomWorkflow => {
    const jobTitleValue = job.title;
    const companyValue = job.company;
    
    let wName = `${jobTitleValue} — Direct Action Pipeline`;
    let desc = `Customized operational strategy targeting local vacancy at ${companyValue}.`;
    let stagesList: WorkflowStage[] = [];

    if (style === "physical_loop") {
      wName = `Physical Print Loop: ${companyValue}`;
      desc = "We bypass standard HR filters by hand-delivering structured technical drawing binders and spot-color silk proof sets directly to the shift floor managers.";
      stagesList = [
        {
          stageName: "Stage 1: Portfolio Pre-Flight & Print Preparation",
          description: "Inspect layer hygiene, layout grids, and print hardcopy proofs.",
          tasks: [
            { id: "p1-1", label: "Print vector separation color plates on high-weight matte sheets", details: "Prepare 12x18 visual swatches to demystify screen setup time.", completed: false, estimatedMinutes: 45 },
            { id: "p1-2", label: "Prepare local Columbus transit folder route to office coordinate", details: "Plan physical drive times avoiding Scioto-area traffic delays.", completed: false, estimatedMinutes: 15 },
            { id: "p1-3", label: "Draft print-room safety sheet emphasizing OSHA standards", details: "A clear manual page demonstrating your zero-drama shift readiness.", completed: false, estimatedMinutes: 30 }
          ],
          customScript: `Hello, manager. My name is Jaime. I understand Columbus sign houses run on tight shift-turnarounds, so I printed physical color registration swatches of my Downtown GIS models. If you have 2 minutes, I'd like to leave this packet with you to prove I require zero ramp-up time.`
        },
        {
          stageName: "Stage 2: Active Site Visit & Physical Handoff",
          description: "Conduct professional drive and hand off packet to production floors.",
          tasks: [
            { id: "p2-1", label: "Visit facility and ask specifically for lead production coordinator", details: "Keep intro brief, friendly, and structured.", completed: false, estimatedMinutes: 60 },
            { id: "p2-2", label: "Leave custom contact cards with pre-press portfolio link QR code", details: "Directly points to your high-fidelity Illustrator vector sheets.", completed: false, estimatedMinutes: 10 },
            { id: "p2-3", label: "Log name of intake contact in Columbus CRM section", details: "Save their exact spelling and title in your personal people logs.", completed: false, estimatedMinutes: 20 }
          ],
          customScript: `Hi Marcus, I just dropped off my physical prepress portfolio plates with the front desk. I put together visual alignment layers mapped specifically to your vinyl cutter systems - looking forward to keeping screen gaps at zero.`
        },
        {
          stageName: "Stage 3: Offline Policy and Stress Audit",
          description: "Verify safety margins and screen stress boundaries discrete-first.",
          tasks: [
            { id: "p3-1", label: "Audit workplace drug testing guidelines discreetly", details: "Analyze public municipality health forms to determine testing criteria", completed: false, estimatedMinutes: 40 },
            { id: "p3-2", label: "Confirm role safety risk metrics in today checklist logs", details: "Ensure stress profile has minimal noise alignment.", completed: false, estimatedMinutes: 15 },
            { id: "p3-3", label: "Establish local phone interview backup room setup", details: "Clear distractions, verify audio feeds, and isolate phone signal.", completed: false, estimatedMinutes: 30 }
          ],
          customScript: `Just wanted to confirm: Is this draft layout coordinator position subject to federal OSP testing requirements, or does it follow standard Ohio private employer health parameters? Assurant of complete compliance.`
        },
        {
          stageName: "Stage 4: Recalibration & Callback Trigger",
          description: "Send direct feedback loop to lock down formal interviews.",
          tasks: [
            { id: "p4-1", label: "Deliver follow-up validation note highlighting CSCC standards", details: "Mention your advanced civil drafting certification.", completed: false, estimatedMinutes: 25 },
            { id: "p4-2", label: "Execute contract compensation match in bridge income tab", details: "Confirm target hourly wages provide basic structural survival.", completed: false, estimatedMinutes: 15 },
            { id: "p4-3", label: "Check callback notifications and confirm interview pre-prep logs", details: "Set up the STAR situational answer sequences.", completed: false, estimatedMinutes: 30 }
          ],
          customScript: `Thanks again for your time on the floor, team. I verified my draft layers perfectly match your alignment requirements and I am fully prepared to log active shift hours immediately.`
        }
      ];
    } else if (style === "wellness_shield") {
      wName = `Wellness & THC Protection Protocol`;
      desc = "Verify Columbus safety rules, drug-testing policies, and stress metrics beforehand. Keep search low-stress, protect personal medical choices, and apply only to compliant venues.";
      stagesList = [
        {
          stageName: "Stage 1: Discretion Policy Check",
          description: "Research safety, municipal guidelines, and local health policy codes.",
          tasks: [
            { id: "w1-1", label: "Check community forums regarding company drug test triggers", details: "Confirm if screening is urine-based or rapid-panel.", completed: false, estimatedMinutes: 45 },
            { id: "w1-2", label: "Review Ohio private employer policy codes on cannabis testing", details: "Determine if there is a written safety carve-out for prescription cards.", completed: false, estimatedMinutes: 30 },
            { id: "w1-3", label: "Review stress risk scores inside the Live Jobs tab", details: "Ensure total hazard index is minimal before proceeding.", completed: false, estimatedMinutes: 15 }
          ],
          customScript: `Hello recruiter, I am reviewing the draft support role. As a CAD technology certification graduate, I prioritize rigorous design compliance. Could you share what general health and pre-employment requirements apply?`
        },
        {
          stageName: "Stage 2: Anonymous Buffer Inquiries",
          description: "Leverage standard professional inquiries to gauge drug testing triggers.",
          tasks: [
            { id: "w2-1", label: "Draft generic buffer inquiry template via email", details: "Ask general questions about pre-employment health screening packages.", completed: false, estimatedMinutes: 30 },
            { id: "w2-2", label: "Send template from a generic profile to double-check policies", details: "Ensure true confidentiality while gathering onboarding parameters.", completed: false, estimatedMinutes: 20 },
            { id: "w2-3", label: "Compare findings with Columbus CRM company feedback notes", details: "Store observations in active company tracker records.", completed: false, estimatedMinutes: 15 }
          ],
          customScript: `Dear Onboarding Specialist, could you kindly confirm if standard engineering drafting contractors are subject to pre-employment panels (such as 5-panel or 10-panel screens)? This is to arrange logistics accordingly.`
        },
        {
          stageName: "Stage 3: Pre-flight Portfolio Alignments",
          description: "Organize outstanding vector files so talent speaks louder than screening checks.",
          tasks: [
            { id: "w3-1", label: "Align visual scale drawings and 3D floorplans", details: "Present clean, outstanding CAD proofs that prove high expertise.", completed: false, estimatedMinutes: 40 },
            { id: "w3-2", label: "Confirm proof files are active in local directory explorer", details: "Prepare zip archives ready for fast sharing.", completed: false, estimatedMinutes: 10 },
            { id: "w3-3", label: "Test active links on Columbus resume cover pages", details: "Ensure portfolio links are live and mobile-friendly.", completed: false, estimatedMinutes: 15 }
          ],
          customScript: `Hi! I tailored a clean spatial rendering package illustrating standard underground utility alignments. My focus is strictly on technical precision, pristine layer hygiene, and immediate floor utility.`
        },
        {
          stageName: "Stage 4: Secure High-Contrast Settlement",
          description: "Lock in onboarding contract margins with zero disclosure hazard.",
          tasks: [
            { id: "w4-1", label: "Review onboarding document lists for safety flags", details: "Double-check drug screen clinic deadlines if requested.", completed: false, estimatedMinutes: 30 },
            { id: "w4-2", label: "Establish backup survival contract channels via the Bridge Income tab", details: "Queue safety-net gig work to safeguard active bank cashflow.", completed: false, estimatedMinutes: 20 },
            { id: "w4-3", label: "Track follow-up milestones in My Tracker", details: "Plan next actions cleanly with zero administrative lag.", completed: false, estimatedMinutes: 15 }
          ],
          customScript: `Perfect! Onboarding guidelines look completely clear. I am ready to submit final civil set layers and initialize the workflow on Monday morning.`
        }
      ];
    } else {
      // Default: ATS Blitz / Agency Handoff
      wName = `Professional Handoff Pipeline`;
      desc = "Speed up submission using custom keyword injectors, Columbus State Community College certifications, and recruiter-focused drafts.";
      stagesList = [
        {
          stageName: "Stage 1: Keyword Optimization & Pre-flight",
          description: "Insert matching skill-terms into draft summaries without fabrication.",
          tasks: [
            { id: "d1-1", label: "Align local skills list with target job posting coordinates", details: "Inject terms like 'layer hierarchy', 'pre-press setup', or 'Civil 3D'.", completed: false, estimatedMinutes: 30 },
            { id: "d1-2", label: "Proofread resume template inside settings section", details: "Avoid formatting bugs or cutoffs.", completed: false, estimatedMinutes: 20 },
            { id: "d1-3", label: "Export neat tailored PDF package containing cover letter", details: "Verify fonts pair elegantly.", completed: false, estimatedMinutes: 15 }
          ],
          customScript: `Hello, Onboarding Team. I am Jaime, an AutoCAD and Illustrator drafting specialist. I noticed your team needs high-precision color separates and pre-flights. I have configured my application pack to align directly with those specs.`
        },
        {
          stageName: "Stage 2: Channel Submission & Tracker Registry",
          description: "File formal digital application and secure pipeline telemetry.",
          tasks: [
            { id: "d2-1", label: "Submit complete files to target employer online port", details: "Verify documents upload as intended.", completed: false, estimatedMinutes: 25 },
            { id: "d2-2", label: "Create fresh record in Tracker database", details: "Log matching compensation, dates, and active contact name.", completed: false, estimatedMinutes: 10 },
            { id: "d2-3", label: "Trigger automated follow-up calendar deadline", details: "Assign discrete checkpoint dates in personal calendar.", completed: false, estimatedMinutes: 10 }
          ],
          customScript: `Dear Coordinator, I have completed the submission for the Graphics/Drafting vacancy. I look forward to demonstrating my AutoCAD and pre-flight registration systems first-hand.`
        },
        {
          stageName: "Stage 3: Recruiter Intermediary Direct Pitch",
          description: "Connect with regional Columbus staffing agencies to bypass company portals.",
          tasks: [
            { id: "d3-1", label: "Identify municipal recruiters handling structural layout contracts", details: "Connect with active agents on LinkedIn or agency portals.", completed: false, estimatedMinutes: 40 },
            { id: "d3-2", label: "Deliver tailored portfolio zip file directly to their inbox", details: "Highlight zero learning-curve value.", completed: false, estimatedMinutes: 15 },
            { id: "d3-3", label: "Request active review of manufacturing sign business backlog", details: "Ask if active roles are ready for weekly starts.", completed: false, estimatedMinutes: 20 }
          ],
          customScript: `Hi! I noticed your agency handles technical drafting contracts for Columbus sign companies. I specialize in AutoCAD, Illustrator pre-flights, and spot color registration with zero manual drift. Please find my portfolio sheets attached.`
        },
        {
          stageName: "Stage 4: Validation & Interview Ready Stage",
          description: "Review STAR question grids and prepare responses.",
          tasks: [
            { id: "d4-1", label: "Setup 3 customized STAR replies matching CSCC drafting projects", details: "Use high-fidelity GIS and streetscape models.", completed: false, estimatedMinutes: 35 },
            { id: "d4-2", label: "Execute standard interview pre-prep simulators", details: "Gain high recruiter scores with zero-drift terminology.", completed: false, estimatedMinutes: 30 },
            { id: "d4-3", label: "Confirm bridge income limits in side panels", details: "Verify weekly contract payouts are sustainable.", completed: false, estimatedMinutes: 10 }
          ],
          customScript: `Hello team! I am excited for our technical screening tomorrow. I have my vector alignment decks ready on screen to walk through custom screen marking automation.`
        }
      ];
    }

    return {
      workflowName: wName,
      strategyDescription: desc,
      recommendedTimeline: defaultStrategies.find(s => s.id === style)?.timeline || "5 Days",
      stages: stagesList
    };
  };

  // Load active workflow from Firestore (formerly localStorage) or defaults on start
  useEffect(() => {
    const saved = getUserStoreValue("jaime_active_workflow");
    if (saved) {
      try {
        setActiveWorkflow(JSON.parse(saved));
      } catch (e) {
        // Fallback to initial
        const baseJob = selectedJob || allJobs[0];
        if (baseJob) {
          setActiveWorkflow(generateLocalTailoredWorkflow(selectedStrategy, baseJob));
        }
      }
    } else {
      const baseJob = selectedJob || allJobs[0];
      if (baseJob) {
        setActiveWorkflow(generateLocalTailoredWorkflow(selectedStrategy, baseJob));
      }
    }
  }, [selectedJob, storeReady]);

  // Handle strategy icon selection
  const handleSelectStrategy = (stratId: string) => {
    setSelectedStrategy(stratId);
    const baseJob = selectedJob || allJobs[0];
    if (baseJob) {
      const updated = generateLocalTailoredWorkflow(stratId, baseJob);
      setActiveWorkflow(updated);
      setUserStoreValue("jaime_active_workflow", JSON.stringify(updated));
    }
  };

  // call server or fallback to local tailor
  const handleTailorWithAI = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const baseJob = selectedJob || allJobs[0];
    
    if (!baseJob) {
      setErrorMsg("Please select a target job first before tailoring.");
      setIsLoading(false);
      return;
    }

    const matchedStrat = defaultStrategies.find(s => s.id === selectedStrategy);
    const stratName = matchedStrat ? matchedStrat.name : "Custom";

    try {
      const res = await authFetch("/api/tailor-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowStyle: stratName,
          jobTitle: baseJob.title,
          companyName: baseJob.company,
          jobDescription: baseJob.description || baseJob.summary,
          userProfile: userProfile
        })
      });

      if (!res.ok) {
        throw new Error("API call failed.");
      }

      const data = await res.json();
      if (data && data.stages && data.stages.length > 0) {
        const tailored: CustomWorkflow = {
          workflowName: data.workflowName || `${baseJob.title} Optimized Plan`,
          strategyDescription: data.strategyDescription || `Optimized ${stratName} sequence.`,
          recommendedTimeline: data.recommendedTimeline || "7 Days",
          stages: data.stages
        };
        setActiveWorkflow(tailored);
        setUserStoreValue("jaime_active_workflow", JSON.stringify(tailored));
        setActiveStageIndex(0);
      } else {
        throw new Error("Invalid format from server.");
      }
    } catch (err) {
      console.error(err);
      // fallback
      const localBack = generateLocalTailoredWorkflow(selectedStrategy, baseJob);
      setActiveWorkflow(localBack);
      setUserStoreValue("jaime_active_workflow", JSON.stringify(localBack));
      setActiveStageIndex(0);
      setErrorMsg("Note: Refined offline as Gemini connection bypassed. Tailored blueprint loaded safely.");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle checklist tasks
  const handleToggleTask = (stageIdx: number, taskIdx: number) => {
    if (!activeWorkflow) return;
    const updatedStages = [...activeWorkflow.stages];
    const task = updatedStages[stageIdx].tasks[taskIdx];
    task.completed = !task.completed;

    const newWorkflow = {
      ...activeWorkflow,
      stages: updatedStages
    };
    setActiveWorkflow(newWorkflow);
    setUserStoreValue("jaime_active_workflow", JSON.stringify(newWorkflow));
  };

  // Add custom task to stage
  const handleAddCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskLabel.trim() || !activeWorkflow) return;

    const updatedStages = [...activeWorkflow.stages];
    const newId = `custom-t-${Date.now()}`;
    const newTask: WorkflowTask = {
      id: newId,
      label: newTaskLabel,
      details: newTaskDetails || "Custom addition.",
      completed: false,
      estimatedMinutes: newTaskMinutes || 30
    };

    updatedStages[activeStageIndex].tasks.push(newTask);
    const newWorkflow = {
      ...activeWorkflow,
      stages: updatedStages
    };
    setActiveWorkflow(newWorkflow);
    setUserStoreValue("jaime_active_workflow", JSON.stringify(newWorkflow));
    
    // reset fields
    setNewTaskLabel("");
    setNewTaskDetails("");
    setNewTaskMinutes(30);
  };

  // Delete task helper
  const handleDeleteTask = (stageIdx: number, taskIdx: number) => {
    if (!activeWorkflow) return;
    const updatedStages = [...activeWorkflow.stages];
    updatedStages[stageIdx].tasks.splice(taskIdx, 1);
    
    const newWorkflow = {
      ...activeWorkflow,
      stages: updatedStages
    };
    setActiveWorkflow(newWorkflow);
    setUserStoreValue("jaime_active_workflow", JSON.stringify(newWorkflow));
  };

  // Copy scripts helper
  const handleCopyScript = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptId(id);
    setTimeout(() => setCopiedScriptId(null), 2500);
  };

  // Calculate overall metrics
  const totalTasksCount = activeWorkflow?.stages.reduce((acc, st) => acc + st.tasks.length, 0) || 0;
  const completedTasksCount = activeWorkflow?.stages.reduce((acc, st) => acc + st.tasks.filter(t => t.completed).length, 0) || 0;
  const progressPercent = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  
  const currentStage = activeWorkflow?.stages[activeStageIndex];
  const targetJob = selectedJob || allJobs[0];

  return (
    <div className="space-y-4 text-left font-sans animate-[fadeIn_0.4s_ease-out]">
      
      {/* Page Header banner block - elegant displays */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <GitFork className="w-4 h-4 text-blue-500 animate-[spin_4s_linear_infinite]" />
            <span>Columbus career workflows & tactical sprints</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-sans leading-relaxed mt-1">
            Build strategic campaign sequences of physical handoffs, digital audits, and buffers designed for Columbus sign-shops and municipal technicians.
          </p>
        </div>

        {targetJob && (
          <div className="bg-slate-950/60 p-2 border border-slate-850 rounded-lg text-right max-w-sm shrink-0">
            <span className="block text-[8px] uppercase tracking-wider text-slate-500 font-mono">Active Target Target</span>
            <span className="block text-xs font-semibold text-blue-400 truncate leading-none mt-1">{targetJob.title}</span>
            <span className="block text-[10px] text-slate-400 mt-1 truncate">{targetJob.company} • {targetJob.location}</span>
          </div>
        )}
      </div>

      {/* Grid: Left side choosing strategies, Right side action sequence detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column Controls: Strategic template presets */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono border-b border-slate-850 pb-2">
              Select Campaign Strategy
            </h4>

            <div className="space-y-2">
              {defaultStrategies.map((strat) => {
                const isActive = selectedStrategy === strat.id;
                return (
                  <button
                    key={strat.id}
                    onClick={() => handleSelectStrategy(strat.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all cursor-pointer flex gap-3 ${
                      isActive 
                        ? "bg-blue-600/10 border-blue-500 text-slate-200"
                        : "bg-slate-950/30 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      {strat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold font-sans leading-none block">{strat.name}</span>
                        <span className="text-[8.5px] font-mono text-slate-500 shrink-0">{strat.timeline}</span>
                      </div>
                      <span className="text-[10px] text-slate-450 block italic mt-1 leading-normal">
                        {strat.short}
                      </span>
                      {isActive && (
                        <p className="text-[10.5px] text-slate-300 font-normal leading-normal mt-2">
                          {strat.description}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* AI Customization Call */}
            <div className="pt-2 border-t border-slate-850 space-y-3">
              <span className="block text-[9.5px] text-slate-500 font-mono">
                Leverage local CSCC education details and CAD criteria automatically.
              </span>
              <button
                onClick={handleTailorWithAI}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all shadow-md"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                )}
                <span>{isLoading ? "CALIBRATING TACTICS..." : "TAILOR FLOW WITH AI"}</span>
              </button>

              {errorMsg && (
                <div className="p-2.5 bg-slate-950 border border-amber-900/40 rounded text-[10px] text-amber-500 italic flex items-start gap-1.5 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Target Swapper selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
              Change Target Vacancy
            </h4>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {allJobs.map((j) => (
                <button
                  key={j.id}
                  onClick={() => onSelectJob(j)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded transition-all cursor-pointer font-sans truncate ${
                    targetJob?.id === j.id
                      ? "bg-slate-800 text-white font-medium border-l-2 border-blue-500 pl-2"
                      : "text-slate-450 hover:bg-slate-850 hover:text-slate-200"
                  }`}
                >
                  <span className="block text-[10.5px] font-semibold">{j.title}</span>
                  <span className="block text-[8.5px] text-slate-500 mt-0.5 truncate">{j.company} • {j.salary}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column Details: Flow roadmap rendering */}
        <div className="lg:col-span-8 space-y-4">
          
          {activeWorkflow ? (
            <div className="space-y-4">
              
              {/* Strategy Header & Metrics info */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="space-y-1">
                    <span className="text-[9px] bg-blue-950 border border-blue-900 text-blue-405 uppercase tracking-wider font-mono font-bold px-2.5 py-0.5 rounded">
                      ACTIVE STRATEGIC PIPELINE
                    </span>
                    <h3 className="text-base font-bold text-slate-100 font-sans tracking-tight">
                      {activeWorkflow.workflowName}
                    </h3>
                    <p className="text-xs text-slate-400 font-sans italic mt-1 leading-normal max-w-2xl">
                      {activeWorkflow.strategyDescription}
                    </p>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-850 text-right shrink-0 min-w-[120px]">
                    <span className="block text-[9px] text-slate-500 font-medium">CAMPAIGN PROCESS</span>
                    <span className="block font-mono text-base font-bold text-emerald-400 mt-1">{progressPercent}% DONE</span>
                    <div className="w-full bg-slate-900 h-1 rounded overflow-hidden mt-2">
                      <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>

                {/* Horizontal sequential stages roadmap stepper */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 pt-2">
                  {activeWorkflow.stages.map((st, idx) => {
                    const isSelected = activeStageIndex === idx;
                    const cCount = st.tasks.filter(t => t.completed).length;
                    const isAllDone = st.tasks.length > 0 && cCount === st.tasks.length;
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => setActiveStageIndex(idx)}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer relative font-sans ${
                          isSelected
                            ? "bg-slate-800 border-blue-500/80 shadow-md"
                            : isAllDone
                            ? "bg-emerald-950/15 border-emerald-900/60"
                            : "bg-slate-950/40 border-slate-850 hover:bg-slate-850"
                        }`}
                      >
                        <div className="flex justify-between items-center leading-none">
                          <span className="text-[9px] font-mono font-bold text-slate-500">
                            STEP {idx + 1}
                          </span>
                          {isAllDone && <Check className="w-3 h-3 text-emerald-400" />}
                        </div>
                        <span className="block text-xs font-semibold text-slate-205 mt-1 truncate">
                          {st.stageName.split(":").slice(-1)[0].trim() || st.stageName}
                        </span>
                        <span className="block text-[9px] text-slate-500 font-medium mt-0.5">
                          {cCount}/{st.tasks.length} subtests completed
                        </span>
                        
                        {isSelected && (
                          <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ACTIVE STAGE CHECKS & CORRESPONDING SCRIPTS */}
              {currentStage ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  
                  {/* Task Checklist Items Column */}
                  <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-2 flex-wrap gap-2">
                      <div>
                        <h4 className="text-xs font-mono font-bold text-slate-300 uppercase">
                          {currentStage.stageName}
                        </h4>
                        <p className="text-[10px] text-slate-450 italic font-sans leading-normal">
                          {currentStage.description}
                        </p>
                      </div>
                      
                      <span className="text-[9px] font-mono text-slate-500">
                        {currentStage.tasks.filter(t => t.completed).length} of {currentStage.tasks.length} cleared
                      </span>
                    </div>

                    {/* Sequential Checkboxes */}
                    <div className="space-y-2.5">
                      {currentStage.tasks.map((task, taskIdx) => (
                        <div
                          key={task.id}
                          className={`p-3 rounded-lg border transition-all text-left flex items-start gap-3 ${
                            task.completed 
                              ? "bg-slate-950/60 border-emerald-950 text-slate-500" 
                              : "bg-slate-955/20 border-slate-850 text-slate-300 hover:border-slate-800"
                          }`}
                        >
                          <button
                            onClick={() => handleToggleTask(activeStageIndex, taskIdx)}
                            className="shrink-0 mt-0.5 cursor-pointer text-slate-400 hover:text-white transition-opacity"
                          >
                            {task.completed ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-650" />
                            )}
                          </button>
                          
                          <div className="flex-1">
                            <div className="flex justify-between items-start gap-2">
                              <span className={`text-xs font-medium font-sans block ${task.completed ? "line-through text-slate-500" : ""}`}>
                                {task.label}
                              </span>
                              
                              <button
                                onClick={() => handleDeleteTask(activeStageIndex, taskIdx)}
                                className="text-slate-600 hover:text-red-400 p-0.5 rounded cursor-pointer shrink-0 transition-colors"
                                title="Remove sub-task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="block text-[10.5px] font-sans text-slate-450 leading-relaxed mt-1">
                              {task.details}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-slate-500 mt-2 bg-slate-950/40 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3 text-slate-600" />
                              Estimated time: {task.estimatedMinutes} minutes
                            </span>
                          </div>
                        </div>
                      ))}

                      {currentStage.tasks.length === 0 && (
                        <div className="p-8 text-center text-slate-500 font-mono italic text-xs">
                          No tasks configured in this stage yet. Create custom tasks below!
                        </div>
                      )}
                    </div>

                    {/* Fast Custom Task Builder form nested */}
                    <form onSubmit={handleAddCustomTask} className="border-t border-slate-850 pt-4 space-y-3">
                      <span className="block text-[10.5px] uppercase font-mono font-bold text-slate-400 tracking-wider">
                        + Add Custom Stage Milestone
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="e.g., Gather vector pre-flight sheets"
                          value={newTaskLabel}
                          onChange={(e) => setNewTaskLabel(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded text-xs text-slate-200 focus:outline-none focus:border-slate-800 font-sans"
                        />
                        <input
                          type="text"
                          placeholder="Micro-steps details"
                          value={newTaskDetails}
                          onChange={(e) => setNewTaskDetails(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded text-xs text-slate-200 focus:outline-none focus:border-slate-800 font-sans"
                        />
                      </div>
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 font-mono">Duration index:</span>
                          <input
                            type="number"
                            min="5"
                            max="300"
                            value={newTaskMinutes}
                            onChange={(e) => setNewTaskMinutes(parseInt(e.target.value) || 30)}
                            className="px-2 py-0.5 bg-slate-950 border border-slate-850 rounded text-xs text-slate-200 w-16 focus:outline-none focus:border-slate-800 font-mono align-middle"
                          />
                          <span className="text-[10px] text-slate-500 font-mono">mins</span>
                        </div>

                        <button
                          type="submit"
                          className="bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-850 px-3 py-1 rounded text-xs font-mono font-bold uppercase cursor-pointer"
                        >
                          Push Task
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Stage Script Templates on Right */}
                  <div className="md:col-span-5 space-y-4 flex flex-col justify-between">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 flex flex-col justify-between h-full">
                      <div className="space-y-1">
                        <span className="text-[9px] bg-indigo-955 text-indigo-400 px-2 py-0.5 rounded font-mono font-bold inline-flex items-center gap-1">
                          <Send className="w-3 h-3 text-indigo-400" />
                          <span>OUTREACH SWATCH</span>
                        </span>
                        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                          Direct Communication Prompt
                        </h4>
                        <p className="text-[10px] text-slate-450 leading-relaxed font-sans mt-1">
                          A customized, low-friction talking sequence tailored using your real experience. Copy and deliver directly to floor managers.
                        </p>
                      </div>

                      {currentStage.customScript ? (
                        <div className="space-y-3 pt-1">
                          <pre className="p-3 bg-slate-955 border border-slate-855 rounded-lg text-[10.5px] text-slate-300 font-mono text-left whitespace-pre-wrap select-text leading-relaxed max-h-60 overflow-y-auto">
                            {currentStage.customScript}
                          </pre>

                          <button
                            type="button"
                            onClick={() => handleCopyScript(currentStage.customScript || "", activeStageIndex)}
                            className={`w-full py-2 text-[10px] font-mono font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                              copiedScriptId === activeStageIndex
                                ? "bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-sm"
                                : "bg-slate-950 border-slate-850 text-slate-400 hover:text-white"
                            }`}
                          >
                            {copiedScriptId === activeStageIndex ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                <span>PIPELINE COPIED!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-405" />
                                <span>COPY CAMPAIGN TEXT</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="p-6 text-center italic text-slate-500 text-[11px] font-mono bg-slate-955 border border-slate-855 rounded-lg">
                          No communication scripts configured for this phase. Optimize with Gemini above to generate responsive templates automatically.
                        </div>
                      )}
                    </div>

                    {/* Operational Disclaimer card below */}
                    <div className="bg-indigo-950/10 border border-indigo-900/35 p-3 rounded-lg flex gap-2">
                      <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      <div className="leading-tight text-[10px] text-slate-450 font-sans">
                        <span className="font-semibold text-indigo-300 block mb-0.5">Columbus Grounding Guard:</span>
                        All scripts avoid licensing exaggerations. Always verify shift transit times before driving down Olentangy.
                      </div>
                    </div>
                  </div>

                </div>
              ) : null}

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 italic max-w-lg mx-auto py-12">
              Select an operational campaign strategy from the left panel to initialize your task sequence!
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
