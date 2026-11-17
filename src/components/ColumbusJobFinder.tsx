import React, { useState, useEffect, useRef } from "react";
import { UserProfile, JobScores, JobFixture, TrackerRow, WeeklyTask } from "../types";
import { initialColumbusFixtures, defaultTrackerRows, initialWeeklyTasks, initialWalkInStops } from "../data/columbusData";
import { authFetch } from "../firebase/client";
import {
  getUserStoreValue,
  setUserStoreValue,
  useUserStoreReady,
} from "../utils/userStore";
import {
  fetchLiveJobsFromAggregator,
  fetchJobSourcesStatus,
  fetchAtsBoardJobs,
  JobSourceOption,
  COLUMBUS_TARGET_KEYWORDS
} from "../utils/jobFetcher";
import ColumbusGoogleMap, { WalkInRouteStop } from "./ColumbusGoogleMap";
import AggregatorJobMap from "./AggregatorJobMap";
import { 
  Search, 
  Building2, 
  MapPin, 
  Briefcase, 
  Sparkles, 
  Plus, 
  Check, 
  Send, 
  AlertCircle, 
  RefreshCw, 
  Star, 
  Info, 
  Trash2, 
  Calendar, 
  Clipboard, 
  ListTodo, 
  Sliders, 
  LayoutGrid, 
  CheckSquare, 
  Square, 
  HelpCircle,
  Copy,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Shirt,
  Layers,
  Eye,
  Compass,
  Map,
  Filter,
  Flame,
  ShieldAlert,
  CheckCheck,
  Users,
  DollarSign,
  GitFork,
  Navigation,
  ExternalLink,
  Globe,
  Database
} from "lucide-react";

import MyTrackerTab from "./MyTrackerTab";
import PortfolioProofTab from "./PortfolioProofTab";
import CompaniesTab from "./CompaniesTab";
import MessagesTab from "./MessagesTab";
import InterviewPrepTab from "./InterviewPrepTab";
import ApplyTodayTab from "./ApplyTodayTab";
import PeopleTab from "./PeopleTab";
import BridgeIncomeTab from "./BridgeIncomeTab";
import WorkflowsTab from "./WorkflowsTab";
import { defaultProfile } from "../defaultProfile";

interface ColumbusJobFinderProps {
  onImportJob: (job: {
    title: string;
    company: string;
    location: string;
    description: string;
    style?: string;
  }) => void;
  onInstantAnalyze: (job: {
    title: string;
    company: string;
    location: string;
    description: string;
    style?: string;
  }) => void;
  currentLoadedJobTitle: string;
  userProfile?: UserProfile;
  onUpdateProfile?: (profile: UserProfile) => void;
  targetLocation?: string;
  onOpenSettings?: () => void;
  mapsKeyRefreshToken?: number;
  initialSubTab?: "jobs" | "map" | "strong" | "today" | "tracker" | "portfolio" | "companies" | "messages" | "prep" | "settings" | "people" | "bridge" | "workflows";
}

export interface TargetCompany {
  id: string;
  name: string;
  category: "Print Shop" | "Sign Shop" | "Screen Printing" | "Dispensary" | "3D Studio" | "CAD Group" | "Other";
  location: string;
  status: "Targeted" | "Contacted" | "App Applied" | "Interview Scheduled" | "Offered" | "Passed";
  contactPerson?: string;
  notes?: string;
}

const STATIC_API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  "";

/**
 * Calculates responsive, precise relative percentage coordinates for a job within the Columbus metropolitan area bounding box.
 * This maps geographic coordinates seamlessly onto a custom high-fidelity fallback grid layout.
 */
const getColumbusCoords = (lat?: number, lng?: number) => {
  // Defined bounds covering Powell, Dublin, New Albany, and German Village/Reynoldsburg metropolitans
  const minLat = 39.91;
  const maxLat = 40.15;
  const minLng = -83.14;
  const maxLng = -82.76;

  const yVal = lat ?? 39.9612;
  const xVal = lng ?? -82.9988;

  // Percentage conversion where 0 is left/top, 100 is right/bottom
  const xPct = Math.max(4, Math.min(96, ((xVal - minLng) / (maxLng - minLng)) * 100));
  const yPct = Math.max(4, Math.min(96, ((maxLat - yVal) / (maxLat - minLat)) * 100));
  return { x: `${xPct}%`, y: `${yPct}%`, xNum: xPct, yNum: yPct };
};

