import React, { useState, useEffect, useMemo } from "react";
import { getUserStoreValue, setUserStoreValue, useUserStoreReady } from "../utils/userStore";
import {
  XelimeWorkspaceState,
  XelimeCareerPath,
  XelimeOpportunity,
  XelimeApplicationStatus,
  XelimeSkill,
  SkillCategory,
  SkillDevStatus,
  XelimeProject,
  ProjectDivision,
  ProjectProgressStatus,
  PortfolioPublishStatus,
  XelimeFreelanceDeal,
  FreelanceServiceCategory,
  FreelanceStage,
} from "../types/xelime";
import { defaultXelimeState, computeDecisionScore } from "../data/xelimeDefaults";
import {
  Compass,
  Briefcase,
  Layers,
  FolderKanban,
  DollarSign,
  LayoutDashboard,
  Plus,
  Trash2,
  ExternalLink,
  CheckSquare,
  Square,
  ArrowRight,
  Sliders,
  Check,
  RotateCcw,
} from "lucide-react";

type XcmsSection =
  | "overview"
  | "paths"
  | "opportunities"
  | "skills"
  | "projects"
  | "freelance";

const STORAGE_KEY = "xelime_xcms_state_v1";

const APPLICATION_STATUSES: XelimeApplicationStatus[] = [
  "Discovered",
  "Researching",
  "Qualified",
  "Preparing Application",
  "Applied",
  "Interviewing",
  "Offer Received",
  "Rejected",
  "Archived",
];

const SKILL_CATEGORIES: SkillCategory[] = [
  "Architecture",
  "3D Design",
  "Real-Time",
  "Development",
  "Product Design",
];

const SKILL_STATUSES: SkillDevStatus[] = [
  "Not Started",
  "Learning",
  "Practicing",
  "Portfolio Ready",
  "Professional",
];

const PROJECT_DIVISIONS: ProjectDivision[] = [
  "Architecture",
  "Visualization",
  "Digital",
];

const PROJECT_PROGRESS_STATUSES: ProjectProgressStatus[] = [
  "Planned",
  "In Progress",
  "Review",
  "Completed",
];

const PORTFOLIO_STATUSES: PortfolioPublishStatus[] = [
  "Internal Draft",
  "Portfolio Ready",
  "Published",
];

const FREELANCE_SERVICES: FreelanceServiceCategory[] = [
  "CAD drafting",
  "Architectural modeling",
  "3D visualization",
  "Interactive 3D websites",
  "Digital interface design",
];

const FREELANCE_STAGES: FreelanceStage[] = [
  "Lead",
  "Estimate Sent",
  "Contract Signed",
  "Active Project",
  "Invoiced",
  "Paid",
];

interface XelimeSystemProps {
  onImportToBuilder: (job: {
    title: string;
    company: string;
    location: string;
    description: string;
    style: string;
  }) => void;
}

