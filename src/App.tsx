import React, { useState, useEffect, useRef } from "react";
import { UserProfile, JobAnalysis, ResumeData, CoverLetterData, ChecklistItem, ApplicationPacket } from "./types";
import { defaultProfile } from "./defaultProfile";
import { authFetch } from "./firebase/client";
import {
  getUserStoreValue,
  setUserStoreValue,
  useUserStoreReady,
} from "./utils/userStore";
import ProfileEditor from "./components/ProfileEditor";
import AnalysisViewer from "./components/AnalysisViewer";
import ResumeViewer from "./components/ResumeViewer";
import CoverLetterViewer from "./components/CoverLetterViewer";
import ChecklistViewer from "./components/ChecklistViewer";
import NotesSection from "./components/NotesSection";
import SavedPacketsList from "./components/SavedPacketsList";
import ColumbusJobFinder from "./components/ColumbusJobFinder";
import XelimeSystem from "./components/XelimeSystem";
import NotionIntegration from "./components/NotionIntegration";
import ClayIntegration from "./components/ClayIntegration";
import SlateAIChat from "./components/SlateAI/SlateAIChat";
import FloatingIntelligenceWindow from "./components/SlateAI/FloatingIntelligenceWindow";
import SettingsAPIs from "./components/SlateAI/SettingsAPIs";
import MainUIWorkspace from "./components/MainUIWorkspace";
import {
  Briefcase,
  Building,
  MapPin,
  Sparkles,
  Layers,
  Settings,
  ShieldCheck,
  Cpu,
  Bookmark,
  FileCheck,
  Send,
  Printer,
  Copy,
  Download,
  Terminal,
  HelpCircle,
  FileText,
  BookmarkCheck,
  RefreshCw,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutGrid
} from "lucide-react";