export default function ColumbusJobFinder({ 
  onImportJob, 
  onInstantAnalyze, 
  currentLoadedJobTitle,
  userProfile,
  onUpdateProfile,
  targetLocation = "",
  onOpenSettings,
  mapsKeyRefreshToken = 0,
  initialSubTab
}: ColumbusJobFinderProps) {
  const storeReady = useUserStoreReady();
  
  // Navigation tabs - Upgraded to 12-tab Workstation
  const [subTab, setSubTab] = useState<"jobs" | "map" | "strong" | "today" | "tracker" | "portfolio" | "companies" | "messages" | "prep" | "settings" | "people" | "bridge" | "workflows">(initialSubTab || "jobs");
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Sync initialSubTab if parent changes
  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Google Maps API Key handling (reads from env or user Settings)
  const [mapsApiKey, setMapsApiKey] = useState<string>(STATIC_API_KEY);
  const [mapsConfigLoading, setMapsConfigLoading] = useState<boolean>(!STATIC_API_KEY);
  const [useFallbackGrid, setUseFallbackGrid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!STATIC_API_KEY) {
      setMapsConfigLoading(true);
    }
    authFetch("/api/maps-config")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const nextKey = typeof data?.apiKey === "string" ? data.apiKey.trim() : "";
        if (nextKey) {
          setMapsApiKey(nextKey);
        } else if (!STATIC_API_KEY) {
          setMapsApiKey("");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMapsConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mapsKeyRefreshToken]);

  // State to track hover-over elements on the custom vector GIS map
  const [hoveredJob, setHoveredJob] = useState<JobFixture | null>(null);
  const [selectedRouteStopId, setSelectedRouteStopId] = useState<string | null>(null);

  // Energy Level state (Firestore-backed via userStore)
  const [energyLevel, setEnergyLevel] = useState<"high" | "normal" | "low" | "rest">("normal");

  // Core state fields
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("auto");
  const [availableSources, setAvailableSources] = useState<JobSourceOption[]>([]);
  const [lastSearchMeta, setLastSearchMeta] = useState<{ providersUsed: string[]; cached: boolean } | null>(null);
  const [showAtsLookup, setShowAtsLookup] = useState(false);
  const [atsProvider, setAtsProvider] = useState<"greenhouse" | "lever" | "ashby">("greenhouse");
  const [atsSlug, setAtsSlug] = useState("figma");
  const [jobs, setJobs] = useState<JobFixture[]>(initialColumbusFixtures);
  const [selectedJob, setSelectedJob] = useState<JobFixture | null>(initialColumbusFixtures[0]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    fetchJobSourcesStatus()
      .then((res) => setAvailableSources(res.sources))
      .catch(() => {});
  }, []);

  // Live aggregator search execution
  const handleLiveAggregatorSearch = async (queryTerm?: string, sourceOverride?: string) => {
    const q = (queryTerm !== undefined ? queryTerm : searchQuery).trim();
    if (!q) return;

    const activeSource = sourceOverride || selectedSource;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const result = await fetchLiveJobsFromAggregator(q, {
        source: activeSource,
        location: "Columbus, OH",
        remoteOnly: filterRemote === "remote",
      });
      if (result.jobs.length > 0) {
        setJobs(result.jobs);
        setSelectedJob(result.jobs[0]);
        setLastSearchMeta({
          providersUsed: result.meta.providersUsed,
          cached: result.meta.cached,
        });
        const srcLabel = result.meta.providersUsed.join(", ") || "Live Feed";
        setSuccessToast(
          `Loaded ${result.jobs.length} roles from ${srcLabel}${result.meta.cached ? " (cached)" : ""}.`
        );
      } else {
        const providerNote = result.meta.errors?.length ? ` (${result.meta.errors[0]})` : "";
        setSearchError(
          `No live matches returned for "${q}" from the selected feed${providerNote}. Try Auto Multi-Feed or broaden keywords.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setSearchError(err?.message || "Live aggregator service failed. Please verify and try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Auto-populate with live data on first load when starting empty.
  const autoSearchDoneRef = useRef(false);
  useEffect(() => {
    if (autoSearchDoneRef.current) return;
    autoSearchDoneRef.current = true;
    if (jobs.length > 0) return;
    handleLiveAggregatorSearch("creative production, CAD drafting, print shop, remote support");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ATS public board search execution
  const handleAtsSearch = async () => {
    const slug = atsSlug.trim();
    if (!slug) return;

    setSearchLoading(true);
    setSearchError(null);
    try {
      const result = await fetchAtsBoardJobs(atsProvider, slug, searchQuery.trim() || undefined);
      if (result.jobs.length > 0) {
        setJobs(result.jobs);
        setSelectedJob(result.jobs[0]);
        setLastSearchMeta({
          providersUsed: result.meta.providersUsed,
          cached: result.meta.cached,
        });
        setSuccessToast(`Pulled ${result.jobs.length} live roles from ${atsProvider} board "${slug}".`);
      } else {
        setSearchError(`Board "${slug}" on ${atsProvider} returned 0 matching open roles.`);
      }
    } catch (err: any) {
      console.error(err);
      setSearchError(err?.message || `Unable to reach ${atsProvider} board "${slug}".`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleResetToStaticCurated = () => {
    setJobs(initialColumbusFixtures);
    setSelectedJob(initialColumbusFixtures[0]);
    setSearchQuery("");
    setSearchError(null);
    setLastSearchMeta(null);
    setSuccessToast("Successfully restored curated baseline Columbus job list.");
  };

  // Configuration sliders
  const [jaimeMode, setJaimeMode] = useState(true);
  const [distanceVal, setDistanceVal] = useState(15);
  const [payVal, setPayVal] = useState(18);
  const [filterRemote, setFilterRemote] = useState<"all" | "onsite" | "hybrid" | "remote">("all");
  const [filterCategory, setFilterCategory] = useState<"all" | "creative" | "cad" | "tech" | "support">("all");
  const [filterThcRisk, setFilterThcRisk] = useState<"all" | "low" | "medium">("all");

  // Custom Safety Exclusions
  const [excludeCdl, setExcludeCdl] = useState(true);
  const [excludeForklift, setExcludeForklift] = useState(true);
  const [excludeGov, setExcludeGov] = useState(true);
  const [excludeSafetySensitive, setExcludeSafetySensitive] = useState(true);
  const [excludeHealthcare, setExcludeHealthcare] = useState(true);
  const [excludeCompanyVehicle, setExcludeCompanyVehicle] = useState(true);
  const [excludeHeavyWarehouse, setExcludeHeavyWarehouse] = useState(true);

  // Red Flag indicators list
  const redFlagTerms = [
    "random drug testing", 
    "dot drug screen", 
    "pre-employment drug test", 
    "safety-sensitive", 
    "commercial driver's license", 
    "cdl", 
    "heavy machinery", 
    "forklift operator", 
    "company vehicle", 
    "government contract"
  ];

  // Scoring weights configuration (reactive to sliders)
  const [calcScores, setCalcScores] = useState<JobScores>({
    money: 3,
    creative: 4,
    thcRisk: 4,
    stress: 3,
    skill: 3,
    future: 3
  });

  // Keep state updated on selection change
  useEffect(() => {
    if (selectedJob) {
      setCalcScores({ ...selectedJob.scores });
      // Clear temp notifications
      setSuccessToast(null);
    }
  }, [selectedJob]);

  // Job Tracker State (Firestore-backed via userStore)
  const [trackerRows, setTrackerRows] = useState<TrackerRow[]>(defaultTrackerRows);

  // Map Mode and Drop-by Router States
  const [mapMode, setMapMode] = useState<"gis" | "router">("gis");
  const [routeChecks, setRouteChecks] = useState<Record<string, boolean>>({});

  const toggleRouteCheck = (key: string) => {
    const updated = { ...routeChecks, [key]: !routeChecks[key] };
    setRouteChecks(updated);
    setUserStoreValue("jaime_route_checks", JSON.stringify(updated));
  };

  // Company Targets state (Firestore-backed via userStore)
  const [companyTargets, setCompanyTargets] = useState<TargetCompany[]>([]);

  // Daily Missions targets state (Firestore-backed via userStore)
  const [dailyMissions, setDailyMissions] = useState<{ id: string; label: string; completed: boolean }[]>([
      { id: "dm-1", label: "Browse Columbus Print / Graphics tags and find 3 target studios", completed: false },
      { id: "dm-2", label: "Perform pre-press resume alignment on active target lead", completed: false },
      { id: "dm-3", label: "Identify hiring recruiter name for selected creative vacancy", completed: false },
      { id: "dm-4", label: "Customize overall sliders and bypass safety CDL hazards", completed: false },
      { id: "dm-5", label: "Submit at least 1 warm vector portfolio deck directly", completed: false }
    ]
  );

  // Portfolio Built state for Hard Proof Gates (Firestore-backed via userStore)
  const [builtPortfolioFiles, setBuiltPortfolioFiles] = useState<string[]>(["jaime_apparel_vector_kit.pdf"]);

  // Hydrate all previously-localStorage-backed state from Firestore
  useEffect(() => {
    if (!storeReady) return;
    const energy = getUserStoreValue("jaime_energy_level");
    if (energy) {
      try {
        const parsed = JSON.parse(energy);
        if (["high", "normal", "low", "rest"].includes(parsed)) setEnergyLevel(parsed);
      } catch {
        if (["high", "normal", "low", "rest"].includes(energy)) {
          setEnergyLevel(energy as "high" | "normal" | "low" | "rest");
        }
      }
    }
    const loadJson = <T,>(key: string, fallback: T): T => {
      const raw = getUserStoreValue(key);
      if (!raw) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return (parsed ?? fallback) as T;
      } catch {
        return fallback;
      }
    };
    setTrackerRows(loadJson<TrackerRow[]>("jaime_job_tracker", defaultTrackerRows));
    setRouteChecks(loadJson<Record<string, boolean>>("jaime_route_checks", {}));
    const targets = loadJson<TargetCompany[]>("jaime_company_targets", []);
    if (targets.length > 0) setCompanyTargets(targets);
    const missions = loadJson<{ id: string; label: string; completed: boolean }[]>("jaime_daily_missions", []);
    if (missions.length > 0) setDailyMissions(missions);
    const built = loadJson<string[]>("jaime_built_portfolios", []);
    if (built.length > 0) setBuiltPortfolioFiles(built);
  }, [storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_energy_level", JSON.stringify(energyLevel));
  }, [energyLevel, storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_job_tracker", JSON.stringify(trackerRows));
  }, [trackerRows, storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_company_targets", JSON.stringify(companyTargets));
  }, [companyTargets, storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_daily_missions", JSON.stringify(dailyMissions));
  }, [dailyMissions, storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_built_portfolios", JSON.stringify(builtPortfolioFiles));
  }, [builtPortfolioFiles, storeReady]);

  const togglePortfolioBuilt = (filename: string) => {
    setBuiltPortfolioFiles(prev => 
      prev.includes(filename) 
        ? prev.filter(f => f !== filename) 
        : [...prev, filename]
    );
  };

  // Feedback notifications
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [inlineRecruiterInput, setInlineRecruiterInput] = useState("");

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Distance helper
  const getJobDistance = (job: JobFixture) => {
    if (job.remoteType === "remote") return 0;
    const lat = job.latitude ?? 39.9612;
    const lng = job.longitude ?? -82.9988;
    const dLat = (lat - 39.9612) * 69;
    const dLng = (lng - (-82.9988)) * 53;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  };

  // Pay parser
  const getJobHourlyPay = (job: JobFixture) => {
    const salaryStr = job.salary.toLowerCase().replace(/[\$,]/g, "");
    if (salaryStr.includes("year")) {
      const match = salaryStr.match(/(\d+)/);
      if (match) return parseInt(match[1]) / 2000;
    } else {
      const match = salaryStr.match(/(\d+)/);
      if (match) return parseFloat(match[1]);
    }
    return 18;
  };

  // Core metrics solver
  const getSkillGaps = (jobSkills: string[]) => {
    const profileSkills = userProfile?.skills || ["Drafting", "Civil CAD", "AutoCAD", "SketchUp", "Photoshop", "Illustrator"];
    const profileLower = profileSkills.map(s => s.toLowerCase());
    const gaps = jobSkills.filter(s => !profileLower.includes(s.toLowerCase()));

    const mapGapToResource = (skill: string) => {
      const s = skill.toLowerCase();
      if (s.includes("blender") || s.includes("3d")) return { resource: "Blender Guru's Donut Series (YT)", url: "https://www.youtube.com/@blenderguru" };
      if (s.includes("large format") || s.includes("vinyl")) return { resource: "Avery Dennison Vinyl Wrap guides", url: "https://graphics.averydennison.com" };
      if (s.includes("screen print") || s.includes("mesh")) return { resource: "Ryonet Screen Printing Core 101", url: "https://www.screenprinting.com" };
      if (s.includes("cannabis") || s.includes("pos")) return { resource: "Flowhub Retail Dispensary Compliance", url: "https://flowhub.com" };
      return { resource: "Adobe Pen Tool vector path course", url: "https://helpx.adobe.com" };
    };

    return gaps.map(g => ({ skill: g, ...mapGapToResource(g) }));
  };

  const getRiskWarnings = (desc: string, titleStr: string) => {
    const text = `${titleStr} ${desc}`.toLowerCase();
    return redFlagTerms.filter(term => text.includes(term));
  };

  const getApplyReadiness = (job: JobFixture) => {
    let score = 0;
    const checklist: { label: string; met: boolean; value: number }[] = [];
    
    const rating = job.computedTotal ?? (job.scores.money + job.scores.creative + job.scores.thcRisk + job.scores.stress + job.scores.skill + job.scores.future);
    const scoreMet = rating >= 25;
    checklist.push({ label: `Fit score is Strong (${rating}/30)`, met: scoreMet, value: 3 });
    if (scoreMet) score += 3;
    else if (rating >= 18) score += 1;
    
    const thcRiskScore = job.scores.thcRisk;
    const thcSafe = thcRiskScore >= 4;
    checklist.push({ label: "Low cannabis testing/CDL screening risk", met: thcSafe, value: 2 });
    if (thcSafe) score += 2;
    
    const dist = getJobDistance(job);
    const proximityMet = job.remoteType === "remote" || dist <= 15;
    checklist.push({ label: "Commute proximity within 15 miles", met: proximityMet, value: 1 });
    if (proximityMet) score += 1;
    
    const row = trackerRows.find(r => r.jobTitle.toLowerCase() === job.title.toLowerCase() && r.companyName.toLowerCase() === job.company.toLowerCase());
    
    const hasResume = !!(row?.resumeVersion);
    checklist.push({ label: "Resume style mapped & customized", met: hasResume, value: 1 });
    if (hasResume) score += 1;
    
    const hasPortfolio = !!(row?.portfolioPiece);
    checklist.push({ label: "Design portfolio pieces prepared", met: hasPortfolio, value: 1 });
    if (hasPortfolio) score += 1;

    const hasContact = !!(row?.contactName);
    checklist.push({ label: "Identified Recruiter contact name", met: hasContact, value: 1 });
    if (hasContact) score += 1;

    const hasNotesMessage = !!(row?.notes && row.notes.length > 50 && row.notes !== "Scored from Columbus Job Finder Panel.");
    checklist.push({ label: "Outreach cover text completed", met: hasNotesMessage, value: 1 });
    if (hasNotesMessage) score += 1;

    return { score, max: 10, checklist };
  };

  // Interactive Action commands
  const handleActionSelectResume = () => {
    if (!selectedJob) return;
    const rowIdx = trackerRows.findIndex(r => r.jobTitle.toLowerCase() === selectedJob.title.toLowerCase() && r.companyName.toLowerCase() === selectedJob.company.toLowerCase());

    const title = selectedJob.title.toLowerCase();
    let styleText = "Creative Production Resume";
    if (title.includes("dispensary") || title.includes("retail") || title.includes("budtender")) styleText = "Customer Operations Resume";
    else if (title.includes("3d") || title.includes("blender") || title.includes("render")) styleText = "3D Visualization Resume";
    else if (title.includes("cad") || title.includes("exhibit") || title.includes("draft")) styleText = "CAD-Adjacent Design Resume";

    if (rowIdx >= 0) {
      const updated = [...trackerRows];
      updated[rowIdx].resumeVersion = styleText;
      setTrackerRows(updated);
    } else {
      const newRow: TrackerRow = {
        id: `track-${Date.now()}`,
        companyName: selectedJob.company,
        jobTitle: selectedJob.title,
        lane: selectedJob.lane.split(" — ")[0],
        pay: selectedJob.salary,
        thcRisk: selectedJob.scores.thcRisk >= 4 ? "Low" : "High",
        score: selectedJob.computedTotal || 24,
        applied: false,
        followUpDate: "—",
        notes: "Scored from Columbus Job Finder Panel.",
        resumeVersion: styleText
      };
      setTrackerRows([newRow, ...trackerRows]);
    }
    setSuccessToast(`Customized: mapped "${styleText}" format to tracker row!`);
  };

  const handleActionPreparePortfolio = () => {
    if (!selectedJob) return;
    const rowIdx = trackerRows.findIndex(r => r.jobTitle.toLowerCase() === selectedJob.title.toLowerCase() && r.companyName.toLowerCase() === selectedJob.company.toLowerCase());

    const title = selectedJob.title.toLowerCase();
    let fileMatched = "jaime_apparel_vector_kit.pdf";
    if (title.includes("cad") || title.includes("architectural") || title.includes("draft")) fileMatched = "columbus_spatial_render_v4.dwg";
    else if (title.includes("3d") || title.includes("blender") || title.includes("render")) fileMatched = "osiris_garment_simulation_3d.zip";
    else if (title.includes("dispensary") || title.includes("budtender") || title.includes("retail")) fileMatched = "ops_cash_reconciled_flows.pdf";

    if (rowIdx >= 0) {
      const updated = [...trackerRows];
      updated[rowIdx].portfolioPiece = fileMatched;
      setTrackerRows(updated);
    } else {
      const newRow: TrackerRow = {
        id: `track-${Date.now()}`,
        companyName: selectedJob.company,
        jobTitle: selectedJob.title,
        lane: selectedJob.lane.split(" — ")[0],
        pay: selectedJob.salary,
        thcRisk: selectedJob.scores.thcRisk >= 4 ? "Low" : "High",
        score: selectedJob.computedTotal || 24,
        applied: false,
        followUpDate: "—",
        notes: "Scored from Columbus Job Finder Panel.",
        portfolioPiece: fileMatched
      };
      setTrackerRows([newRow, ...trackerRows]);
    }
    setSuccessToast(`Mapped Portfolio Asset: Loaded "${fileMatched}" to target lead!`);
  };

  const handleActionSaveRecruiterInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !inlineRecruiterInput) return;
    const rowIdx = trackerRows.findIndex(r => r.jobTitle.toLowerCase() === selectedJob.title.toLowerCase() && r.companyName.toLowerCase() === selectedJob.company.toLowerCase());

    if (rowIdx >= 0) {
      const updated = [...trackerRows];
      updated[rowIdx].contactName = inlineRecruiterInput;
      setTrackerRows(updated);
    } else {
      const newRow: TrackerRow = {
        id: `track-${Date.now()}`,
        companyName: selectedJob.company,
        jobTitle: selectedJob.title,
        lane: selectedJob.lane.split(" — ")[0],
        pay: selectedJob.salary,
        thcRisk: selectedJob.scores.thcRisk >= 4 ? "Low" : "High",
        score: selectedJob.computedTotal || 24,
        applied: false,
        followUpDate: "—",
        notes: "Scored from Columbus Job Finder Panel.",
        contactName: inlineRecruiterInput
      };
      setTrackerRows([newRow, ...trackerRows]);
    }
    setSuccessToast(`Contact Saved: Added recruiter "${inlineRecruiterInput}"!`);
    setInlineRecruiterInput("");
  };

  const handleActionToggleApplied = () => {
    if (!selectedJob) return;
    const rowIdx = trackerRows.findIndex(r => r.jobTitle.toLowerCase() === selectedJob.title.toLowerCase() && r.companyName.toLowerCase() === selectedJob.company.toLowerCase());

    if (rowIdx >= 0) {
      const updated = [...trackerRows];
      const nextVal = !updated[rowIdx].applied;
      updated[rowIdx].applied = nextVal;
      updated[rowIdx].followUpDate = nextVal ? "Friday Check-in" : "—";
      setTrackerRows(updated);
      setSuccessToast(nextVal ? "Background Action: Checked row and scheduled review on Friday!" : "Checked pending status.");
    } else {
      const newRow: TrackerRow = {
        id: `track-${Date.now()}`,
        companyName: selectedJob.company,
        jobTitle: selectedJob.title,
        lane: selectedJob.lane.split(" — ")[0],
        pay: selectedJob.salary,
        thcRisk: selectedJob.scores.thcRisk >= 4 ? "Low" : "High",
        score: selectedJob.computedTotal || 24,
        applied: true,
        followUpDate: "Friday Check-in",
        notes: "Quick Applied from Action Deck."
      };
      setTrackerRows([newRow, ...trackerRows]);
      setSuccessToast("Background Action: Placed into tracker pipeline, applied state set!");
    }
  };

  const handleActionOutreachRedirect = () => {
    if (!selectedJob) return;
    // Prepare notes message block inside tracker row if empty to check cover spec
    const rowIdx = trackerRows.findIndex(r => r.jobTitle.toLowerCase() === selectedJob.title.toLowerCase() && r.companyName.toLowerCase() === selectedJob.company.toLowerCase());
    const customizedNotesText = `Outreach letter finalized. Prepared physical vector registrations sample sheets for ${selectedJob.company} hiring coordinators. Safe of pre-employment CDL screening drug risk.`;
    if (rowIdx >= 0) {
      const updated = [...trackerRows];
      updated[rowIdx].notes = customizedNotesText;
      setTrackerRows(updated);
    } else {
      const newRow: TrackerRow = {
        id: `track-${Date.now()}`,
        companyName: selectedJob.company,
        jobTitle: selectedJob.title,
        lane: selectedJob.lane.split(" — ")[0],
        pay: selectedJob.salary,
        thcRisk: selectedJob.scores.thcRisk >= 4 ? "Low" : "High",
        score: selectedJob.computedTotal || 24,
        applied: false,
        followUpDate: "—",
        notes: customizedNotesText
      };
      setTrackerRows([newRow, ...trackerRows]);
    }
    setSubTab("messages");
  };

  // State mutators for corporate targets
  const handleAddCompany = (co: Omit<TargetCompany, "id">) => {
    const newComp: TargetCompany = { ...co, id: `comp-custom-${Date.now()}` };
    setCompanyTargets([newComp, ...companyTargets]);
  };

  const handleUpdateCompanyStatus = (id: string, status: TargetCompany["status"]) => {
    setCompanyTargets(companyTargets.map(c => c.id === id ? { ...c, status } : c));
  };

  const handleDeleteCompany = (id: string) => {
    setCompanyTargets(companyTargets.filter(c => c.id !== id));
  };

  const handleToggleMission = (id: string) => {
    setDailyMissions(dailyMissions.map(m => m.id === id ? { ...m, completed: !m.completed } : m));
  };

  // Tracker row mutations
  const toggleTrackerRowApplied = (id: string) => {
    setTrackerRows(trackerRows.map(row => {
      if (row.id === id) {
        const nextApplied = !row.applied;
        return { ...row, applied: nextApplied, followUpDate: nextApplied ? "Friday check" : "—" };
      }
      return row;
    }));
  };

  const deleteTrackerRow = (id: string) => {
    setTrackerRows(trackerRows.filter(row => row.id !== id));
  };

  const updateTrackerRow = (id: string, updatedFields: Partial<TrackerRow>) => {
    setTrackerRows(prev => prev.map(row => row.id === id ? { ...row, ...updatedFields } : row));
  };

  // Live query logic with boosts
  const getScoredAndFilteredJobs = () => {
    return jobs.map(job => {
      let scoreObj = { ...job.scores };
      const title = job.title.toLowerCase();
      const desc = job.description.toLowerCase();
      const skillsStr = job.skills.map(s => s.toLowerCase()).join(" ");

      if (jaimeMode) {
        if (title.includes("print") || title.includes("sign") || title.includes("apparel") || desc.includes("screen print") || desc.includes("embroidery")) {
          scoreObj.creative = Math.min(5, scoreObj.creative + 2);
          scoreObj.future = Math.min(5, scoreObj.future + 2);
        }
        if (title.includes("cad") || title.includes("draft") || title.includes("blender")) {
          scoreObj.skill = Math.min(5, scoreObj.skill + 2);
          scoreObj.future = Math.min(5, scoreObj.future + 1);
        }
        const hasRiskWord = title.includes("cdl") || desc.includes("drug test") || desc.includes("safety sensitive") || title.includes("driver") || desc.includes("forklift");
        if (hasRiskWord) {
          scoreObj.thcRisk = Math.max(1, scoreObj.thcRisk - 3);
          scoreObj.stress = Math.max(1, scoreObj.stress - 2);
        }
      }

      const total = scoreObj.money + scoreObj.creative + scoreObj.thcRisk + scoreObj.stress + scoreObj.skill + scoreObj.future;
      return { ...job, computedScores: scoreObj, computedTotal: total };
    }).filter(j => {
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchesQuery = j.title.toLowerCase().includes(query) || j.company.toLowerCase().includes(query) || j.description.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }
      if (j.remoteType !== "remote" && getJobDistance(j) > distanceVal) return false;
      if (getJobHourlyPay(j) < payVal) return false;

      // Exclusions
      const descLower = j.description.toLowerCase();
      const titleLower = j.title.toLowerCase();
      if (excludeCdl && (descLower.includes("cdl") || titleLower.includes("cdl"))) return false;
      if (excludeForklift && descLower.includes("forklift")) return false;
      if (excludeGov && (descLower.includes("government") || descLower.includes("federal"))) return false;
      if (excludeSafetySensitive && descLower.includes("safety-sensitive")) return false;
      if (excludeHeavyWarehouse && (descLower.includes("warehouse") || descLower.includes("heavy lifting"))) return false;

      return true;
    }).sort((a, b) => b.computedTotal - a.computedTotal);
  };

  const filteredJobs = getScoredAndFilteredJobs();

  // Unified Double Grid render check
  const showDoubleGridSplit = subTab === "jobs" || subTab === "strong" || subTab === "today";
  const displayedListInSplit = subTab === "strong" ? filteredJobs.filter(j => j.computedTotal >= 25) : filteredJobs;

  return (
    <div className="space-y-6 font-sans text-left text-slate-200 min-w-0">

      {/* Job Locations Map in the Orange Area (below main tab row) */}
      {subTab !== "map" && (
        <AggregatorJobMap
          apiKey={mapsApiKey}
          apiKeyLoading={mapsConfigLoading}
          jobs={jobs}
          targetLocation={targetLocation}
          selectedJob={selectedJob}
          onSelectJob={(j) => setSelectedJob(j)}
          onImportJob={(j) => onImportJob(j)}
          onOpenSettings={onOpenSettings}
        />
      )}
      
      {/* Simplified Brand Header - Flat, Beautiful and Minimal */}
      <div className="bg-slate-900/60 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-slate-100 tracking-tight flex items-center gap-2">
            Jaime Hernandez — Columbus Job Dashboard
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-2xl">
            Pre-press layout matching, AutoCAD drafting transition, and 3D mockups. Match qualified local vacancies, track application progress, and optimize follow-up outreach.
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs bg-slate-955 border border-slate-800 py-1.5 px-3 rounded-lg z-10 text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-rose-500/80" />
          <div>
            <span className="block text-[9px] text-slate-500 leading-none">Metro area</span>
            <span className="font-semibold text-slate-350">Columbus, OH Metro</span>
          </div>
        </div>
      </div>

      {/* Clean, Non-dense Nav Tab Controls - Collapsed secondary features under "More Tools" */}
      <div className="bg-slate-900/40 p-2.5 rounded-xl space-y-2">
        <div className="text-xs font-medium text-slate-400 pl-1 flex items-center justify-between font-mono">
          <span>Career Workstation Channels</span>
          <span className="text-blue-400 font-medium text-[11px] hidden sm:inline">Active telemetry calibration</span>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-1 font-sans">
          <button
            onClick={() => { setSubTab("jobs"); setIsMoreOpen(false); }}
            className={`px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === "jobs" ? "bg-blue-600 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-blue-400/85" />
            <span>Live Jobs</span>
          </button>

          <button
            onClick={() => { setSubTab("map"); setIsMoreOpen(false); }}
            className={`px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === "map" ? "bg-blue-600 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Map className="w-3.5 h-3.5 text-rose-450" />
            <span>Map & Routes</span>
          </button>

          <button
            onClick={() => { setSubTab("strong"); setIsMoreOpen(false); }}
            className={`px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === "strong" ? "bg-blue-600 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-500/85" />
            <span>Strong Leads</span>
          </button>

          <button
            onClick={() => { setSubTab("today"); setIsMoreOpen(false); }}
            className={`px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === "today" ? "bg-emerald-600 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-805"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Apply Today</span>
          </button>

          <button
            onClick={() => { setSubTab("tracker"); setIsMoreOpen(false); }}
            className={`px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === "tracker" ? "bg-blue-600 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <ListTodo className="w-3.5 h-3.5 text-sky-400" />
            <span>Tracker ({trackerRows.length})</span>
          </button>

          <button
            onClick={() => { setSubTab("portfolio"); setIsMoreOpen(false); }}
            className={`px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
              subTab === "portfolio" ? "bg-blue-600 text-white shadow-sm font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Portfolio Proof</span>
          </button>

          {/* Collapsible Secondary Tools Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`w-full px-3 py-2 text-xs rounded-lg transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                [ "companies", "people", "bridge", "messages", "prep", "settings", "workflows" ].includes(subTab)
                  ? "bg-blue-650 text-white shadow-md font-semibold animate-pulse border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  {subTab === "companies" ? `Companies (${companyTargets.length})` :
                   subTab === "people" ? "People CRM" :
                   subTab === "bridge" ? "Bridge Income" :
                   subTab === "messages" ? "Messages" :
                   subTab === "prep" ? "Interview Prep" :
                   subTab === "settings" ? "Settings" :
                   subTab === "workflows" ? "Campaign Workflows" :
                   "More Tools"}
                </span>
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isMoreOpen && (
              <>
                <div 
                  className="fixed inset-0 z-30" 
                  onClick={() => setIsMoreOpen(false)} 
                />
                <div className="absolute right-0 mt-1.5 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-40 p-1 divide-y divide-slate-850">
                  <div className="p-1 px-1.5 text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Secondary Tools
                  </div>
                  <div className="py-1 space-y-0.5">
                    <button
                      onClick={() => { setSubTab("companies"); setIsMoreOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        subTab === "companies" ? "bg-slate-800 text-blue-450 font-semibold" : "text-slate-450 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Companies ({companyTargets.length})</span>
                    </button>

                    <button
                      onClick={() => { setSubTab("people"); setIsMoreOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        subTab === "people" ? "bg-slate-800 text-blue-450 font-semibold" : "text-slate-450 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-orange-400" />
                      <span>People CRM</span>
                    </button>

                    <button
                      onClick={() => { setSubTab("bridge"); setIsMoreOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        subTab === "bridge" ? "bg-slate-800 text-blue-450 font-semibold" : "text-slate-450 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5 text-emerald-450" />
                      <span>Bridge Income</span>
                    </button>

                    <button
                      onClick={() => { setSubTab("messages"); setIsMoreOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        subTab === "messages" ? "bg-slate-800 text-blue-450 font-semibold" : "text-slate-450 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <Send className="w-3.5 h-3.5 text-blue-405" />
                      <span>Messages</span>
                    </button>

                    <button
                      onClick={() => { setSubTab("workflows"); setIsMoreOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        subTab === "workflows" ? "bg-slate-800 text-blue-455 font-semibold" : "text-slate-455 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <GitFork className="w-3.5 h-3.5 text-blue-450 animate-[pulse_3s_ease-in-out_infinite]" />
                      <span>Campaign Workflows</span>
                    </button>

                    <button
                      onClick={() => { setSubTab("prep"); setIsMoreOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        subTab === "prep" ? "bg-slate-800 text-blue-450 font-semibold" : "text-slate-450 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                      <span>Interview Prep</span>
                    </button>

                    <button
                      onClick={() => { setSubTab("settings"); setIsMoreOpen(false); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                        subTab === "settings" ? "bg-slate-800 text-blue-455 font-semibold" : "text-slate-455 hover:text-slate-200 hover:bg-slate-800/40"
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>Settings</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SPLIT-SCREEN WORKSTATION FOR TABS 1, 3, AND 4 */}
      {showDoubleGridSplit && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* LEFT PANEL: LISTING WORKSPACE (Col-Span 8) */}
          <div className="md:col-span-7 lg:col-span-8 space-y-4">
            
            {/* If tab 1 or 3: Live lists */}
            {(subTab === "jobs" || subTab === "strong") && (
              <div className="bg-slate-900/60 p-5 rounded-xl space-y-5 shadow-sm">
                
                {/* Search inputs & Aggregator action command */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-350 tracking-wide flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span>Live Job Search Aggregator (Columbus, OH & Remote)</span>
                      {lastSearchMeta && (
                        <span className="text-[9.5px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
                          {lastSearchMeta.providersUsed.join(" + ")}{lastSearchMeta.cached ? " (Cached)" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAtsLookup((v) => !v)}
                        className="text-[10px] text-slate-300 hover:text-white font-mono flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Database className="w-2.5 h-2.5 text-indigo-400" />
                        {showAtsLookup ? "Hide ATS Board" : "ATS Board Lookup"}
                      </button>
                      <button
                        onClick={handleResetToStaticCurated}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> Restore Curated Baseline
                      </button>
                    </div>
                  </div>

                  {/* API Source Selector + Search Input */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative sm:w-52 shrink-0">
                      <Globe className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-blue-400 pointer-events-none" />
                      <select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value)}
                        aria-label="Job API Source"
                        className="w-full pl-8 pr-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/60 font-sans cursor-pointer"
                      >
                        {availableSources.length > 0 ? (
                          availableSources.map((src) => (
                            <option
                              key={src.id}
                              value={src.id}
                              disabled={src.requiresKey && !src.configured}
                            >
                              {src.name} {src.requiresKey && !src.configured ? "(Key in Secrets)" : ""}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="auto">Auto Multi-Feed</option>
                            <option value="remotive">Remotive (Free)</option>
                            <option value="jobicy">Jobicy (Free)</option>
                            <option value="himalayas">Himalayas (Free)</option>
                            <option value="arbeitnow">Arbeitnow (Free)</option>
                            <option value="ai_scan">AI Market Scan</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search live jobs (e.g. graphic design, autocad, support, 3d)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleLiveAggregatorSearch();
                          }
                        }}
                        className="w-full pl-9 pr-4 py-2 bg-slate-950/45 border border-slate-850/50 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-slate-500 font-sans transition-all"
                      />
                    </div>
                    <button
                      onClick={() => handleLiveAggregatorSearch()}
                      disabled={searchLoading || !searchQuery.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-medium tracking-wide transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      {searchLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Searching...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                          <span>Search Live</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Optional Direct ATS Public Career Board Lookup (Greenhouse / Lever / Ashby) */}
                  {showAtsLookup && (
                    <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="uppercase tracking-wider font-bold text-indigo-400">
                          Direct Company ATS Board (No Auth Required)
                        </span>
                        <span>Pulls live roles from Greenhouse, Lever, or Ashby</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={atsProvider}
                          onChange={(e) => setAtsProvider(e.target.value as "greenhouse" | "lever" | "ashby")}
                          className="sm:w-36 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-[11px] text-slate-200 font-sans"
                        >
                          <option value="greenhouse">Greenhouse</option>
                          <option value="lever">Lever</option>
                          <option value="ashby">Ashby</option>
                        </select>
                        <input
                          type="text"
                          value={atsSlug}
                          onChange={(e) => setAtsSlug(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAtsSearch();
                          }}
                          placeholder="Company board slug (e.g. figma, vercel, discord, gitlab)"
                          className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-[11px] text-slate-200 placeholder-slate-500 font-sans focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                        />
                        <button
                          type="button"
                          onClick={handleAtsSearch}
                          disabled={searchLoading || !atsSlug.trim()}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-md text-[11px] font-medium cursor-pointer shrink-0"
                        >
                          Fetch ATS Board
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick-select target lanes */}
                    <div className="space-y-1.5 font-sans">
                    <span className="block text-[9.5px] uppercase font-bold font-mono tracking-wider text-slate-500">
                      Quick Target Lanes (Scan Live Feeds)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {COLUMBUS_TARGET_KEYWORDS.map((k, ind) => (
                        <button
                          key={ind}
                          disabled={searchLoading}
                          onClick={() => {
                            setSearchQuery(k.query);
                            handleLiveAggregatorSearch(k.query);
                          }}
                          className="px-2.5 py-1.5 bg-slate-950/45 hover:bg-slate-800/80 border border-slate-850/40 hover:border-slate-700 text-[10.5px] rounded-lg text-slate-350 hover:text-slate-100 transition-all font-sans cursor-pointer whitespace-nowrap"
                        >
                          {k.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Loading indicator bar */}
                {searchLoading && (
                  <div className="relative p-12 text-center text-slate-400 italic font-mono bg-slate-950/30 rounded-xl space-y-3.5 flex flex-col items-center justify-center border border-slate-850/10">
                    <RefreshCw className="w-8 h-8 text-blue-550 animate-spin" />
                    <div className="space-y-1">
                      <span className="block text-slate-250 font-bold text-xs uppercase tracking-widest animate-pulse">Contacting Columbus Jobs Feed...</span>
                      <p className="text-[10px] text-slate-500 font-sans">Scanning live regional listings, parsing roles, and assessing cannabis & CDL screening thresholds.</p>
                    </div>
                  </div>
                )}

                {/* Search Error warning */}
                {searchError && (
                  <div className="p-4 bg-orange-950/20 border border-orange-900/30 text-orange-400 text-xs rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-orange-300">Live Search Warning</span>
                      <p className="text-slate-400 text-[10.5px] leading-relaxed mt-0.5">
                        {searchError} If problem persists, use <strong>Restore Baseline</strong> to resume instant curated lanes.
                      </p>
                    </div>
                  </div>
                )}
 
                {/* Subtab list container */}
                <div className="space-y-3">
                  {displayedListInSplit.map((job) => {
                    const isSelected = selectedJob?.id === job.id;
                    const readiness = getApplyReadiness(job);
                    const isActiveLoaded = currentLoadedJobTitle === job.title;
                    
                    return (
                      <div
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`p-5 rounded-xl border cursor-pointer transition-all flex flex-col gap-3 relative group ${
                          isSelected 
                            ? "bg-slate-850/90 border-blue-600 shadow-lg" 
                            : "bg-slate-900 border-slate-850 hover:bg-slate-850/30 hover:border-slate-800"
                        }`}
                      >
                        {isActiveLoaded && (
                          <span className="absolute top-4 right-28 bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[8.5px] uppercase font-mono px-2 py-0.5 rounded font-bold tracking-wider animate-pulse">
                            Loaded In Desk
                          </span>
                        )}

                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-350">{job.company}</span>
                              <span className="text-[8.5px] uppercase font-mono px-2 py-0.5 rounded bg-blue-955/50 border border-blue-900/30 text-blue-400">
                                {job.lane.split(" — ")[0]}
                              </span>
                              {job.source && (
                                <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                                  {job.source}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-white tracking-wide group-hover:text-blue-400 transition-colors">
                              {job.title}
                            </h3>
                          </div>
                          
                          {/* Fit score badge */}
                          <div className="bg-slate-950/60 py-1.5 px-3 rounded-lg border border-slate-850 text-center min-w-[55px] text-slate-400 select-none">
                            <span className="block text-[8px] text-slate-500 uppercase font-mono tracking-wider">Fit Score</span>
                            <span className="text-indigo-300 font-bold font-mono">{job.computedTotal} pts</span>
                          </div>
                        </div>

                        {/* Dedicated Single-Line Metadata Layout */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-slate-400 pb-2.5 border-b border-slate-850/50">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-rose-450 shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{job.salary}</span>
                          </div>
                          
                          {/* Inline Readiness Meter */}
                          <div className="flex items-center gap-2 sm:col-span-2 mt-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-slate-300">App Readiness:</span>
                            <span className="font-bold text-slate-205">{readiness.score}/10</span>
                            <div className="flex-1 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850 max-w-xs relative">
                              <div className="bg-emerald-500 h-full transition-all duration-300 shadow-[0_0_8px_#10b981]" style={{ width: `${readiness.score * 10}%` }} />
                            </div>
                          </div>
                        </div>

                        {/* Interactive quick action buttons inside card */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 font-sans">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onImportJob(job);
                            }}
                            className="px-3 py-1.5 font-bold text-[10.5px] rounded-md transition-all cursor-pointer flex items-center gap-1 shadow bg-blue-600 hover:bg-blue-500 text-white"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Import Target</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInstantAnalyze(job);
                            }}
                            className="px-3 py-1.5 font-bold text-[10.5px] rounded-md transition-all cursor-pointer flex items-center gap-1 text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700"
                          >
                            <Sparkles className="w-3 h-3 text-blue-400" />
                            <span>Instant Compile Portfolio</span>
                          </button>

                          {job.applyUrl && (
                            <a
                              href={job.applyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="px-3 py-1.5 font-bold text-[10.5px] rounded-md transition-all flex items-center gap-1 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/40"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Source Posting</span>
                            </a>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
 
                {displayedListInSplit.length === 0 && (
                  <div className="p-12 text-center text-slate-500 italic font-mono bg-slate-950/40 border-0 rounded-xl">
                    No matching creative vacancies currently clear the configured safety criteria sliders.
                  </div>
                )}
              </div>
            )}
 
            {/* If tab 4: Apply today checklist & mission dashboards */}
            {subTab === "today" && (
              <ApplyTodayTab
                dailyMissions={dailyMissions}
                onToggleMission={handleToggleMission}
                filteredJobs={filteredJobs}
                selectedJob={selectedJob}
                onSelectJob={setSelectedJob}
                getApplyReadiness={getApplyReadiness}
                builtPortfolioFiles={builtPortfolioFiles}
                onNavigateToTab={setSubTab}
                energyLevel={energyLevel}
                onEnergyLevelChange={setEnergyLevel}
                trackerRows={trackerRows}
                setTrackerRows={setTrackerRows}
                userProfile={userProfile || defaultProfile}
              />
            )}
 
          </div>
 
          {/* RIGHT PANEL: SELECTED JOB DETAILS & "GET ME HIRED" WORKSTATION DECK */}
          <div className="md:col-span-5 lg:col-span-4 space-y-4">
            {selectedJob ? (
              <div className="bg-slate-900/60 p-5 rounded-xl space-y-5 shadow-sm text-left">
                
                {/* Title Card Header */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[8.5px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-blue-955/40 text-blue-400">
                      {selectedJob.lane}
                    </span>
                    <span className="text-[9px] font-mono font-medium text-slate-500">
                      {selectedJob.computedTotal} fit score
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-100 tracking-tight">
                      {selectedJob.title}
                    </h3>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-blue-400 font-medium tracking-tight">@{selectedJob.company}</p>
                      {selectedJob.source && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                          via {selectedJob.source}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px] text-slate-455 pt-2 border-t border-slate-800/40 font-mono">
                    <p><span className="text-slate-550 mr-0.5">Location:</span> {selectedJob.location}</p>
                    <p><span className="text-slate-550 mr-0.5">Pay:</span> {selectedJob.salary}</p>
                    <p><span className="text-slate-550 mr-0.5">Experience:</span> {selectedJob.experienceLevel}</p>
                    <p><span className="text-slate-550 mr-0.5">Commute:</span> {getJobDistance(selectedJob) === 0 ? "Remote" : `${Math.round(getJobDistance(selectedJob))} mi`}</p>
                  </div>

                  {selectedJob.applyUrl && (
                    <a
                      href={selectedJob.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Apply Directly on {selectedJob.source || "Source Site"}</span>
                    </a>
                  )}
                </div>

                {/* GET ME HIRED ACTION COMMAND PANEL */}
                <div className="bg-slate-950/45 p-4 rounded-xl space-y-4">
                  
                  {/* Readiness Progress gauge block */}
                  <div className="space-y-1.5 border-b border-slate-800/30 pb-2.5">
                    <div className="flex justify-between items-center text-xs text-slate-400 font-sans">
                      <span className="flex items-center gap-1.5 font-medium">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Application readiness
                      </span>
                      <span className="text-emerald-400 font-medium">
                        {getApplyReadiness(selectedJob).score}/10 ready
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                      <div 
                        className="bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${(getApplyReadiness(selectedJob).score / 10) * 105}%` }}
                      />
                    </div>
                  </div>

                  {/* Micro checklist items */}
                  <div className="space-y-1.5 font-sans text-[10.5px]">
                    {getApplyReadiness(selectedJob).checklist.map((item, id) => (
                      <div key={id} className="flex items-center gap-2">
                        {item.met ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-450 shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0 select-none bg-slate-950" />
                        )}
                        <span className={item.met ? "text-slate-350" : "text-slate-500 italic"}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* SUCCESS ACTION TOAST */}
                  {successToast && (
                    <div className="bg-emerald-950/40 border border-emerald-900/40 p-2.5 rounded text-[10.5px] text-emerald-400 font-mono text-center animate-pulse flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-450" />
                      <span>{successToast}</span>
                    </div>
                  )}

                  {/* ACTIVE OUTREACH COMMANDS DECK */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    
                    {/* BUTTON 1: Match Resume format */}
                    <button
                      type="button"
                      onClick={handleActionSelectResume}
                      className="px-2 py-1.5 bg-slate-900/60 hover:bg-slate-800 transition-all text-slate-300 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer font-sans font-medium hover:text-white"
                    >
                      <span>Map Resume Style</span>
                    </button>

                    {/* BUTTON 2: Match portfolio layout */}
                    <button
                      type="button"
                      onClick={handleActionPreparePortfolio}
                      className="px-2 py-1.5 bg-slate-900/60 hover:bg-slate-800 transition-all text-slate-300 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer font-sans font-medium hover:text-white"
                    >
                      <span>Match Portfolio Piece</span>
                    </button>

                    {/* BUTTON 3: Generate Outreach script */}
                    <button
                      type="button"
                      onClick={handleActionOutreachRedirect}
                      className="px-2 py-1.5 bg-slate-900/60 hover:bg-slate-800 transition-all text-slate-300 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer font-sans font-medium hover:text-white"
                    >
                      <span>Send Outreach Letter</span>
                    </button>

                    {/* BUTTON 4: Background Applied attempt state */}
                    <button
                      type="button"
                      onClick={handleActionToggleApplied}
                      className="px-2 py-1.5 bg-emerald-950/20 hover:bg-emerald-900/20 text-emerald-400 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer font-sans font-medium transition-all"
                    >
                      <span>Log Apply Status</span>
                    </button>
                  </div>
 
                  {/* Recruiter Name Form */}
                  <form onSubmit={handleActionSaveRecruiterInput} className="bg-slate-950/40 p-2 rounded-lg flex items-center gap-2 focus-within:ring-1 focus-within:ring-blue-500/30 transition-all">
                    <input
                      type="text"
                      placeholder="Recruiter name (e.g. Sarah J.)"
                      value={inlineRecruiterInput}
                      onChange={(e) => setInlineRecruiterInput(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-transparent text-[11px] text-slate-200 focus:outline-none placeholder-slate-600 font-sans"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 transition-all px-2.5 py-1 rounded-md text-white text-[10px] font-medium cursor-pointer"
                    >
                      Save
                    </button>
                  </form>
                </div>
 
                {/* Risk Warning checking */}
                {getRiskWarnings(selectedJob.description, selectedJob.title).length > 0 && (
                  <div className="p-3.5 bg-rose-950/10 text-rose-400 text-xs rounded-xl flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500/80 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-semibold block text-[10px] tracking-wide text-rose-300">Screening Red Flags Detected</span>
                      <p className="leading-relaxed text-slate-400 text-[10.5px]">
                        This description mentions: <strong className="font-medium text-rose-400">{getRiskWarnings(selectedJob.description, selectedJob.title).join(", ")}</strong>. Verify policies securely.
                      </p>
                    </div>
                  </div>
                )}
 
                {/* Skill Gap solver */}
                {getSkillGaps(selectedJob.skills).length > 0 && (
                  <div className="bg-slate-955 border border-slate-900/40 p-3.5 rounded-xl space-y-2">
                    <span className="block text-xs font-sans font-medium text-amber-400">
                      Detected skill gaps & resources
                    </span>
                    <div className="space-y-2.5 font-sans text-xs pt-1">
                      {getSkillGaps(selectedJob.skills).map((g, gi) => (
                        <div key={gi} className="flex justify-between items-start gap-2 border-b border-slate-950/50 pb-1.5 last:border-0 last:pb-0">
                          <div>
                            <span className="font-medium text-slate-200 block">{g.skill}</span>
                            <span className="text-[10px] text-slate-500">Study link: {g.resource}</span>
                          </div>
                          <a
                            href={g.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-900 hover:bg-slate-800 transition-all text-slate-400 hover:text-slate-200 text-[10px] py-1 px-2.5 rounded shrink-0"
                          >
                            Explore Site
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
 
                {/* Job Description details */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-medium text-slate-400">Vacancy description</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans max-h-48 overflow-y-auto bg-slate-950/40 p-3 rounded-lg select-text scrollbar-thin">
                    {selectedJob.description}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-500 italic font-mono bg-slate-900/40 rounded-xl">
                Please click a Columbus job from the list to analyze and trigger readiness cards.
              </div>
            )}
          </div>
        </div>
      )}

      {/* DEDICATED FULL VIEW CHANNELS FOR REMAINING TABS */}
      
      {/* Tab 2: Map view layout & Walk-in drop-by route tracker */}
      {subTab === "map" && (
        <div className="bg-slate-900 border border-slate-805 rounded-xl p-4 space-y-4">
          
          <div className="flex flex-col sm:flex-row gap-2 border-b border-slate-800 pb-3 items-start sm:items-center justify-between">
            <div className="text-left">
              <h3 className="font-sans font-medium text-sm text-slate-100 tracking-tight flex items-center gap-2">
                Geographic & drop-by route desk
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Optimize your physical travel routes across Columbus. Map open vacancies or print custom scripts for walk-in drop-offs!
              </p>
            </div>
            <div className="flex gap-1.5 text-xs shrink-0 self-stretch sm:self-auto mt-1 sm:mt-0">
              <button 
                onClick={() => setMapMode("gis")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all cursor-pointer font-sans font-medium ${
                  mapMode === "gis" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-950/40 text-slate-400 hover:text-white"
                }`}
              >
                Columbus shop map
              </button>
              <button 
                onClick={() => setMapMode("router")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg transition-all cursor-pointer font-sans font-medium ${
                  mapMode === "router" ? "bg-orange-600 text-white shadow-sm" : "bg-slate-950/40 text-slate-400 hover:text-white"
                }`}
              >
                Walk-in route builder
              </button>
            </div>
          </div>

          {mapMode === "gis" ? (
            !useFallbackGrid ? (
              <ColumbusGoogleMap
                apiKey={mapsApiKey}
                jobs={filteredJobs}
                selectedJob={selectedJob}
                onSelectJob={(j) => setSelectedJob(j)}
                onOpenJobHub={(j) => {
                  setSelectedJob(j);
                  setSubTab("jobs");
                }}
                onSwitchToFallbackGrid={() => setUseFallbackGrid(true)}
              />
            ) : (
              <div className="w-full h-[580px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center relative shadow-inner group">
                {/* High-fidelity Tactical Columbus GIS Grid Fallback Map */}
                <div className="w-full h-full relative bg-[#070a13] flex flex-col justify-between overflow-hidden select-none">
                  
                  {/* Grid quadrants overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-12">
                      {Array.from({ length: 144 }).map((_, idx) => (
                        <div key={idx} className="border-r border-b border-slate-700/35 w-full h-full" />
                      ))}
                    </div>
                    {/* Concentric radar rings */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-dashed border-slate-600/30 animate-[pulse_6s_infinite]" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full border border-dashed border-slate-600/30" />
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] rounded-full border border-dashed border-slate-600/20" />
                  </div>

                  {/* Vector Highway overlay */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.25]" xmlns="http://www.w3.org/2000/svg">
                    {/* Scioto River */}
                    <path d="M 120,-50 Q 230,120 380,220 T 460,350 T 440,550" fill="none" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" className="opacity-30" />
                    <path d="M 120,-50 Q 230,120 380,220 T 460,350 T 440,550" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" className="opacity-55" />
                    
                    {/* I-270 Outer Loop */}
                    <ellipse cx="50%" cy="50%" rx="44%" ry="40%" fill="none" stroke="#475569" strokeWidth="3.5" strokeDasharray="6 8" />
                    <ellipse cx="50%" cy="50%" rx="44%" ry="40%" fill="none" stroke="#94a3b8" strokeWidth="1" />

                    {/* I-71 (NE-SW) */}
                    <path d="M 90% 0 Q 75% 35% 50% 50% T 5% 100%" fill="none" stroke="#475569" strokeWidth="2.5" />
                    {/* I-70 (E-W) */}
                    <path d="M 0 78% Q 40% 74% 100% 71%" fill="none" stroke="#475569" strokeWidth="2.5" />
                    {/* Route 315 */}
                    <path d="M 38% 0 C 37% 150, 42% 320, 50% 50% T 50% 100%" fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="3 3" />
                  </svg>

                  {/* Top Notification HUD bar */}
                  <div className="absolute top-3 left-3 right-3 z-10 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between bg-slate-950/90 backdrop-blur-md border border-slate-800/80 p-3 rounded-lg shadow-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                      <div className="text-left">
                        <span className="block text-[10px] font-extrabold text-blue-400 font-mono uppercase tracking-wider">
                          Columbus Vector GIS Grid (Interactive Fallback Active)
                        </span>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Displaying {filteredJobs.length} local placements. Hover to scan, click to lock targets.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] text-slate-450 font-mono text-left sm:text-right border-t sm:border-t-0 border-slate-800 pt-1.5 sm:pt-0">
                      <button
                        onClick={() => setUseFallbackGrid(false)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-sans font-medium transition-colors cursor-pointer"
                      >
                        Switch to Google Maps Platform
                      </button>
                    </div>
                  </div>

                  {/* Geographical Neighborhood Labels */}
                  {[
                    { name: "Powell", x: "18%", y: "14%" },
                    { name: "Dublin", x: "12%", y: "28%" },
                    { name: "Westerville", x: "65%", y: "15%" },
                    { name: "New Albany", x: "85%", y: "24%" },
                    { name: "Clintonville", x: "36%", y: "44%" },
                    { name: "Grandview", x: "26%", y: "66%" },
                    { name: "Downtown", x: "42%", y: "76%" },
                    { name: "Franklinton", x: "24%", y: "81%" },
                    { name: "German Village", x: "45%", y: "91%" },
                    { name: "Reynoldsburg", x: "84%", y: "76%" },
                  ].map((lbl, idx) => (
                    <div 
                      key={idx} 
                      className="absolute text-[8.5px] font-mono tracking-widest font-extrabold text-slate-600/70 pointer-events-none select-none uppercase -translate-x-1/2 -translate-y-1/2"
                      style={{ left: lbl.x, top: lbl.y }}
                    >
                      {lbl.name}
                    </div>
                  ))}

                  {/* Active Job Marker Nodes */}
                  <div className="absolute inset-0 z-5">
                    {filteredJobs.map((j) => {
                      const coords = getColumbusCoords(j.latitude, j.longitude);
                      const isSelected = selectedJob?.id === j.id;
                      const isHovered = hoveredJob?.id === j.id;

                      let nodeColor = "bg-blue-400 border-blue-300 shadow-blue-500/50";
                      let laneShort = "Print";
                      if (j.lane?.includes("Lane A")) {
                        nodeColor = "bg-emerald-400 border-emerald-300 shadow-emerald-500/50";
                        laneShort = "THC";
                      } else if (j.lane?.includes("Lane B")) {
                        nodeColor = "bg-cyan-400 border-cyan-300 shadow-cyan-500/50";
                        laneShort = "PR";
                      } else if (j.lane?.includes("Lane C")) {
                        nodeColor = "bg-purple-400 border-purple-300 shadow-purple-500/50";
                        laneShort = "3D";
                      } else if (j.lane?.includes("Lane D")) {
                        nodeColor = "bg-amber-400 border-amber-300 shadow-amber-500/50";
                        laneShort = "CAD";
                      }

                      return (
                        <div
                          key={j.id}
                          className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
                          style={{ left: coords.x, top: coords.y }}
                        >
                          {/* Pulsing ring underneath selected node */}
                          {isSelected && (
                            <span className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping pointer-events-none" />
                          )}
                          
                          <button
                            onMouseEnter={() => setHoveredJob(j)}
                            onMouseLeave={() => setHoveredJob(null)}
                            onClick={() => {
                              setSelectedJob(j);
                              setSubTab("jobs");
                              setSuccessToast(`Locked target coordinate: ${j.company}`);
                            }}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shadow-md cursor-pointer ${nodeColor} ${
                              isSelected 
                                ? "scale-140 ring-4 ring-white/10 border-white" 
                                : "hover:scale-125 hover:border-white"
                            }`}
                          >
                            <span className="text-[8.5px] font-mono font-extrabold text-slate-950">
                              {laneShort}
                            </span>
                          </button>

                          {/* Minimal hover dot anchor helper */}
                          {isHovered && (
                            <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 bg-slate-900 border border-slate-750 px-2 py-0.5 rounded text-[9.5px] font-mono font-bold text-white whitespace-nowrap z-30 pointer-events-none shadow-xl">
                              {j.company}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Floated contextual job details radar card (interactive HUD panel overlay) */}
                  <div className="absolute bottom-3 left-3 right-3 z-10 grid grid-cols-1 md:grid-cols-2 gap-3 pointer-events-none">
                    
                    {/* Selected Target HUD */}
                    <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-2xl text-left pointer-events-auto max-w-sm">
                      <span className="text-[8px] uppercase font-bold font-mono tracking-wider text-slate-500">
                        Active Navigation Coordinates
                      </span>
                      {selectedJob ? (
                        <div className="mt-1 space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="block text-xs font-bold text-slate-100 leading-tight">
                              {selectedJob.title}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono tracking-tight shrink-0 ${
                              selectedJob.lane?.includes("Lane A") ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" :
                              selectedJob.lane?.includes("Lane B") ? "bg-cyan-950/40 text-cyan-400 border border-cyan-900/40" :
                              selectedJob.lane?.includes("Lane C") ? "bg-purple-950/40 text-purple-400 border border-purple-900/40" :
                              "bg-amber-950/40 text-amber-400 border border-amber-900/40"
                            }`}>
                              {selectedJob.lane?.split(" — ")[0]}
                            </span>
                          </div>
                          
                          <div className="text-[10px] text-slate-400">
                            <strong>{selectedJob.company}</strong> — {selectedJob.location}
                          </div>
                          
                          <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-850">
                            <span className="text-orange-400 font-mono font-semibold">{selectedJob.salary}</span>
                            <button
                              onClick={() => setSubTab("jobs")}
                              className="text-[9px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-sans"
                            >
                              Show Application Hub →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10.5px] text-slate-500 italic mt-1 font-sans">
                          No destination currently locked. Set coordinates by selecting a job marker.
                        </p>
                      )}
                    </div>

                    {/* Hover HUD details */}
                    <div className="hidden md:block">
                      {hoveredJob && (
                        <div className="bg-slate-900/95 backdrop-blur shadow-2xl border border-blue-900/40 p-3 rounded-lg text-left max-w-sm ml-auto">
                          <span className="text-[8px] uppercase font-bold font-mono tracking-wider text-blue-400 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
                            Coordinate Peek: Radar Sweep
                          </span>
                          <div className="mt-1 space-y-1">
                            <span className="block text-xs font-bold text-slate-200 leading-tight truncate">
                              {hoveredJob.title}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-mono truncate">{hoveredJob.company}</span>
                            
                            <div className="grid grid-cols-2 gap-x-2 pt-1.5 text-[8.5px] text-slate-400 uppercase font-mono border-t border-slate-800">
                              <div>Rate: <span className="text-emerald-400 font-sans font-bold">{hoveredJob.salary}</span></div>
                              <div>THC Risk: <span className="text-orange-400 font-sans font-bold">{hoveredJob.scores?.thcRisk ?? 4}/5</span></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </div>
            )
          ) : (
            <div className="space-y-4 text-left animate-[fadeIn_0.4s_ease-out]">
              <div className="bg-gradient-to-r from-orange-950/20 to-slate-950 border border-orange-900/30 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="space-y-1">
                  <div className="text-orange-400 font-bold uppercase font-mono text-xs flex items-center gap-1.5">
                    <span className="inline-block w-2-h-2 bg-orange-500 rounded-full animate-ping mr-1" />
                    <span>Drop-by Route Active: Columbus Print Circuit</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Columbus print supervisors and retail leads respond 5x better to warm face-to-face handoffs. Rather than being buried in a digital ATS queue of 400 profiles, execute this physical circuit. Bring printed copies of portfolio sheets, present customized micro-pitches, and capture private interviews directly!
                  </p>
                </div>
                <div className="bg-slate-950 border border-slate-855 px-3 py-2 rounded font-mono text-xs space-y-0.5 whitespace-nowrap self-stretch md:self-auto text-center shrink-0">
                  <span className="block text-[8px] text-slate-500 font-bold uppercase">Estimated Commute</span>
                  <span className="font-extrabold text-orange-400 flex items-center justify-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-orange-400" />
                    15.2 Miles Total
                  </span>
                  <span className="text-[10px] text-slate-400">Est. Time: 2.5 hrs</span>
                </div>
              </div>

              {/* Interactive Route Stop Google Map */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-850 pb-2">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-orange-400" />
                    <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                      Walk-in Route Stops on Google Maps
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Numbered Pins 1-4 correspond to stops below. Click pin to view address & pitch script.
                  </span>
                </div>
                <ColumbusGoogleMap
                  apiKey={mapsApiKey}
                  jobs={filteredJobs}
                  selectedJob={selectedJob}
                  onSelectJob={(j) => setSelectedJob(j)}
                  mode="route"
                  routeStops={initialWalkInStops}
                  selectedStopId={selectedRouteStopId}
                  onSelectStop={(stop) => setSelectedRouteStopId(stop.id)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 pt-1">
                {initialWalkInStops.map((stop, index) => {
                  const isChecked = !!routeChecks[stop.id];

                  return (
                    <div
                      key={stop.id}
                      onClick={() => setSelectedRouteStopId(stop.id)}
                      className={`p-4 border rounded-xl transition-all relative cursor-pointer ${
                        selectedRouteStopId === stop.id ? "ring-2 ring-orange-500/80 border-orange-500 bg-slate-900/90" : ""
                      } ${
                        isChecked
                          ? "bg-slate-950/20 border-slate-850 opacity-60 line-through text-slate-500"
                          : "bg-slate-950 border-slate-800 hover:border-slate-750"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 border-b border-slate-850 pb-2">
                        <div className="text-left space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] bg-orange-950/60 text-orange-400 border border-orange-900/40 px-2 py-0.5 rounded font-extrabold uppercase">
                              Stop #{index + 1}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {stop.address}
                            </span>
                          </div>
                          <h4 className="font-mono font-bold text-sm text-white uppercase tracking-wide leading-tight">
                            {stop.company}
                          </h4>
                        </div>

                        <button
                          onClick={() => toggleRouteCheck(stop.id)}
                          className={`px-3 py-1 text-[10px] font-mono font-bold uppercase rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isChecked
                              ? "bg-slate-900 text-slate-550 border-slate-800"
                              : "bg-orange-950 text-orange-400 border-orange-900 hover:bg-orange-900/20"
                          }`}
                        >
                          {isChecked ? <CheckCheck className="w-3.5 h-3.5 text-slate-600" /> : <Square className="w-3.5 h-3.5 text-orange-600" />}
                          <span>{isChecked ? "Visited!" : "Mark Visited"}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-3 leading-relaxed">
                        <div className="space-y-2">
                          <div>
                            <span className="block text-[8px] uppercase font-bold text-slate-500 font-mono tracking-wider">最佳拜访时间 / Best Hours:</span>
                            <span className="text-[11.5px] text-slate-350 bg-slate-900/40 px-1.5 py-0.5 rounded border border-slate-855 inline-block mt-0.5">{stop.hours}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase font-bold text-slate-500 font-mono tracking-wider">Target Leader:</span>
                            <span className="text-[11.5px] text-slate-300 font-bold">{stop.target}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase font-bold text-slate-500 font-mono tracking-wider">Print Hand-out Asset Required:</span>
                            <span className="text-[11px] text-blue-400 font-mono font-bold block mt-0.5 bg-slate-900 p-1.5 rounded border border-slate-850">Asset: {stop.spec}</span>
                          </div>
                          <div className="text-[11px] text-slate-455 italic bg-slate-900/40 p-2 rounded border border-slate-855">
                            <strong>Field Strategy:</strong> {stop.advice}
                          </div>
                        </div>

                        <div className="space-y-1.5 bg-slate-900/40 p-3 rounded-lg border border-slate-850/65 flex flex-col justify-between">
                          <div className="space-y-1">
                            <span className="block text-[8px] uppercase font-mono font-bold text-orange-450 tracking-wider">Walk-In Introduction Pitch:</span>
                            <p className="text-[11px] text-slate-300 italic leading-relaxed">
                              &ldquo;{stop.script}&rdquo;
                            </p>
                          </div>

                          <div className="pt-2 text-right">
                            <button
                              onClick={() => handleCopyText(stop.script, stop.id)}
                              className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 hover:text-white transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              {copiedKey === stop.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-450" />
                                  <span>Copied Pitch!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-500" />
                                  <span>Copy Intro Pitch</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Tabs with dedicated modular dashboards */}
      {subTab === "tracker" && (
        <MyTrackerTab
          trackerRows={trackerRows}
          onToggleApplied={toggleTrackerRowApplied}
          onDeleteRow={deleteTrackerRow}
          onAddRow={(co) => setTrackerRows([{ id: "track-man-" + Date.now(), ...co }, ...trackerRows])}
          onResetDefaults={() => setTrackerRows(defaultTrackerRows)}
          onUpdateRow={updateTrackerRow}
        />
      )}

      {subTab === "portfolio" && (
        <PortfolioProofTab
          onCopyText={handleCopyText}
          copiedKey={copiedKey}
          builtPortfolioFiles={builtPortfolioFiles}
          onTogglePortfolioBuilt={togglePortfolioBuilt}
        />
      )}

      {subTab === "companies" && (
        <CompaniesTab
          companyTargets={companyTargets}
          onAddCompany={handleAddCompany}
          onUpdateCompanyStatus={handleUpdateCompanyStatus}
          onDeleteCompany={handleDeleteCompany}
        />
      )}

      {subTab === "people" && (
        <PeopleTab
          onCopyText={handleCopyText}
          copiedKey={copiedKey}
        />
      )}

      {subTab === "bridge" && (
        <BridgeIncomeTab
          onCopyText={handleCopyText}
          copiedKey={copiedKey}
        />
      )}

      {subTab === "messages" && (
        <MessagesTab
          selectedJob={selectedJob}
          trackerRows={trackerRows}
          onCopyText={handleCopyText}
          copiedKey={copiedKey}
          userProfile={userProfile}
        />
      )}

      {subTab === "prep" && (
        <InterviewPrepTab
          selectedJob={selectedJob}
          onCopyText={handleCopyText}
          copiedKey={copiedKey}
          userProfile={userProfile}
        />
      )}

      {subTab === "workflows" && (
        <WorkflowsTab
          selectedJob={selectedJob}
          allJobs={jobs}
          onSelectJob={setSelectedJob}
          userProfile={userProfile || defaultProfile}
        />
      )}

      {/* Settings / Jaime Mode adjustment panel */}
      {subTab === "settings" && (
        <div className="bg-slate-900 border border-slate-805 rounded-xl p-4 space-y-4 text-left">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
              Workspace diagnostic sliders & custom parameters
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Change search multipliers, tweak screening filters, or custom declare technical skills. These preferences dynamically calculate Fit scores system-wide.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Column 1: Fit calculations multipliers */}
            <div className="bg-slate-950 border border-slate-855 rounded-xl p-4 space-y-3.5">
              <span className="block text-[9px] uppercase font-bold font-mono text-slate-500 tracking-wider">
                System Fit Score Multipliers (30pt Model max)
              </span>

              <div className="space-y-2 bg-slate-900/40 p-2.5 rounded border border-slate-855">
                <span className="font-semibold text-slate-250 text-xs">Money & Survival Index ({calcScores.money} / 5)</span>
                <input
                  type="range" min="1" max="5" 
                  value={calcScores.money}
                  onChange={(e) => setCalcScores({ ...calcScores, money: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="space-y-2 bg-slate-900/40 p-2.5 rounded border border-slate-855">
                <span className="font-semibold text-slate-250 text-xs">Creative Production / Vectors Setup ({calcScores.creative} / 5)</span>
                <input
                  type="range" min="1" max="5" 
                  value={calcScores.creative}
                  onChange={(e) => setCalcScores({ ...calcScores, creative: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="space-y-2 bg-slate-900/40 p-2.5 rounded border border-slate-855">
                <span className="font-semibold text-slate-250 text-xs">Low Drug Test Risk ({calcScores.thcRisk} / 5)</span>
                <input
                  type="range" min="1" max="5" 
                  value={calcScores.thcRisk}
                  onChange={(e) => setCalcScores({ ...calcScores, thcRisk: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>

              <div className="space-y-2 bg-slate-900/40 p-2.5 rounded border border-slate-855">
                <span className="font-semibold text-slate-250 text-xs">Low Stress Operations ({calcScores.stress} / 5)</span>
                <input
                  type="range" min="1" max="5" 
                  value={calcScores.stress}
                  onChange={(e) => setCalcScores({ ...calcScores, stress: parseInt(e.target.value) })}
                  className="w-full accent-blue-500"
                />
              </div>
            </div>

            {/* Column 2: Hard safety exclusions checkboxes */}
            <div className="bg-slate-950 border border-slate-855 rounded-xl p-4 space-y-3.5">
              <span className="block text-[9px] uppercase font-bold font-mono text-slate-500 tracking-wider">
                Heavy Hazards / CDL Screening Exclusions
              </span>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-slate-350 bg-slate-900/30 p-2 border border-slate-850 rounded hover:border-slate-800">
                  <input
                    type="checkbox"
                    checked={excludeCdl}
                    onChange={(e) => setExcludeCdl(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span>Exclude Commercial Driver CDL licenses</span>
                </label>
                
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-slate-350 bg-slate-900/30 p-2 border border-slate-850 rounded hover:border-slate-800">
                  <input
                    type="checkbox"
                    checked={excludeForklift}
                    onChange={(e) => setExcludeForklift(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span>Exclude Forklift operator heavy machinery</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-slate-350 bg-slate-900/30 p-2 border border-slate-850 rounded hover:border-slate-800">
                  <input
                    type="checkbox"
                    checked={excludeGov}
                    onChange={(e) => setExcludeGov(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span>Exclude Security Clearance / Federal oversight agencies</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-slate-350 bg-slate-900/30 p-2 border border-slate-850 rounded hover:border-slate-800">
                  <input
                    type="checkbox"
                    checked={excludeSafetySensitive}
                    onChange={(e) => setExcludeSafetySensitive(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span>Exclude safety-sensitive random screens</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-sans text-slate-350 bg-slate-900/30 p-2 border border-slate-850 rounded hover:border-slate-800">
                  <input
                    type="checkbox"
                    checked={excludeHeavyWarehouse}
                    onChange={(e) => setExcludeHeavyWarehouse(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span>Exclude high strain heavy warehouse layout routing</span>
                </label>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