export default function XelimeSystem({ onImportToBuilder }: XelimeSystemProps) {
  const storeReady = useUserStoreReady();
  const [state, setState] = useState<XelimeWorkspaceState>(defaultXelimeState);

  useEffect(() => {
    if (!storeReady) return;
    const saved = getUserStoreValue(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        // Fallback to default state
      }
    }
  }, [storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue(STORAGE_KEY, JSON.stringify(state));
  }, [state, storeReady]);

  useEffect(() => {
    const handleSync = () => {
      const saved = getUserStoreValue(STORAGE_KEY);
      if (saved) {
        try {
          setState(JSON.parse(saved));
        } catch {
          // Ignore parse errors
        }
      }
    };
    window.addEventListener("xelime-state-updated", handleSync);
    return () => window.removeEventListener("xelime-state-updated", handleSync);
  }, []);

  const [section, setSection] = useState<XcmsSection>("overview");
  const [selectedPathId, setSelectedPathId] = useState<string>(
    state.careerPaths[0]?.id || "cp-cad-bim"
  );
  const [selectedOppId, setSelectedOppId] = useState<string>(
    state.opportunities[0]?.id || ""
  );
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [pathFilter, setPathFilter] = useState<string>("ALL");
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string>("ALL");
  const [projectDivisionFilter, setProjectDivisionFilter] = useState<string>("ALL");
  const [newMilestoneText, setNewMilestoneText] = useState("");

  // Add Forms visibility
  const [showAddOpp, setShowAddOpp] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddFreelance, setShowAddFreelance] = useState(false);

  // New Opportunity form state
  const [newOpp, setNewOpp] = useState({
    jobTitle: "",
    company: "",
    careerPathId: state.careerPaths[0]?.id || "cp-cad-bim",
    employmentType: "Full-time" as XelimeOpportunity["employmentType"],
    workArrangement: "Remote" as XelimeOpportunity["workArrangement"],
    salary: 60000,
    location: "Columbus, OH / Remote",
    requiredSkills: "AutoCAD, Revit",
    applicationUrl: "",
    priority: "High" as XelimeOpportunity["priority"],
    notes: "",
  });

  // New Skill form state
  const [newSkill, setNewSkill] = useState({
    name: "",
    category: "Architecture" as SkillCategory,
    status: "Learning" as SkillDevStatus,
    currentProficiency: 40,
    targetProficiency: 85,
    learningResources: "",
    practiceProjects: "",
  });

  // New Project form state
  const [newProject, setNewProject] = useState({
    name: "",
    division: "Architecture" as ProjectDivision,
    careerPathIds: [state.careerPaths[0]?.id || "cp-cad-bim"],
    software: "Revit, Blender",
    skillsDemonstrated: "BIM Modeling, Lighting",
    projectUrl: "",
    summary: "",
  });

  // New Freelance Deal form state
  const [newDeal, setNewDeal] = useState({
    clientName: "",
    projectTitle: "",
    serviceCategory: "CAD drafting" as FreelanceServiceCategory,
    estimateAmount: 1500,
    deliverables: "",
  });

  // Computed metrics across connected databases
  const metrics = useMemo(() => {
    const activeOpps = state.opportunities.filter(
      (o) => o.applicationStatus !== "Archived" && o.applicationStatus !== "Rejected"
    );
    const scoredOpps = activeOpps.map((o) => ({
      opp: o,
      total: computeDecisionScore(o.decisionScores),
    }));
    scoredOpps.sort((a, b) => b.total - a.total);

    const avgScore =
      scoredOpps.length > 0
        ? (
            scoredOpps.reduce((sum, item) => sum + item.total, 0) / scoredOpps.length
          ).toFixed(1)
        : "0.0";

    const portfolioReadyCount = state.projects.filter(
      (p) => p.portfolioStatus === "Portfolio Ready" || p.portfolioStatus === "Published"
    ).length;

    const skillsReadyCount = state.skills.filter(
      (s) => s.status === "Portfolio Ready" || s.status === "Professional"
    ).length;

    const freelancePipeline = state.freelanceDeals.reduce(
      (sum, d) => sum + (Number(d.estimateAmount) || 0),
      0
    );
    const freelanceRevenue = state.freelanceDeals.reduce(
      (sum, d) => sum + (Number(d.revenueCollected) || 0),
      0
    );

    // Map each skill name -> how many active opportunities require it
    const skillDemandMap: Record<string, XelimeOpportunity[]> = {};
    for (const opp of activeOpps) {
      for (const req of opp.requiredSkills) {
        const key = req.trim().toLowerCase();
        if (!skillDemandMap[key]) skillDemandMap[key] = [];
        skillDemandMap[key].push(opp);
      }
    }

    // Highest demand non-ready skills
    const priorityGaps = state.skills
      .filter((s) => s.status === "Not Started" || s.status === "Learning" || s.status === "Practicing")
      .map((s) => ({
        skill: s,
        demandCount: skillDemandMap[s.name.toLowerCase()]?.length || 0,
        gap: Math.max(0, s.targetProficiency - s.currentProficiency),
      }))
      .sort((a, b) => b.demandCount - a.demandCount || b.gap - a.gap);

    return {
      activeOpps,
      topOpportunity: scoredOpps[0] || null,
      avgScore,
      portfolioReadyCount,
      skillsReadyCount,
      freelancePipeline,
      freelanceRevenue,
      skillDemandMap,
      priorityGaps,
    };
  }, [state]);

  const selectedPath =
    state.careerPaths.find((p) => p.id === selectedPathId) || state.careerPaths[0];

  const sortedFilteredOpportunities = useMemo(() => {
    return state.opportunities
      .filter((o) => (statusFilter === "ALL" ? true : o.applicationStatus === statusFilter))
      .filter((o) => (pathFilter === "ALL" ? true : o.careerPathId === pathFilter))
      .slice()
      .sort(
        (a, b) =>
          computeDecisionScore(b.decisionScores) - computeDecisionScore(a.decisionScores)
      );
  }, [state.opportunities, statusFilter, pathFilter]);

  const selectedOpp =
    state.opportunities.find((o) => o.id === selectedOppId) ||
    sortedFilteredOpportunities[0] ||
    null;

  // Lookup helpers
  const getCareerPathName = (id: string) =>
    state.careerPaths.find((p) => p.id === id)?.name || "Unassigned";

  const evaluateOppSkillAlignment = (required: string[]) => {
    const ready: string[] = [];
    const developing: string[] = [];
    const missing: string[] = [];

    for (const req of required) {
      const match = state.skills.find(
        (s) => s.name.toLowerCase() === req.trim().toLowerCase()
      );
      if (!match) {
        missing.push(req);
      } else if (match.status === "Portfolio Ready" || match.status === "Professional") {
        ready.push(req);
      } else {
        developing.push(`${req} (${match.status})`);
      }
    }
    return { ready, developing, missing };
  };

  // Handlers
  const handleToggleMilestone = (pathId: string, milestoneId: string) => {
    setState((prev) => ({
      ...prev,
      careerPaths: prev.careerPaths.map((p) =>
        p.id === pathId
          ? {
              ...p,
              milestones: p.milestones.map((m) =>
                m.id === milestoneId ? { ...m, completed: !m.completed } : m
              ),
            }
          : p
      ),
    }));
  };

  const handleAddMilestone = (pathId: string) => {
    const label = newMilestoneText.trim();
    if (!label) return;
    setState((prev) => ({
      ...prev,
      careerPaths: prev.careerPaths.map((p) =>
        p.id === pathId
          ? {
              ...p,
              milestones: [
                ...p.milestones,
                { id: `ms-${Date.now()}`, title: label, completed: false },
              ],
            }
          : p
      ),
    }));
    setNewMilestoneText("");
  };

  const handleUpdateOppField = <K extends keyof XelimeOpportunity>(
    oppId: string,
    field: K,
    value: XelimeOpportunity[K]
  ) => {
    setState((prev) => ({
      ...prev,
      opportunities: prev.opportunities.map((o) =>
        o.id === oppId ? { ...o, [field]: value } : o
      ),
    }));
  };

  const handleUpdateDecisionScore = (
    oppId: string,
    key: keyof XelimeOpportunity["decisionScores"],
    value: number
  ) => {
    setState((prev) => ({
      ...prev,
      opportunities: prev.opportunities.map((o) =>
        o.id === oppId
          ? {
              ...o,
              decisionScores: {
                ...o.decisionScores,
                [key]: Math.max(0, Math.min(100, value)),
              },
            }
          : o
      ),
    }));
  };

  const handleCreateOpportunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpp.jobTitle.trim() || !newOpp.company.trim()) return;
    const reqSkills = newOpp.requiredSkills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const created: XelimeOpportunity = {
      id: `opp-${Date.now()}`,
      jobTitle: newOpp.jobTitle.trim(),
      company: newOpp.company.trim(),
      careerPathId: newOpp.careerPathId,
      employmentType: newOpp.employmentType,
      workArrangement: newOpp.workArrangement,
      salary: Number(newOpp.salary) || 0,
      salaryLabel: `$${Number(newOpp.salary || 0).toLocaleString()} / yr`,
      location: newOpp.location.trim() || "Columbus, OH",
      applicationStatus: "Discovered",
      requiredSkills: reqSkills.length ? reqSkills : ["AutoCAD"],
      portfolioMatchIds: [],
      applicationUrl: newOpp.applicationUrl.trim(),
      priority: newOpp.priority,
      dateApplied: "",
      notes: newOpp.notes.trim(),
      decisionScores: {
        skillAlignment: 75,
        xelimeRelevance: 80,
        incomePotential: 75,
        workFlexibility: newOpp.workArrangement === "Remote" ? 95 : 65,
        professionalDevelopment: 80,
      },
    };

    setState((prev) => ({
      ...prev,
      opportunities: [created, ...prev.opportunities],
    }));
    setSelectedOppId(created.id);
    setShowAddOpp(false);
    setNewOpp({
      ...newOpp,
      jobTitle: "",
      company: "",
      applicationUrl: "",
      notes: "",
    });
  };

  const handleDeleteOpportunity = (oppId: string) => {
    setState((prev) => ({
      ...prev,
      opportunities: prev.opportunities.filter((o) => o.id !== oppId),
    }));
  };

  const handleUpdateSkill = <K extends keyof XelimeSkill>(
    skillId: string,
    field: K,
    value: XelimeSkill[K]
  ) => {
    setState((prev) => ({
      ...prev,
      skills: prev.skills.map((s) =>
        s.id === skillId ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleCreateSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkill.name.trim()) return;
    const created: XelimeSkill = {
      id: `sk-${Date.now()}`,
      name: newSkill.name.trim(),
      category: newSkill.category,
      status: newSkill.status,
      currentProficiency: Number(newSkill.currentProficiency),
      targetProficiency: Number(newSkill.targetProficiency),
      learningResources: newSkill.learningResources.trim() || "Self-guided project practice",
      practiceProjects: newSkill.practiceProjects.trim() || "XELIME Studio Project",
      relatedCareerPathIds: [state.careerPaths[0]?.id || "cp-cad-bim"],
    };
    setState((prev) => ({
      ...prev,
      skills: [...prev.skills, created],
    }));
    setShowAddSkill(false);
    setNewSkill({
      name: "",
      category: "Architecture",
      status: "Learning",
      currentProficiency: 40,
      targetProficiency: 85,
      learningResources: "",
      practiceProjects: "",
    });
  };

  const handleUpdateProject = <K extends keyof XelimeProject>(
    projectId: string,
    field: K,
    value: XelimeProject[K]
  ) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === projectId ? { ...p, [field]: value } : p
      ),
    }));
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    const created: XelimeProject = {
      id: `proj-${Date.now()}`,
      name: newProject.name.trim(),
      division: newProject.division,
      careerPathIds: newProject.careerPathIds.length
        ? newProject.careerPathIds
        : ["cp-cad-bim"],
      software: newProject.software
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      projectStatus: "In Progress",
      skillsDemonstrated: newProject.skillsDemonstrated
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      portfolioStatus: "Internal Draft",
      projectUrl: newProject.projectUrl.trim(),
      summary: newProject.summary.trim(),
    };
    setState((prev) => ({
      ...prev,
      projects: [created, ...prev.projects],
    }));
    setShowAddProject(false);
    setNewProject({
      name: "",
      division: "Architecture",
      careerPathIds: [state.careerPaths[0]?.id || "cp-cad-bim"],
      software: "Revit, Blender",
      skillsDemonstrated: "BIM Modeling, Lighting",
      projectUrl: "",
      summary: "",
    });
  };

  const handleCreateFreelanceDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeal.clientName.trim() || !newDeal.projectTitle.trim()) return;
    const created: XelimeFreelanceDeal = {
      id: `fl-${Date.now()}`,
      clientName: newDeal.clientName.trim(),
      projectTitle: newDeal.projectTitle.trim(),
      serviceCategory: newDeal.serviceCategory,
      stage: "Lead",
      estimateAmount: Number(newDeal.estimateAmount) || 0,
      contractSigned: false,
      deliverables: newDeal.deliverables.trim() || "Scope & deliverable schedule pending",
      invoiceStatus: "Not Billed",
      revenueCollected: 0,
      clientFeedback: "",
    };
    setState((prev) => ({
      ...prev,
      freelanceDeals: [created, ...prev.freelanceDeals],
    }));
    setShowAddFreelance(false);
    setNewDeal({
      clientName: "",
      projectTitle: "",
      serviceCategory: "CAD drafting",
      estimateAmount: 1500,
      deliverables: "",
    });
  };

  const handleUpdateDeal = <K extends keyof XelimeFreelanceDeal>(
    dealId: string,
    field: K,
    value: XelimeFreelanceDeal[K]
  ) => {
    setState((prev) => ({
      ...prev,
      freelanceDeals: prev.freelanceDeals.map((d) =>
        d.id === dealId ? { ...d, [field]: value } : d
      ),
    }));
  };

  const handleRefreshWeeklyInsights = () => {
    const topOpp = metrics.topOpportunity;
    const topGap = metrics.priorityGaps[0];
    const nextProj = state.projects.find((p) => p.portfolioStatus !== "Published");

    setState((prev) => ({
      ...prev,
      weeklyReview: {
        ...prev.weeklyReview,
        lastReviewedDate: new Date().toISOString().split("T")[0],
        topOpportunityNote: topOpp
          ? `${topOpp.opp.jobTitle} at ${topOpp.opp.company} (${topOpp.total}/100) — Status: ${topOpp.opp.applicationStatus}`
          : "No active opportunities scored yet.",
        keySkillGapNote: topGap
          ? `Focus on ${topGap.skill.name} (${topGap.skill.status}, ${topGap.skill.currentProficiency}% -> ${topGap.skill.targetProficiency}%, needed by ${topGap.demandCount} active role(s))`
          : "All tracked skills are Portfolio Ready or Professional.",
        nextPortfolioMilestone: nextProj
          ? `Advance "${nextProj.name}" (${nextProj.division}) from ${nextProj.projectStatus} to Portfolio Ready`
          : "All portfolio projects published.",
      },
    }));
  };

  const handleResetBaseline = () => {
    setState(defaultXelimeState);
    setUserStoreValue(STORAGE_KEY, JSON.stringify(defaultXelimeState));
  };

  const navItems: { id: XcmsSection; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Career Overview", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: "paths", label: "Career Paths", icon: <Compass className="w-3.5 h-3.5" /> },
    { id: "opportunities", label: "Job Opportunities", icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: "skills", label: "Skills Matrix", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "projects", label: "Portfolio Manager", icon: <FolderKanban className="w-3.5 h-3.5" /> },
    { id: "freelance", label: "Freelance & XELIME", icon: <DollarSign className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Top Workspace Header & Segmented Section Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white tracking-tight">
              XELIME Career Management System
            </h2>
            <p className="text-xs text-slate-400">
              Unified career operations across five disciplines, weighted opportunity scoring, skills matrix, portfolio proofs, and studio revenue.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetBaseline}
            className="self-start md:self-auto px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Baseline</span>
          </button>
        </div>

        {/* 6-Section Segmented Navigation */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950/70 p-1.5 rounded-lg border border-slate-800/70">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                section === item.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ======================== SECTION 1: CAREER OVERVIEW ======================== */}
      {section === "overview" && (
        <div className="space-y-6">
          {/* Primary Quantitative Snapshot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 block">Active Opportunities</span>
              <div className="text-2xl font-semibold text-white font-mono tabular-nums">
                {metrics.activeOpps.length}
              </div>
              <span className="text-[11px] text-slate-500 block">
                Avg Decision Score {metrics.avgScore}/100
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 block">Skills Ready</span>
              <div className="text-2xl font-semibold text-white font-mono tabular-nums">
                {metrics.skillsReadyCount} / {state.skills.length}
              </div>
              <span className="text-[11px] text-slate-500 block">
                Portfolio Ready or Professional
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 block">Portfolio Projects</span>
              <div className="text-2xl font-semibold text-white font-mono tabular-nums">
                {metrics.portfolioReadyCount} / {state.projects.length}
              </div>
              <span className="text-[11px] text-slate-500 block">
                Ready or Published across divisions
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-xs text-slate-400 block">Freelance Pipeline</span>
              <div className="text-2xl font-semibold text-emerald-400 font-mono tabular-nums">
                ${metrics.freelancePipeline.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500 block tabular-nums">
                Collected: ${metrics.freelanceRevenue.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Weekly Career Review & Operating Cadence */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Weekly Career Review</h3>
                  <p className="text-xs text-slate-400">
                    Last updated {state.weeklyReview.lastReviewedDate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshWeeklyInsights}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  Sync Live Insights
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">
                    Best Opportunity Focus
                  </label>
                  <input
                    type="text"
                    value={state.weeklyReview.topOpportunityNote}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        weeklyReview: {
                          ...prev.weeklyReview,
                          topOpportunityNote: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">
                    Priority Skill Gap
                  </label>
                  <input
                    type="text"
                    value={state.weeklyReview.keySkillGapNote}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        weeklyReview: {
                          ...prev.weeklyReview,
                          keySkillGapNote: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 block">
                    Next Portfolio Milestone
                  </label>
                  <input
                    type="text"
                    value={state.weeklyReview.nextPortfolioMilestone}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        weeklyReview: {
                          ...prev.weeklyReview,
                          nextPortfolioMilestone: e.target.value,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-medium text-slate-300 block">
                  Weekly Operating Cadence
                </span>
                <div className="space-y-2">
                  {state.weeklyReview.weeklyChecklist.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          weeklyReview: {
                            ...prev.weeklyReview,
                            weeklyChecklist: prev.weeklyReview.weeklyChecklist.map((c) =>
                              c.id === item.id ? { ...c, done: !c.done } : c
                            ),
                          },
                        }))
                      }
                      className="w-full flex items-center gap-2.5 text-left p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800/70 transition-colors cursor-pointer"
                    >
                      {item.done ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span
                        className={`text-xs ${
                          item.done ? "line-through text-slate-500" : "text-slate-200"
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Connected System Map & 4-Phase Rollout */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Connected System Flow</h3>
                  <p className="text-xs text-slate-400">
                    XELIME operates as the parent organization unifying all five capabilities.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSection("paths")}
                      className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <span className="font-medium text-white block">Career Paths</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {state.careerPaths.length} tracks
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("opportunities")}
                      className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <span className="font-medium text-white block">Opportunities</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {state.opportunities.length} roles
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("skills")}
                      className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <span className="font-medium text-white block">Skills Matrix</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {state.skills.length} skills
                      </span>
                    </button>
                  </div>

                  <div className="flex justify-center text-slate-600 py-0.5">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSection("projects")}
                      className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <span className="font-medium text-white block">Portfolio Manager</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {state.projects.length} multi-path projects
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection("freelance")}
                      className="p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left cursor-pointer transition-colors"
                    >
                      <span className="font-medium text-white block">Freelance & XELIME</span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {state.freelanceDeals.length} active leads
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">4-Phase Implementation</h3>
                <div className="space-y-2">
                  {state.phases.map((ph) => (
                    <button
                      key={ph.phase}
                      type="button"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          phases: prev.phases.map((item) =>
                            item.phase === ph.phase
                              ? { ...item, completed: !item.completed }
                              : item
                          ),
                        }))
                      }
                      className="w-full text-left p-3 rounded-lg bg-slate-950/70 hover:bg-slate-800/70 border border-slate-800/80 flex items-start gap-2.5 transition-colors cursor-pointer"
                    >
                      {ph.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-white">
                            Phase {ph.phase}: {ph.title}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono shrink-0">
                            {ph.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{ph.notes}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================== SECTION 2: CAREER PATHS ======================== */}
      {section === "paths" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left list of the 5 Career Paths */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Career Paths Database</h3>
              <div className="space-y-2">
                {state.careerPaths.map((cp) => {
                  const isActive = cp.id === selectedPath?.id;
                  const linkedOppsCount = state.opportunities.filter(
                    (o) => o.careerPathId === cp.id
                  ).length;
                  return (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setSelectedPathId(cp.id)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                        isActive
                          ? "bg-slate-800/90 border-blue-500 text-white"
                          : "bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="font-medium text-sm">{cp.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span>Priority: {cp.priority}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {cp.currentLevel} to {cp.targetLevel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{linkedOppsCount} roles</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Career Path Detail Page */}
          {selectedPath && (
            <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1">
                    Priority: {selectedPath.priority} · Current: {selectedPath.currentLevel} · Target: {selectedPath.targetLevel}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{selectedPath.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Salary Expectations</span>
                  <span className="text-sm font-medium text-emerald-400 font-mono tabular-nums">
                    {selectedPath.salaryExpectations}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">Required Skills</h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedPath.requiredSkills.map((item, idx) => (
                      <li key={idx} className="pb-1 border-b border-slate-800/50 last:border-0">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">Software Requirements</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedPath.softwareRequirements.join(" · ")}
                  </p>

                  <h4 className="text-xs font-semibold text-slate-300 pt-3">
                    Potential Employers
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {selectedPath.potentialEmployers.map((emp, idx) => (
                      <li key={idx}>{emp}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">
                    Portfolio Requirements
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedPath.portfolioRequirements.map((req, idx) => (
                      <li key={idx} className="pb-1 border-b border-slate-800/50 last:border-0">
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">
                    Certifications or Education
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedPath.certificationsOrEducation.map((cert, idx) => (
                      <li key={idx}>{cert}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Linked Opportunities & Portfolio Projects */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">
                    Relevant Job Opportunities
                  </h4>
                  <div className="space-y-2">
                    {state.opportunities
                      .filter((o) => o.careerPathId === selectedPath.id)
                      .map((opp) => (
                        <button
                          key={opp.id}
                          type="button"
                          onClick={() => {
                            setSelectedOppId(opp.id);
                            setSection("opportunities");
                          }}
                          className="w-full text-left p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs transition-colors cursor-pointer"
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-medium text-white">{opp.jobTitle}</span>
                            <span className="font-mono text-blue-400 tabular-nums shrink-0">
                              {computeDecisionScore(opp.decisionScores)}/100
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {opp.company} · {opp.applicationStatus}
                          </div>
                        </button>
                      ))}
                    {state.opportunities.filter((o) => o.careerPathId === selectedPath.id)
                      .length === 0 && (
                      <p className="text-xs text-slate-500">No opportunities linked yet.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">
                    Connected XELIME Projects
                  </h4>
                  <div className="space-y-2">
                    {state.projects
                      .filter((proj) => proj.careerPathIds.includes(selectedPath.id))
                      .map((proj) => (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => setSection("projects")}
                          className="w-full text-left p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs transition-colors cursor-pointer"
                        >
                          <div className="font-medium text-white">{proj.name}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {proj.division} · {proj.projectStatus} · {proj.portfolioStatus}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Development Milestones */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-slate-300">
                  Development Milestones
                </h4>
                <div className="space-y-2">
                  {selectedPath.milestones.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleToggleMilestone(selectedPath.id, m.id)}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      {m.completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span
                        className={`text-xs ${
                          m.completed ? "line-through text-slate-500" : "text-slate-200"
                        }`}
                      >
                        {m.title}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMilestoneText}
                    onChange={(e) => setNewMilestoneText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddMilestone(selectedPath.id);
                    }}
                    placeholder="Add development milestone..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddMilestone(selectedPath.id)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Add Milestone
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================== SECTION 3: OPPORTUNITIES + DECISION ENGINE ======================== */}
      {section === "opportunities" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by Application Status"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                {APPLICATION_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              <select
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                aria-label="Filter by Career Path"
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                <option value="ALL">All Career Paths</option>
                {state.careerPaths.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAddOpp((v) => !v)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Opportunity</span>
            </button>
          </div>

          {showAddOpp && (
            <form
              onSubmit={handleCreateOpportunity}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <input
                type="text"
                required
                placeholder="Job Title"
                value={newOpp.jobTitle}
                onChange={(e) => setNewOpp({ ...newOpp, jobTitle: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="text"
                required
                placeholder="Company"
                value={newOpp.company}
                onChange={(e) => setNewOpp({ ...newOpp, company: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <select
                value={newOpp.careerPathId}
                onChange={(e) => setNewOpp({ ...newOpp, careerPathId: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                {state.careerPaths.map((cp) => (
                  <option key={cp.id} value={cp.id}>
                    {cp.name}
                  </option>
                ))}
              </select>
              <select
                value={newOpp.employmentType}
                onChange={(e) =>
                  setNewOpp({
                    ...newOpp,
                    employmentType: e.target.value as XelimeOpportunity["employmentType"],
                  })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
              </select>
              <select
                value={newOpp.workArrangement}
                onChange={(e) =>
                  setNewOpp({
                    ...newOpp,
                    workArrangement: e.target.value as XelimeOpportunity["workArrangement"],
                  })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
              <input
                type="number"
                placeholder="Annual Salary ($)"
                value={newOpp.salary}
                onChange={(e) => setNewOpp({ ...newOpp, salary: Number(e.target.value) })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="text"
                placeholder="Location"
                value={newOpp.location}
                onChange={(e) => setNewOpp({ ...newOpp, location: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="text"
                placeholder="Required Skills (comma-separated)"
                value={newOpp.requiredSkills}
                onChange={(e) => setNewOpp({ ...newOpp, requiredSkills: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="url"
                placeholder="Application URL"
                value={newOpp.applicationUrl}
                onChange={(e) => setNewOpp({ ...newOpp, applicationUrl: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <div className="md:col-span-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddOpp(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Save Opportunity
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Ranked Opportunities List */}
            <div className="lg:col-span-6 space-y-3">
              {sortedFilteredOpportunities.map((opp) => {
                const weighted = computeDecisionScore(opp.decisionScores);
                const isSelected = selectedOpp?.id === opp.id;
                return (
                  <div
                    key={opp.id}
                    onClick={() => setSelectedOppId(opp.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-colors space-y-2 ${
                      isSelected
                        ? "bg-slate-800/80 border-blue-500"
                        : "bg-slate-900 border-slate-800 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-white truncate">
                          {opp.jobTitle}
                        </h4>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {opp.company} · {opp.workArrangement} · {getCareerPathName(opp.careerPathId)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-semibold text-blue-400 font-mono tabular-nums">
                          {weighted}/100
                        </div>
                        <div className="text-[11px] text-slate-500">Decision Score</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <span>
                        Status: <strong className="text-slate-200 font-medium">{opp.applicationStatus}</strong>
                      </span>
                      <span className="font-mono tabular-nums text-emerald-400">
                        {opp.salaryLabel || `$${opp.salary.toLocaleString()}`}
                      </span>
                    </div>
                  </div>
                );
              })}

              {sortedFilteredOpportunities.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
                  No opportunities match the current status or career path filters.
                </div>
              )}
            </div>

            {/* Selected Opportunity Inspector + Weighted Decision Engine */}
            {selectedOpp && (
              <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {selectedOpp.jobTitle}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedOpp.company} · {selectedOpp.location} · {selectedOpp.employmentType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteOpportunity(selectedOpp.id)}
                    aria-label="Delete opportunity"
                    className="p-2 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Status, Priority, Date Applied */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">Application Status</label>
                    <select
                      value={selectedOpp.applicationStatus}
                      onChange={(e) =>
                        handleUpdateOppField(
                          selectedOpp.id,
                          "applicationStatus",
                          e.target.value as XelimeApplicationStatus
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    >
                      {APPLICATION_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">Priority</label>
                    <select
                      value={selectedOpp.priority}
                      onChange={(e) =>
                        handleUpdateOppField(
                          selectedOpp.id,
                          "priority",
                          e.target.value as XelimeOpportunity["priority"]
                        )
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">Date Applied</label>
                    <input
                      type="date"
                      value={selectedOpp.dateApplied}
                      onChange={(e) =>
                        handleUpdateOppField(selectedOpp.id, "dateApplied", e.target.value)
                      }
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    />
                  </div>
                </div>

                {/* Career Decision Engine (Weighted 30/25/20/15/10) */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-semibold text-white">
                        Career Decision Engine
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-blue-400 font-mono tabular-nums">
                      {computeDecisionScore(selectedOpp.decisionScores)} / 100
                    </span>
                  </div>

                  {[
                    { key: "skillAlignment" as const, label: "Skill Alignment", weight: "30%" },
                    { key: "xelimeRelevance" as const, label: "XELIME Career Relevance", weight: "25%" },
                    { key: "incomePotential" as const, label: "Income Potential", weight: "20%" },
                    { key: "workFlexibility" as const, label: "Work Flexibility", weight: "15%" },
                    { key: "professionalDevelopment" as const, label: "Professional Development", weight: "10%" },
                  ].map((crit) => (
                    <div key={crit.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">
                          {crit.label} ({crit.weight})
                        </span>
                        <span className="font-mono tabular-nums text-white">
                          {selectedOpp.decisionScores[crit.key]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedOpp.decisionScores[crit.key]}
                        onChange={(e) =>
                          handleUpdateDecisionScore(
                            selectedOpp.id,
                            crit.key,
                            Number(e.target.value)
                          )
                        }
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                {/* Skills Matrix Alignment Check */}
                {(() => {
                  const check = evaluateOppSkillAlignment(selectedOpp.requiredSkills);
                  return (
                    <div className="space-y-2 text-xs border-t border-slate-800 pt-3">
                      <span className="font-semibold text-slate-300 block">
                        Skills Matrix Comparison
                      </span>
                      <div className="space-y-1">
                        <div className="text-emerald-400">
                          Ready: {check.ready.length ? check.ready.join(", ") : "None matched yet"}
                        </div>
                        {check.developing.length > 0 && (
                          <div className="text-amber-400">
                            Developing: {check.developing.join(", ")}
                          </div>
                        )}
                        {check.missing.length > 0 && (
                          <div className="text-rose-400">
                            Missing from Matrix: {check.missing.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Portfolio Match Relation */}
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <span className="text-xs font-semibold text-slate-300 block">
                    Portfolio Match (XELIME Projects)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {state.projects.map((proj) => {
                      const linked = selectedOpp.portfolioMatchIds.includes(proj.id);
                      return (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => {
                            const nextIds = linked
                              ? selectedOpp.portfolioMatchIds.filter((id) => id !== proj.id)
                              : [...selectedOpp.portfolioMatchIds, proj.id];
                            handleUpdateOppField(selectedOpp.id, "portfolioMatchIds", nextIds);
                          }}
                          className={`px-2.5 py-1.5 rounded-md text-xs border flex items-center gap-1 cursor-pointer transition-colors ${
                            linked
                              ? "bg-blue-600/20 border-blue-500 text-blue-300"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {linked && <Check className="w-3 h-3" />}
                          <span>{proj.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() =>
                      onImportToBuilder({
                        title: selectedOpp.jobTitle,
                        company: selectedOpp.company,
                        location: selectedOpp.location,
                        description: `Required Skills: ${selectedOpp.requiredSkills.join(", ")}\nCareer Path: ${getCareerPathName(selectedOpp.careerPathId)}\nArrangement: ${selectedOpp.workArrangement}\nNotes: ${selectedOpp.notes || ""}`,
                        style: selectedOpp.careerPathId.includes("cad")
                          ? "CAD Technician"
                          : "Design Assistant",
                      })
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                  >
                    Tailor Resume & Cover Letter
                  </button>

                  {selectedOpp.applicationUrl && (
                    <a
                      href={selectedOpp.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Application URL</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================== SECTION 4: XELIME SKILLS MATRIX ======================== */}
      {section === "skills" && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {["ALL", ...SKILL_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSkillCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                    skillCategoryFilter === cat
                      ? "bg-blue-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {cat === "ALL" ? "All Categories" : cat}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAddSkill((v) => !v)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Skill</span>
            </button>
          </div>

          {showAddSkill && (
            <form
              onSubmit={handleCreateSkill}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <input
                type="text"
                required
                placeholder="Skill name (e.g. Rhino 3D)"
                value={newSkill.name}
                onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <select
                value={newSkill.category}
                onChange={(e) =>
                  setNewSkill({ ...newSkill, category: e.target.value as SkillCategory })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={newSkill.status}
                onChange={(e) =>
                  setNewSkill({ ...newSkill, status: e.target.value as SkillDevStatus })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                {SKILL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Learning resources"
                value={newSkill.learningResources}
                onChange={(e) =>
                  setNewSkill({ ...newSkill, learningResources: e.target.value })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="text"
                placeholder="Practice project"
                value={newSkill.practiceProjects}
                onChange={(e) =>
                  setNewSkill({ ...newSkill, practiceProjects: e.target.value })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSkill(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Save Skill
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.skills
              .filter((s) =>
                skillCategoryFilter === "ALL" ? true : s.category === skillCategoryFilter
              )
              .map((skill) => {
                const demandOpps =
                  metrics.skillDemandMap[skill.name.toLowerCase()] || [];
                return (
                  <div
                    key={skill.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{skill.name}</h4>
                        <span className="text-xs text-slate-400">
                          {skill.category} · Required by{" "}
                          <span className="font-mono tabular-nums text-slate-200">
                            {demandOpps.length}
                          </span>{" "}
                          active job(s)
                        </span>
                      </div>

                      <select
                        value={skill.status}
                        onChange={(e) =>
                          handleUpdateSkill(
                            skill.id,
                            "status",
                            e.target.value as SkillDevStatus
                          )
                        }
                        aria-label={`${skill.name} development status`}
                        className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                      >
                        {SKILL_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Proficiency Progress</span>
                        <span className="font-mono tabular-nums text-slate-200">
                          {skill.currentProficiency}% / Target {skill.targetProficiency}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={skill.currentProficiency}
                        onChange={(e) =>
                          handleUpdateSkill(
                            skill.id,
                            "currentProficiency",
                            Number(e.target.value)
                          )
                        }
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/70">
                      <div>
                        <span className="text-slate-500">Resources:</span>{" "}
                        {skill.learningResources}
                      </div>
                      <div>
                        <span className="text-slate-500">Practice:</span>{" "}
                        {skill.practiceProjects}
                      </div>
                      <div>
                        <span className="text-slate-500">Paths:</span>{" "}
                        {skill.relatedCareerPathIds
                          .map((id) => getCareerPathName(id))
                          .join(", ")}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ======================== SECTION 5: PORTFOLIO MANAGER (XELIME PROJECTS) ======================== */}
      {section === "projects" && (
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {["ALL", ...PROJECT_DIVISIONS].map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => setProjectDivisionFilter(div)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                    projectDivisionFilter === div
                      ? "bg-blue-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {div === "ALL" ? "All Divisions" : div}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAddProject((v) => !v)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project</span>
            </button>
          </div>

          {showAddProject && (
            <form
              onSubmit={handleCreateProject}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <input
                type="text"
                required
                placeholder="Project Name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <select
                value={newProject.division}
                onChange={(e) =>
                  setNewProject({
                    ...newProject,
                    division: e.target.value as ProjectDivision,
                  })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                {PROJECT_DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Software used (comma-separated)"
                value={newProject.software}
                onChange={(e) => setNewProject({ ...newProject, software: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="text"
                placeholder="Skills demonstrated (comma-separated)"
                value={newProject.skillsDemonstrated}
                onChange={(e) =>
                  setNewProject({ ...newProject, skillsDemonstrated: e.target.value })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="url"
                placeholder="Project URL (optional)"
                value={newProject.projectUrl}
                onChange={(e) =>
                  setNewProject({ ...newProject, projectUrl: e.target.value })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 md:col-span-2"
              />
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProject(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Save Project
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {state.projects
              .filter((p) =>
                projectDivisionFilter === "ALL" ? true : p.division === projectDivisionFilter
              )
              .map((proj) => (
                <div
                  key={proj.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{proj.name}</h4>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Division: {proj.division} · Supports:{" "}
                        {proj.careerPathIds.map((id) => getCareerPathName(id)).join(", ")}
                      </div>
                    </div>
                  </div>

                  {proj.summary && (
                    <p className="text-xs text-slate-300 leading-relaxed">{proj.summary}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 block">Project Status</label>
                      <select
                        value={proj.projectStatus}
                        onChange={(e) =>
                          handleUpdateProject(
                            proj.id,
                            "projectStatus",
                            e.target.value as ProjectProgressStatus
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                      >
                        {PROJECT_PROGRESS_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 block">Portfolio Status</label>
                      <select
                        value={proj.portfolioStatus}
                        onChange={(e) =>
                          handleUpdateProject(
                            proj.id,
                            "portfolioStatus",
                            e.target.value as PortfolioPublishStatus
                          )
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                      >
                        {PORTFOLIO_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/70">
                    <div>
                      <span className="text-slate-500">Software:</span>{" "}
                      {proj.software.join(" · ")}
                    </div>
                    <div>
                      <span className="text-slate-500">Skills Demonstrated:</span>{" "}
                      {proj.skillsDemonstrated.join(", ")}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Published Project URL..."
                      value={proj.projectUrl}
                      onChange={(e) =>
                        handleUpdateProject(proj.id, "projectUrl", e.target.value)
                      }
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600"
                    />
                    {proj.projectUrl && (
                      <a
                        href={proj.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ======================== SECTION 6: FREELANCE OPERATIONS & XELIME DEVELOPMENT ======================== */}
      {section === "freelance" && (
        <div className="space-y-6">
          {/* Revenue & Service Overview */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">
                XELIME Freelance Operations
              </h3>
              <p className="text-xs text-slate-400">
                Services: {FREELANCE_SERVICES.join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <span className="text-xs text-slate-400 block">Estimate Pipeline</span>
                <span className="text-lg font-semibold text-white font-mono tabular-nums">
                  ${metrics.freelancePipeline.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Collected Revenue</span>
                <span className="text-lg font-semibold text-emerald-400 font-mono tabular-nums">
                  ${metrics.freelanceRevenue.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFreelance((v) => !v)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Client / Lead</span>
              </button>
            </div>
          </div>

          {showAddFreelance && (
            <form
              onSubmit={handleCreateFreelanceDeal}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <input
                type="text"
                required
                placeholder="Client Name"
                value={newDeal.clientName}
                onChange={(e) => setNewDeal({ ...newDeal, clientName: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="text"
                required
                placeholder="Project Title"
                value={newDeal.projectTitle}
                onChange={(e) => setNewDeal({ ...newDeal, projectTitle: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <select
                value={newDeal.serviceCategory}
                onChange={(e) =>
                  setNewDeal({
                    ...newDeal,
                    serviceCategory: e.target.value as FreelanceServiceCategory,
                  })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              >
                {FREELANCE_SERVICES.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Estimate Amount ($)"
                value={newDeal.estimateAmount}
                onChange={(e) =>
                  setNewDeal({ ...newDeal, estimateAmount: Number(e.target.value) })
                }
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
              />
              <input
                type="text"
                placeholder="Deliverables summary"
                value={newDeal.deliverables}
                onChange={(e) => setNewDeal({ ...newDeal, deliverables: e.target.value })}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 md:col-span-2"
              />
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddFreelance(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Save Lead
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {state.freelanceDeals.map((deal) => (
              <div
                key={deal.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{deal.projectTitle}</h4>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {deal.clientName} · {deal.serviceCategory}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-400 font-mono tabular-nums">
                    ${deal.estimateAmount.toLocaleString()}
                  </div>
                </div>

                <p className="text-xs text-slate-300">{deal.deliverables}</p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">Stage</label>
                    <select
                      value={deal.stage}
                      onChange={(e) =>
                        handleUpdateDeal(deal.id, "stage", e.target.value as FreelanceStage)
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    >
                      {FREELANCE_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">Invoice</label>
                    <select
                      value={deal.invoiceStatus}
                      onChange={(e) =>
                        handleUpdateDeal(
                          deal.id,
                          "invoiceStatus",
                          e.target.value as XelimeFreelanceDeal["invoiceStatus"]
                        )
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    >
                      <option value="Not Billed">Not Billed</option>
                      <option value="Sent">Sent</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">Collected ($)</label>
                    <input
                      type="number"
                      value={deal.revenueCollected}
                      onChange={(e) =>
                        handleUpdateDeal(
                          deal.id,
                          "revenueCollected",
                          Number(e.target.value)
                        )
                      }
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateDeal(deal.id, "contractSigned", !deal.contractSigned)
                    }
                    className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer"
                  >
                    {deal.contractSigned ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                    <span>Contract Signed</span>
                  </button>

                  <input
                    type="text"
                    placeholder="Client feedback..."
                    value={deal.clientFeedback}
                    onChange={(e) =>
                      handleUpdateDeal(deal.id, "clientFeedback", e.target.value)
                    }
                    className="flex-1 ml-3 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300 placeholder-slate-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