export default function App() {
  const storeReady = useUserStoreReady();

  // Profiles
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);

  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [showMainUI, setShowMainUI] = useState(false);
  const [isIntelligenceOpen, setIsIntelligenceOpen] = useState(false);
  const [isIntelligenceMinimized, setIsIntelligenceMinimized] = useState(false);

  // Settings popup (served from public/settings-prototype.html)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mapsKeyRefreshToken, setMapsKeyRefreshToken] = useState(0);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsDialogRef = useRef<HTMLDivElement | null>(null);
  const settingsIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    const onKeysUpdated = (e: MessageEvent) => {
      if (e.data && e.data.type === "career-engine:settings-keys-updated") {
        setMapsKeyRefreshToken((t) => t + 1);
      }
    };
    window.addEventListener("gmp-quota-exceeded", onQuotaExceeded);
    window.addEventListener("message", onKeysUpdated);
    return () => {
      window.removeEventListener("gmp-quota-exceeded", onQuotaExceeded);
      window.removeEventListener("message", onKeysUpdated);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "career-engine:settings-close") {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("message", onMessage);
    settingsDialogRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("message", onMessage);
      setMapsKeyRefreshToken((t) => t + 1);
      settingsButtonRef.current?.focus();
    };
  }, [settingsOpen]);

  // Same-origin: attach an Escape listener inside the settings page that asks the
  // parent to close. Attaching at runtime keeps the prototype file untouched.
  // Also hands the page a fresh auth token so its API rows can call the server.
  const handleSettingsFrameLoad = async () => {
    const win = settingsIframeRef.current?.contentWindow;
    if (!win) return;
    win.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        win.parent.postMessage({ type: "career-engine:settings-close" }, window.location.origin);
      }
    });
    try {
      const { getAuthHeaders } = await import("./firebase/client");
      const authHeaders = await getAuthHeaders();
      if (authHeaders.Authorization) {
        win.postMessage(
          { type: "career-engine:settings-auth", token: authHeaders.Authorization.replace("Bearer ", "") },
          window.location.origin
        );
      }
    } catch {
      // Page still renders; its API rows will show "sign in required".
    }
  };

  // Active inputs
  const [jobTitle, setJobTitle] = useState("CAD Technical Drafter");
  const [companyName, setCompanyName] = useState("Austin Infrastructure Group");
  const [jobLocation, setJobLocation] = useState("Austin, TX (Hybrid)");
  const [jobPostingRaw, setJobPostingRaw] = useState("");
  const [resumeStyle, setResumeStyle] = useState("CAD Technician");
  const [tone, setTone] = useState("confident");

  // Output documents states
  const [activeTab, setActiveTab] = useState<"jobs" | "xcms" | "clay" | "notion" | "settingsApis" | "resume" | "coverLetter" | "steps" | "matchScore" | "notes">("jobs");
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterData | null>(null);
  const [steps, setSteps] = useState<ChecklistItem[] | null>(null);
  const [notes, setNotes] = useState("");

  // Loading States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBuildingResume, setIsBuildingResume] = useState(false);
  const [isBuildingCoverLetter, setIsBuildingCoverLetter] = useState(false);
  const [isBuildingSteps, setIsBuildingSteps] = useState(false);
  const [isBuildingFull, setIsBuildingFull] = useState(false);

  // Status Alerts
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [isSubmittingDesk, setIsSubmittingDesk] = useState(false);

  // Saved Packets (Firestore-backed via userStore)
  const [savedPackets, setSavedPackets] = useState<ApplicationPacket[]>([]);
  const [activePacketId, setActivePacketId] = useState<string | null>(null);
  const [profileHydrated, setProfileHydrated] = useState(false);

  // Load persisted profile + packets once the user store is hydrated
  useEffect(() => {
    if (!storeReady) {
      setProfileHydrated(false);
      return;
    }
    const savedProfile = getUserStoreValue("slate_draftman_profile");
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        if (parsed && typeof parsed === "object") {
          const isEmptySkeleton =
            !String(parsed.name || "").trim() &&
            !String(parsed.summary || "").trim() &&
            (!Array.isArray(parsed.skills) || parsed.skills.length === 0) &&
            (!Array.isArray(parsed.software) || parsed.software.length === 0) &&
            (!Array.isArray(parsed.experience) || parsed.experience.length === 0) &&
            (!Array.isArray(parsed.education) || parsed.education.length === 0);

          if (isEmptySkeleton) {
            setProfile({ ...defaultProfile });
          } else {
            setProfile({
              ...defaultProfile,
              ...parsed,
              certifications:
                Array.isArray(parsed.certifications) && parsed.certifications.length > 0
                  ? parsed.certifications
                  : defaultProfile.certifications,
              languages: parsed.languages ?? defaultProfile.languages,
              workAuthorization: parsed.workAuthorization ?? defaultProfile.workAuthorization,
              targetJobTitles: parsed.targetJobTitles ?? defaultProfile.targetJobTitles,
              workSettingPreference:
                parsed.workSettingPreference ?? defaultProfile.workSettingPreference,
              links: parsed.links ?? defaultProfile.links,
              projectNotes: parsed.projectNotes ?? defaultProfile.projectNotes,
            });
          }
        }
      } catch {
        // Keep defaults on corrupt payload
      }
    }
    setProfileHydrated(true);

    const savedPacketsRaw = getUserStoreValue("slate_application_packets");
    if (savedPacketsRaw) {
      try {
        const parsed = JSON.parse(savedPacketsRaw);
        if (Array.isArray(parsed)) setSavedPackets(parsed);
      } catch {
        // Keep empty list on corrupt payload
      }
    }
  }, [storeReady]);

  // Sync profile details
  useEffect(() => {
    try {
      localStorage.setItem("slate_draftman_profile_sync", JSON.stringify(profile));
    } catch {
      // Ignore storage errors
    }
    if (!storeReady || !profileHydrated) return;
    setUserStoreValue("slate_draftman_profile", JSON.stringify(profile));
  }, [profile, storeReady, profileHydrated]);

  // Sync saved packets list
  useEffect(() => {
    if (!storeReady || !profileHydrated) return;
    setUserStoreValue("slate_application_packets", JSON.stringify(savedPackets));
  }, [savedPackets, storeReady, profileHydrated]);

  // Load a CAD Tech sample vacancies posting instantly
  const loadCADSamplePosting = () => {
    setJobTitle("Underground Utilities Draftsman");
    setCompanyName("Apex Terra Solutions");
    setJobLocation("Austin, TX (Remote)");
    setResumeStyle("Civil CAD");
    setTone("professional");
    setJobPostingRaw(
      `Job Description:\nApex Terra Solutions is hiring an Underground Utilities Draftsman to join our civil layout and alignments team. We focus on telecommunications infrastructure development, Outside Plant (OSP) placement drawings, high-precision conduit path boring, and municipal permit submittals.\n\nQualifications Required:\n- At least 2 years of active civil technical drafting drafting using AutoCAD and Civil 3D core libraries.\n- Direct experience applying plan redlines, revision checks, parcel boundaries, and utility layers mapping.\n- Familiarity with Texas public site guidelines and easement encroachments permits is a great plus.\n- Passionate about high speed delivery. Revit basic BIM modeling or a studio student background is preferred to help transition sheets to Revit families dynamically in the future.\n- Excel in technical problem solving and independent quality checks.`
    );
    showNotice('info', 'Loaded OSP Civil Drafting job posting sample!');
  };

  const showNotice = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // 1. Analyze Job Posting Only
  const handleAnalyzeJob = async () => {
    if (!jobPostingRaw.trim()) {
      showNotice('error', 'Please paste a job posting first.');
      return;
    }
    setIsAnalyzing(true);
    setActiveTab("matchScore");
    
    try {
      const response = await authFetch("/api/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPosting: jobPostingRaw,
          jobTitle,
          companyName,
          userProfile: profile
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis request failed.");
      }

      const result = await response.json();
      setAnalysis(result);
      showNotice('success', 'Job analyzed successfully! Review Match Score.');
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || "Failed to analyze posting. Verify server.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 2. Build Resume Only
  const handleBuildResume = async () => {
    if (!jobPostingRaw.trim()) {
      showNotice('error', 'Paste a job posting to contextualize your resume.');
      return;
    }
    setIsBuildingResume(true);
    setActiveTab("resume");

    try {
      const response = await authFetch("/api/build-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPosting: jobPostingRaw,
          jobTitle,
          companyName,
          resumeStyle,
          tone,
          userProfile: profile,
          analysisKeywords: analysis?.keywords || []
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Resume tailoring failed.");
      }

      const result = await response.json();
      setResume(result);
      showNotice('success', 'Custom draft resume tailored!');
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || "Tailoring failed.");
    } finally {
      setIsBuildingResume(false);
    }
  };

  // 3. Build Cover Letter Only
  const handleBuildCoverLetter = async () => {
    if (!jobPostingRaw.trim()) {
      showNotice('error', 'Paste a job posting to contextualize your letter.');
      return;
    }
    setIsBuildingCoverLetter(true);
    setActiveTab("coverLetter");

    try {
      const response = await authFetch("/api/build-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPosting: jobPostingRaw,
          jobTitle,
          companyName,
          jobLocation,
          tone,
          userProfile: profile
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Letter generation failed.");
      }

      const result = await response.json();
      setCoverLetter(result);
      showNotice('success', 'Tailored cover letter completed!');
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || "Failed to build letter.");
    } finally {
      setIsBuildingCoverLetter(false);
    }
  };

  // 4. Build Application Steps Only
  const handleBuildSteps = async () => {
    if (!jobPostingRaw.trim()) {
      showNotice('error', 'Paste job details to build customized checkpoints.');
      return;
    }
    setIsBuildingSteps(true);
    setActiveTab("steps");

    try {
      const response = await authFetch("/api/build-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPosting: jobPostingRaw,
          jobTitle,
          companyName
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Checklist pipeline generation failed.");
      }

      const result = await response.json();
      setSteps(result);
      showNotice('success', '10-stage tailored pipeline generated!');
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || "Failed to build checklist.");
    } finally {
      setIsBuildingSteps(false);
    }
  };

  // 5. Generate Full Coordinated Packet
  const handleCreateFullPacket = async () => {
    if (!jobPostingRaw.trim()) {
      showNotice('error', 'Paste job details to compile a complete packet.');
      return;
    }
    setIsBuildingFull(true);
    showNotice('info', 'Compiling complete packet. This takes a moment...');

    try {
      const response = await authFetch("/api/build-full-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPosting: jobPostingRaw,
          jobTitle,
          companyName,
          jobLocation,
          resumeStyle,
          tone,
          userProfile: profile
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Unified compiler failed.");
      }

      const result = await response.json();
      
      setAnalysis(result.analysis);
      setResume(result.resume);
      setCoverLetter(result.coverLetter);
      setSteps(result.steps);
      setActiveTab("resume");
      
      showNotice('success', 'Completely tailored packet successfully generated!');
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || "Unified building failed.");
    } finally {
      setIsBuildingFull(false);
    }
  };

  // Action Desk Triggers
  const handleSavePacket = () => {
    if (!resume && !coverLetter && !steps && !analysis) {
      showNotice('error', 'Nothing to save yet. Run resume/packet builds first.');
      return;
    }

    const newId = activePacketId || `packet-${Date.now()}`;
    const targetPacket: ApplicationPacket = {
      id: newId,
      jobTitle,
      companyName,
      jobLocation,
      jobPostingRaw,
      resumeStyle,
      tone,
      analysis: analysis || undefined,
      resume: resume || undefined,
      coverLetter: coverLetter || undefined,
      steps: steps || undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString()
    };

    if (activePacketId) {
      // Update existing
      setSavedPackets(prev => prev.map(p => p.id === activePacketId ? targetPacket : p));
      showNotice('success', 'Changes saved successfully to active packet!');
    } else {
      // Add new
      setSavedPackets(prev => [targetPacket, ...prev]);
      setActivePacketId(newId);
      showNotice('success', `Saved as a new application packet!`);
    }
  };

  const handleLoadPacket = (id: string) => {
    const target = savedPackets.find(p => p.id === id);
    if (!target) return;

    setActivePacketId(target.id);
    setJobTitle(target.jobTitle);
    setCompanyName(target.companyName);
    setJobLocation(target.jobLocation);
    setJobPostingRaw(target.jobPostingRaw);
    setResumeStyle(target.resumeStyle);
    setTone(target.tone);

    setAnalysis(target.analysis || null);
    setResume(target.resume || null);
    setCoverLetter(target.coverLetter || null);
    setSteps(target.steps || null);
    setNotes(target.notes || "");

    showNotice('info', `Active application context loaded: ${target.jobTitle} @ ${target.companyName}`);
  };

  const handleDeletePacket = (id: string) => {
    setSavedPackets(prev => prev.filter(p => p.id !== id));
    if (activePacketId === id) {
      setActivePacketId(null);
      setAnalysis(null);
      setResume(null);
      setCoverLetter(null);
      setSteps(null);
      setNotes("");
    }
    showNotice('success', 'Packet deleted.');
  };

  // Unified Copy Actions
  const handleCopyTabItem = () => {
    if (activeTab === "resume" && resume) {
      const txt = JSON.stringify(resume, null, 2);
      navigator.clipboard.writeText(txt);
      showNotice('success', 'Copied raw customized resume dataset to clipboard.');
    } else if (activeTab === "coverLetter" && coverLetter) {
      const txt = coverLetter.bodyParagraphs.join("\n\n");
      navigator.clipboard.writeText(txt);
      showNotice('success', 'Copied cover letter text body segments.');
    } else if (activeTab === "steps" && steps) {
      const txt = (steps || []).map((s, idx) => `${idx + 1}. [${s.completed ? 'X' : ' '}] ${s.title}\n   ${s.description}`).join("\n\n");
      navigator.clipboard.writeText(txt);
      showNotice('success', 'Action roadmap copied to clipboard.');
    } else {
      showNotice('info', 'No tab document generated to copy yet.');
    }
  };

  // EXPORTS
  const handleDownloadPlainText = () => {
    if (!resume && !coverLetter) {
      showNotice('error', 'Nothing to download yet.');
      return;
    }

    let textStr = `CAREER PACKET: ${jobTitle} @ ${companyName}\n`;
    textStr += `Style: ${resumeStyle} | Tone: ${tone}\n`;
    textStr += `Compiled: ${new Date().toLocaleDateString()}\n`;
    textStr += `==================================================\n\n`;

    if (resume) {
      textStr += `TAILORED RESUME\n`;
      textStr += `--------------------------------------------------\n`;
      textStr += `${resume.name}\n${resume.contact}\n`;
      if (resume.portfolioUrl) textStr += `${resume.portfolioUrl}\n`;
      textStr += `\nProfessional Summary:\n${resume.summary}\n`;
      textStr += `\nSoftware:\n${resume.software.join(", ")}\n`;
      textStr += `\nSpecialties:\n${resume.skills.join(", ")}\n`;
      textStr += `\nExperience:\n`;
      resume.experience.forEach(exp => {
        textStr += `\n* ${exp.role} @ ${exp.company} (${exp.period})\n`;
        exp.bullets.forEach(b => textStr += `  - ${b}\n`);
      });
      textStr += `\n--------------------------------------------------\n\n`;
    }

    if (coverLetter) {
      textStr += `CUSTOM COVER LETTER\n`;
      textStr += `--------------------------------------------------\n`;
      textStr += `Date: ${coverLetter.date}\n`;
      textStr += `To: ${coverLetter.recipientName}\n`;
      textStr += `Company: ${coverLetter.companyName}\n\n`;
      coverLetter.bodyParagraphs.forEach(p => textStr += `${p}\n\n`);
      textStr += `${coverLetter.closing}\n\n`;
      textStr += `${coverLetter.signoff}\n`;
      textStr += `${profile.name}\n`;
      textStr += `--------------------------------------------------\n\n`;
    }

    const blob = new Blob([textStr], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Application_Packet_${companyName.replace(/\s+/g, "_")}.txt`;
    link.click();
    showNotice('success', 'Plain text file download started!');
  };

  const handleDownloadMarkdown = () => {
    if (!resume && !coverLetter) {
      showNotice('error', 'Nothing to download yet.');
      return;
    }

    let mdStr = `# Candidate Packet: ${jobTitle} at ${companyName}\n\n`;
    mdStr += `*Style Focus: ${resumeStyle}* | *Tone: ${tone}*\n\n`;

    if (resume) {
      mdStr += `## Tailored Resume\n\n`;
      mdStr += `### **${resume.name}**\n`;
      mdStr += `* ${resume.contact}\n`;
      if (resume.portfolioUrl) mdStr += `* Portfolio: [${resume.portfolioUrl}](http://${resume.portfolioUrl})\n`;
      mdStr += `\n### Executive Summary\n${resume.summary}\n\n`;
      mdStr += `### Software Stack\n\`${resume.software.join("`, `")}\`\n\n`;
      mdStr += `### Methods & Specialties\n${resume.skills.map(s => `* ${s}`).join("\n")}\n\n`;
      mdStr += `### Employment Record\n\n`;
      resume.experience.forEach(exp => {
        mdStr += `#### **${exp.role}** | *${exp.company}* \`(${exp.period})\`\n`;
        exp.bullets.forEach(b => mdStr += `* ${b}\n`);
        mdStr += `\n`;
      });
    }

    if (coverLetter) {
      mdStr += `\n---\n\n## Custom Cover Letter\n\n`;
      mdStr += `**Date:** ${coverLetter.date}\n\n`;
      mdStr += `**Recipient:** ${coverLetter.recipientName}\n`;
      mdStr += `**Company:** ${coverLetter.companyName}\n\n`;
      mdStr += `Dear ${coverLetter.recipientName},\n\n`;
      coverLetter.bodyParagraphs.forEach(p => mdStr += `${p}\n\n`);
      mdStr += `*${coverLetter.closing}*\n\n`;
      mdStr += `${coverLetter.signoff}\n\n**${profile.name}**\n`;
    }

    const blob = new Blob([mdStr], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Application_Packet_${companyName.replace(/\s+/g, "_")}.md`;
    link.click();
    showNotice('success', 'Markdown file download started!');
  };

  // Submit to remote pipeline mock desk with animation context
  const handleSendToOperations = () => {
    if (!resume && !coverLetter) {
      showNotice('error', 'Generate resume and letters prior to transmitting.');
      return;
    }
    setIsSubmittingDesk(true);
    showNotice('info', 'Transmitting packet blueprints to AI Operations desk...');

    setTimeout(() => {
      setIsSubmittingDesk(false);
      showNotice('success', 'Blueprints fully registered on AI Operations desk pipeline!');
    }, 2200);
  };

  const handleToggleIntelligence = () => {
    setIsIntelligenceOpen((open) => {
      if (!open) setIsIntelligenceMinimized(false);
      return !open;
    });
  };

  const handleOpenIntelligence = () => {
    setIsIntelligenceMinimized(false);
    setIsIntelligenceOpen(true);
  };

  return (
    <>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      {showMainUI ? (
        <MainUIWorkspace
          onOpenBackendDev={() => setShowMainUI(false)}
          isIntelligenceOpen={isIntelligenceOpen}
          onToggleIntelligence={handleToggleIntelligence}
          onOpenIntelligence={handleOpenIntelligence}
        />
      ) : (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-all">
      
      {/* Top Professional Branding Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-slate-800 border border-slate-750 flex items-center justify-center text-blue-400 shadow-sm">
            <Cpu className="w-5.5 h-5.5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Career Engine</h1>
            <p className="text-[11px] text-slate-400">Technical CV tailor & permit OSP drafter portfolio tracker</p>
          </div>
        </div>

        {/* Global Action Notices */}
        <div className="flex items-center gap-3">
          {feedbackMsg && (
            <div className={`px-3 py-1 rounded text-xs shadow-sm transition-all flex items-center gap-2 border ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : feedbackMsg.type === 'error'
                ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                : 'bg-blue-950/80 border-blue-800 text-blue-200'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          <button
            ref={settingsButtonRef}
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            aria-haspopup="dialog"
            aria-expanded={settingsOpen}
            title="Settings"
            className="p-2 rounded-md border border-orange-500/70 bg-slate-900 hover:bg-slate-800 text-orange-400 hover:text-orange-300 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="text-[10px] bg-slate-800 border border-slate-750 rounded px-2.5 py-1 font-mono text-slate-350 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Secure Enterprise Mode</span>
          </div>
        </div>
      </header>

      {/* Main Grid/Flex View */}
      <main className="flex-1 max-w-[1750px] w-full mx-auto p-4 lg:p-6 flex flex-col xl:flex-row gap-6 items-start">
        
        {/* LEFT PANEL: INPUT PARAMETERS PANEL (Collapsible) */}
        <section 
          className={`bg-slate-900 border border-slate-800 rounded-lg transition-all duration-300 shadow-xl shrink-0 ${
            isLeftPanelCollapsed 
              ? "w-full xl:w-[64px] p-3 flex flex-col items-center gap-4" 
              : "w-full xl:w-[330px] p-5 flex flex-col justify-between h-fit gap-5"
          }`}
        >
          {isLeftPanelCollapsed ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <button
                onClick={() => setIsLeftPanelCollapsed(false)}
                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-md text-blue-400 hover:text-blue-300 transition-colors cursor-pointer w-9 h-9 flex items-center justify-center shadow-lg"
                title="Expand Targets Panel"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <div className="h-[1px] w-full bg-slate-800" />
              
              <div className="flex flex-col gap-6 items-center w-full">
                <div className="group relative flex flex-col items-center cursor-pointer" onClick={() => setIsLeftPanelCollapsed(false)} title={`Company: ${companyName}`}>
                  <Building className="w-5 h-5 text-slate-455 group-hover:text-blue-400 transition-colors" />
                  <span className="text-[9px] font-mono mt-1 text-slate-500 text-center truncate max-w-[48px]">
                    {companyName.substring(0, 5)}...
                  </span>
                </div>

                <div className="group relative flex flex-col items-center cursor-pointer" onClick={() => setIsLeftPanelCollapsed(false)} title={`Role: ${jobTitle}`}>
                  <Briefcase className="w-5 h-5 text-slate-455 group-hover:text-blue-400 transition-colors" />
                  <span className="text-[9px] font-mono mt-1 text-slate-500 text-center truncate max-w-[48px]">
                    {jobTitle.substring(0, 5)}...
                  </span>
                </div>

                <div className="group relative flex flex-col items-center cursor-pointer" onClick={() => setIsLeftPanelCollapsed(false)} title={`Location: ${jobLocation}`}>
                  <MapPin className="w-5 h-5 text-slate-455 group-hover:text-blue-400 transition-colors" />
                  <span className="text-[9px] font-mono mt-1 text-slate-500 text-center truncate max-w-[48px]">
                    {jobLocation.substring(0, 5)}...
                  </span>
                </div>

                <div className="group relative flex flex-col items-center cursor-pointer" onClick={() => setIsLeftPanelCollapsed(false)} title={`Style: ${resumeStyle}`}>
                  <FileText className="w-5 h-5 text-slate-455 group-hover:text-blue-400 transition-colors" />
                  <span className="text-[9px] font-mono mt-1 text-slate-500 text-center truncate max-w-[48px]">
                    {resumeStyle.substring(0, 5)}...
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-sans font-bold text-slate-100 text-[11px] uppercase tracking-wider font-mono">Target Settings</h3>
                    <button
                      onClick={() => setIsLeftPanelCollapsed(true)}
                      className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                      title="Collapse Sidepanel"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={loadCADSamplePosting}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-755 text-blue-400 hover:text-blue-300 border border-slate-700 rounded flex items-center gap-1 cursor-pointer text-[10.5px] transition-colors"
                    title="Populate test description instantly"
                  >
                    <Sparkles className="w-3 h-3" /> Load Sample
                  </button>
                </div>

                {/* Inputs list */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">Company Name</label>
                    <div className="relative">
                      <Building className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-600 font-sans"
                        placeholder="e.g. Austin Utility Engineering"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">Target Job Title</label>
                    <div className="relative">
                      <Briefcase className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-600 font-sans"
                        placeholder="e.g. Lead CAD Drafter"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">Coordinates / Location</label>
                    <div className="relative">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-600 font-sans"
                        placeholder="e.g. Austin, TX (Hybrid)"
                        value={jobLocation}
                        onChange={(e) => setJobLocation(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Resume Style Select */}
                  <div>
                    <label className="block text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">Resume focus style</label>
                    <select
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer font-sans"
                      value={resumeStyle}
                      onChange={(e) => setResumeStyle(e.target.value)}
                    >
                      <option value="CAD Technician" className="bg-slate-950 text-slate-100">CAD Technician (General)</option>
                      <option value="Architectural Drafter" className="bg-slate-950 text-slate-100">Architectural Drafter</option>
                      <option value="BIM Technician" className="bg-slate-950 text-slate-100">BIM Technician</option>
                      <option value="Civil CAD" className="bg-slate-950 text-slate-100">Civil CAD Spec</option>
                      <option value="Design Assistant" className="bg-slate-950 text-slate-100">Design Assistant</option>
                      <option value="Remote CAD" className="bg-slate-950 text-slate-100">Remote CAD</option>
                    </select>
                  </div>

                  {/* Tone style selection */}
                  <div>
                    <label className="block text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">Cover Letter Tone</label>
                    <div className="grid grid-cols-4 gap-1">
                      {['professional', 'confident', 'simple', 'creative'].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTone(t)}
                          className={`py-1 rounded text-[9.5px] font-bold border cursor-pointer uppercase transition-all ${
                            tone === t
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-100"
                          }`}
                        >
                          {t.substring(0, 4)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Raw posting input text */}
                  <div>
                    <label className="block text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mb-1 font-mono">Job specifications criteria</label>
                    <textarea
                      className="w-full h-36 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono placeholder:text-slate-650"
                      placeholder="Paste complete copy/clipped job specifications, software criteria lists, utility requirements..."
                      value={jobPostingRaw}
                      onChange={(e) => setJobPostingRaw(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Core Builder Buttons Grid */}
              <div className="space-y-2 pt-3 border-t border-slate-850 flex flex-col">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-analyze-job"
                    onClick={handleAnalyzeJob}
                    disabled={isAnalyzing || isBuildingFull}
                    className="py-1.5 bg-slate-800 hover:bg-slate-755 disabled:opacity-45 text-slate-205 border border-slate-705 text-[11px] rounded font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Layers className="w-3 h-3 text-blue-400" />}
                    Analyze
                  </button>
                  
                  <button
                    id="btn-build-steps"
                    onClick={handleBuildSteps}
                    disabled={isBuildingSteps || isBuildingFull}
                    className="py-1.5 bg-slate-800 hover:bg-slate-755 disabled:opacity-45 text-slate-205 border border-slate-705 text-[11px] rounded font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    {isBuildingSteps ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileCheck className="w-3 h-3 text-blue-400" />}
                    Build Steps
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-build-resume"
                    onClick={handleBuildResume}
                    disabled={isBuildingResume || isBuildingFull}
                    className="py-1.5 bg-slate-800 hover:bg-slate-755 disabled:opacity-45 text-slate-205 border border-slate-705 text-[11px] rounded font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    {isBuildingResume ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3 text-blue-400" />}
                    Build CV
                  </button>

                  <button
                    id="btn-build-letter"
                    onClick={handleBuildCoverLetter}
                    disabled={isBuildingCoverLetter || isBuildingFull}
                    className="py-1.5 bg-slate-800 hover:bg-slate-755 disabled:opacity-45 text-slate-205 border border-slate-705 text-[11px] rounded font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    {isBuildingCoverLetter ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 text-blue-400" />}
                    Build Letter
                  </button>
                </div>

                <button
                  id="btn-build-full"
                  onClick={handleCreateFullPacket}
                  disabled={isBuildingFull || isAnalyzing || isBuildingResume || isBuildingCoverLetter || isBuildingSteps}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs rounded flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md active:scale-98 border border-blue-500"
                >
                  {isBuildingFull ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Compiling...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                      <span>Create Full Custom Packet</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        {/* CENTER PANEL: GENERATED DOCUMENTS & INTERACTIVE VIEWER */}
        <section className="flex-1 min-w-0 space-y-6">
          {/* Main Visual tab controllers */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-md flex items-center justify-between shadow-xs">
            <div className="flex gap-1 overflow-x-auto min-w-0 flex-1">
              {[
                { id: "jobs", label: "Columbus Jobs" },
                { id: "xcms", label: "XELIME System" },
                { id: "clay", label: "Clay Pipeline" },
                { id: "notion", label: "Notion" },
                { id: "settingsApis", label: "Settings → APIs" },
                { id: "resume", label: "Resume" },
                { id: "coverLetter", label: "Cover Letter" },
                { id: "steps", label: "Checklist Steps" },
                { id: "matchScore", label: "Match Score Matrix" },
                { id: "notes", label: "Notes" }
              ].map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setActiveTab(tb.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded truncate shrink-0 cursor-pointer transition-all ${
                    activeTab === tb.id
                      ? "bg-blue-600 text-white shadow-sm border border-blue-500"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setActiveTab("notes")}
              className={`text-slate-300 hover:text-slate-100 text-xs flex items-center gap-1.5 font-mono bg-slate-950 px-2.5 py-1 border rounded border-slate-800 transition-colors cursor-pointer ${activeTab === 'notes' ? 'border-blue-500 bg-blue-950/20' : ''}`}
            >
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>Session Log</span>
            </button>
          </div>

          {/* Active Tab rendering space */}
          <div className="transition-all duration-300">
            {activeTab === "jobs" && (
              <ColumbusJobFinder
                onImportJob={(job) => {
                  setJobTitle(job.title);
                  setCompanyName(job.company);
                  setJobLocation(job.location);
                  setJobPostingRaw(job.description);
                  setResumeStyle(job.style || "CAD Technician");
                  showNotice("success", `Imported "${job.title}" into targets!`);
                }}
                onInstantAnalyze={async (job) => {
                  setJobTitle(job.title);
                  setCompanyName(job.company);
                  setJobLocation(job.location);
                  setJobPostingRaw(job.description);
                  setResumeStyle(job.style || "CAD Technician");
                  
                  showNotice("info", `Importing and compiling entire portfolio for ${job.title}...`);
                  setIsBuildingFull(true);
                  try {
                     const response = await authFetch("/api/build-full-packet", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        jobPosting: job.description,
                        jobTitle: job.title,
                        companyName: job.company,
                        jobLocation: job.location,
                        resumeStyle: job.style,
                        tone: tone,
                        userProfile: profile
                      })
                    });

                    if (!response.ok) {
                      const errData = await response.json();
                      throw new Error(errData.error || "Unified compiler failed.");
                    }

                    const result = await response.json();
                    setAnalysis(result.analysis);
                    setResume(result.resume);
                    setCoverLetter(result.coverLetter);
                    setSteps(result.steps);
                    setActiveTab("resume");
                    showNotice("success", "Packet compiled successfully! Switch tabs to review.");
                  } catch (err: any) {
                    console.error(err);
                    showNotice("error", err.message || "Unified compilation failed.");
                  } finally {
                    setIsBuildingFull(false);
                  }
                }}
                currentLoadedJobTitle={jobTitle}
                userProfile={profile}
                targetLocation={jobLocation}
                onOpenSettings={() => setSettingsOpen(true)}
                mapsKeyRefreshToken={mapsKeyRefreshToken}
                onUpdateProfile={(p) => {
                  setProfile(p);
                  showNotice("success", `AI imported resume credentials for "${p.name}"!`);
                }}
              />
            )}
            {activeTab === "xcms" && (
              <XelimeSystem
                onImportToBuilder={(job) => {
                  setJobTitle(job.title);
                  setCompanyName(job.company);
                  setJobLocation(job.location);
                  setJobPostingRaw(job.description);
                  setResumeStyle(job.style || "CAD Technician");
                  setIsLeftPanelCollapsed(false);
                  showNotice("success", `Loaded "${job.title}" from XELIME into the Application Builder!`);
                }}
              />
            )}
            {activeTab === "clay" && (
              <ClayIntegration
                userProfile={profile}
                onLoadToBuilder={(job) => {
                  setJobTitle(job.title);
                  setCompanyName(job.company);
                  setJobLocation(job.location);
                  setJobPostingRaw(job.description);
                  setResumeStyle(job.style || "CAD Technician");
                  setIsLeftPanelCollapsed(false);
                  showNotice("success", `Loaded "${job.title}" from Clay Pipeline into Application Builder!`);
                }}
                onInstantPacket={async (job) => {
                  setJobTitle(job.title);
                  setCompanyName(job.company);
                  setJobLocation(job.location);
                  setJobPostingRaw(job.description);
                  setResumeStyle(job.style || "CAD Technician");
                  showNotice("info", `Compiling full application packet for ${job.title} (${job.company})...`);
                  setIsBuildingFull(true);
                  try {
                    const response = await authFetch("/api/build-full-packet", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        jobPosting: job.description,
                        jobTitle: job.title,
                        companyName: job.company,
                        jobLocation: job.location,
                        resumeStyle: job.style,
                        tone,
                        userProfile: profile,
                      }),
                    });
                    if (!response.ok) {
                      const errData = await response.json();
                      throw new Error(errData.error || "Unified compiler failed.");
                    }
                    const result = await response.json();
                    setAnalysis(result.analysis);
                    setResume(result.resume);
                    setCoverLetter(result.coverLetter);
                    setSteps(result.steps);
                    setActiveTab("resume");
                    showNotice("success", "Clay lead application packet compiled! Switch tabs to review.");
                  } catch (err: any) {
                    showNotice("error", err.message || "Unified compilation failed.");
                  } finally {
                    setIsBuildingFull(false);
                  }
                }}
                onNotify={(type, msg) => showNotice(type, msg)}
              />
            )}
            {activeTab === "notion" && (
              <NotionIntegration
                userProfile={profile}
                onUpdateProfile={(p) => {
                  setProfile(p);
                  showNotice("success", `Synced Notion profile credentials for "${p.name}".`);
                }}
                onImportJobToBuilder={(job) => {
                  setJobTitle(job.title);
                  setCompanyName(job.company);
                  setJobLocation(job.location);
                  setJobPostingRaw(job.description);
                  setResumeStyle(job.style || "CAD Technician");
                  setIsLeftPanelCollapsed(false);
                  showNotice("success", `Loaded "${job.title}" from Notion into the Application Builder!`);
                }}
                onSyncCompleteNotice={(msg) => showNotice("info", msg)}
              />
            )}
            {activeTab === "settingsApis" && (
              <SettingsAPIs
                onOpenChat={() => {
                  setIsIntelligenceMinimized(false);
                  setIsIntelligenceOpen(true);
                }}
              />
            )}
            {activeTab === "resume" && (
              <ResumeViewer
                resume={resume}
                isLoading={isBuildingResume || isBuildingFull}
                onUpdate={setResume}
              />
            )}
            {activeTab === "coverLetter" && (
              <CoverLetterViewer
                coverLetter={coverLetter}
                isLoading={isBuildingCoverLetter || isBuildingFull}
                onUpdate={setCoverLetter}
                applicantName={profile.name}
              />
            )}
            {activeTab === "steps" && (
              <ChecklistViewer
                steps={steps}
                isLoading={isBuildingSteps || isBuildingFull}
                onUpdate={setSteps}
              />
            )}
            {activeTab === "matchScore" && (
              <AnalysisViewer
                analysis={analysis}
                isLoading={isAnalyzing || isBuildingFull}
              />
            )}
            {activeTab === "notes" && (
              <NotesSection
                notesOriginal={notes}
                onSaveNotes={setNotes}
              />
            )}
          </div>

          {/* Active Baseline Profile Inspector */}
          <ProfileEditor profile={profile} onChange={setProfile} />
        </section>

        {/* RIGHT PANEL: SAVED PACKS & ACTIONS DESK */}
        <section className="w-full xl:w-[320px] shrink-0 space-y-6 xl:sticky xl:top-[85px]">
          
          {/* Redesigned, Grouped Action Desk panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5 shadow-lg">
            <div>
              <h3 className="font-sans font-bold text-slate-100 text-[11px] uppercase tracking-wider font-mono">Action Desk</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 font-sans">Manage, export, and transmit current custom documents</p>
            </div>
            
            <div className="space-y-4 font-sans">
              {/* Group 1: AI Command & Transmission */}
              <div className="space-y-1.5">
                <span className="block text-[9px] uppercase font-mono text-slate-400 font-bold tracking-widest pl-0.5 animate-pulse">Transmission</span>
                <button
                  onClick={handleSendToOperations}
                  disabled={isSubmittingDesk}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white border border-blue-500 text-xs font-bold rounded-md flex items-center justify-between px-3.5 transition-all cursor-pointer shadow-sm"
                  title="Submit actively generated documents to the Austin dispatch operations console"
                >
                  <div className="flex items-center gap-2">
                    <Send className={`w-3.5 h-3.5 text-white ${isSubmittingDesk ? "animate-pulse" : ""}`} />
                    <span>Send to AI Operations Desk</span>
                  </div>
                  <span className="text-[9px] bg-blue-700 text-white font-mono px-1 rounded uppercase font-semibold">Transmit</span>
                </button>
              </div>

              {/* Group 2: Backup & State Memory */}
              <div className="space-y-1.5 pt-1.5 border-t border-slate-850">
                <span className="block text-[9px] uppercase font-mono text-slate-400 font-bold tracking-widest pl-0.5">Storage & Clipboard</span>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={handleSavePacket}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-805 text-xs font-semibold rounded flex items-center justify-between px-3 transition-colors cursor-pointer group"
                    title="Saves actively loaded portfolio into Cloud Firestore"
                  >
                    <div className="flex items-center gap-2">
                      <Bookmark className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
                      <span>Save Application Packet</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">SAVE PACK</span>
                  </button>

                  <button
                    onClick={handleCopyTabItem}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-805 text-xs font-semibold rounded flex items-center justify-between px-3 transition-colors cursor-pointer group"
                    title="Copy actively selected documents tab data"
                  >
                    <div className="flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
                      <span>Copy Current Tab Data</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">COPY JSON</span>
                  </button>
                </div>
              </div>

              {/* Group 3: File Downloads & Report generation */}
              <div className="space-y-1.5 pt-1.5 border-t border-slate-850">
                <span className="block text-[9px] uppercase font-mono text-slate-400 font-bold tracking-widest pl-0.5">Document Export</span>
                
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => {
                      window.print();
                      showNotice('success', 'Document system layouts prepared for print/PDF export.');
                    }}
                    className="w-full py-2 bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-805 text-xs font-semibold rounded flex items-center justify-between px-3 transition-colors cursor-pointer group"
                    title="Prepares document previews for standard browser printing"
                  >
                    <div className="flex items-center gap-2">
                      <Printer className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400" />
                      <span>Send to Report Export</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">PRINT PDF</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <button
                      onClick={handleDownloadMarkdown}
                      className="py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3 text-blue-400" /> Export MD
                    </button>
                    <button
                      onClick={handleDownloadPlainText}
                      className="py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[10px] font-bold rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3 text-blue-400" /> Export TXT
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Active/History persistent list manager */}
          <SavedPacketsList
            packets={savedPackets}
            activeId={activePacketId}
            onSelect={handleLoadPacket}
            onDelete={handleDeletePacket}
          />

          {/* Guidelines Box */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-md space-y-2.5 shadow-xs">
            <h5 className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">Drafting Guidelines</h5>
            <div className="space-y-2 text-[10px] text-slate-300 leading-relaxed font-sans">
              <p>
                <strong className="text-slate-100 font-bold">Underground Utilities / OSP:</strong> Outside Plant fiber systems placement relies heavily on precise parcel boundary crossings and boring profile redlines. This generator optimizes summary action verbs specifically for Austin regulations.
              </p>
              <p>
                <strong className="text-slate-100 font-bold">BIM / Revit Transitions:</strong> Student backgrounds wanting to shift into design are strategically supported by showcasing structural cross check capability and detailing tasks without claiming unearned degrees.
              </p>
            </div>
          </div>

        </section>

      </main>

      {/* Styled system footer */}
      <footer className="bg-slate-950 border-t border-slate-850 py-3.5 px-6 text-center text-slate-500 text-[10px] font-mono flex flex-col sm:flex-row items-center justify-between gap-2.5 mt-8 max-w-[1700px] w-full mx-auto shadow-sm">
        <span>© 2016-2026 Google AI Studio. Slate Career Builder - Texas Telecom & Site Permits Cataloger.</span>
        <div className="flex gap-4">
          <span className="hover:text-slate-400 cursor-pointer transition-colors">Privacy Shield</span>
          <span className="hover:text-slate-400 cursor-pointer transition-colors">Data Agreement</span>
        </div>
      </footer>

      {/* Floating Bottom-Left Launchers (Backend Dev) */}
      <div className="fixed bottom-5 left-5 z-40 flex items-center gap-2">
        <button
          id="btn-xelime-intelligence"
          type="button"
          onClick={handleToggleIntelligence}
          aria-expanded={isIntelligenceOpen}
          title={
            isIntelligenceOpen
              ? "Close XELIME INTELLIGENCE"
              : "Open XELIME INTELLIGENCE"
          }
          className={`px-3.5 py-2.5 rounded-lg shadow-lg shadow-black/50 flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer transition-all border ${
            isIntelligenceOpen
              ? "bg-blue-600/20 text-white border-blue-500 ring-1 ring-blue-500/40"
              : "bg-slate-900 hover:bg-slate-800 text-slate-100 border-slate-700 hover:border-blue-500/70"
          }`}
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>XELIME INTELLIGENCE</span>
        </button>

        <button
          id="btn-main-ui"
          type="button"
          onClick={() => setShowMainUI(true)}
          title="Open XELIME Career Engine Main UI"
          className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 hover:border-blue-500/70 rounded-lg shadow-lg shadow-black/50 flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider cursor-pointer transition-all"
        >
          <LayoutGrid className="w-4 h-4 text-blue-400" />
          <span>Main UI</span>
        </button>
      </div>

    </div>
      )}

      {/* Persistent Floating XELIME INTELLIGENCE Window (shared across Backend Dev & Main UI) */}
      <FloatingIntelligenceWindow
        isOpen={isIntelligenceOpen}
        isMinimized={isIntelligenceMinimized}
        onToggleMinimize={() => setIsIntelligenceMinimized((m) => !m)}
        onClose={() => setIsIntelligenceOpen(false)}
      >
        <SlateAIChat
          embeddedInWindow
          onOpenSettingsAPIs={() => {
            setShowMainUI(false);
            setActiveTab("settingsApis");
          }}
          onOpenXelimeSystem={() => {
            setShowMainUI(false);
            setActiveTab("xcms");
          }}
          onOpenNotion={() => {
            setShowMainUI(false);
            setActiveTab("notion");
          }}
          userProfile={profile}
          careerContextSummary={`Candidate: ${profile.name} (${profile.location})\nSkills: ${profile.skills.join(", ")}\nSoftware: ${profile.software.join(", ")}\nActive Job Target: ${jobTitle} at ${companyName} (${jobLocation})`}
          activeJob={{
            title: jobTitle,
            company: companyName,
            location: jobLocation,
          }}
          profileName={profile.name}
          profileSkills={profile.skills}
          profileSoftware={profile.software}
          savedPacketsCount={savedPackets.length}
        />
      </FloatingIntelligenceWindow>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/70 flex items-center justify-center sm:p-6"
          role="presentation"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            ref={settingsDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="outline-none bg-slate-900 border border-slate-800 rounded-none sm:rounded-lg shadow-2xl overflow-hidden w-full h-full sm:w-[920px] sm:max-w-[95vw] sm:h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between pl-4 pr-2 py-2 border-b border-slate-800 bg-slate-900 shrink-0">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Settings className="w-4 h-4 text-orange-400" />
                Settings
              </span>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
                title="Close settings"
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer text-lg leading-none"
              >
                ×
              </button>
            </div>
            <iframe
              ref={settingsIframeRef}
              src="/settings-prototype.html"
              title="Settings"
              onLoad={handleSettingsFrameLoad}
              className="flex-1 w-full bg-slate-950"
            />
          </div>
        </div>
      )}
    </>
  );
}
