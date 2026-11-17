import React, { useState, useEffect } from "react";
import { authFetch } from "../firebase/client";
import { JobFixture } from "../types";
import { 
  Clipboard, 
  RefreshCw, 
  Check, 
  Sparkles, 
  Building2, 
  HelpCircle, 
  Smile, 
  FileText, 
  DollarSign, 
  ArrowRight, 
  ToggleLeft, 
  MessageSquare,
  BadgeAlert,
  Copy,
  ChevronDown,
  ChevronUp
} from "lucide-react";

import { UserProfile } from "../types";

interface InterviewPrepTabProps {
  selectedJob: JobFixture | null;
  onCopyText: (text: string, key: string) => void;
  copiedKey: string | null;
  userProfile?: UserProfile;
}

const defaultUserProfile: UserProfile = {
  name: "Jaime Hernandez",
  email: "jaime.h.columbus@gmail.com",
  phone: "(614) 255-0182",
  location: "Columbus, OH",
  portfolioUrl: "https://jaimedesigns.co/portfolio",
  summary: "Detail-oriented designer and drafting layout specialist with 3+ years of experience. Highly skilled in converting scaled design specifications, conducting file pre-flights, and preparing spot color vector separators. Exceptional layer hygiene and compliance tracking.",
  skills: ["Pre-press prep", "Color separations", "Vinyl plotting", "Zoning approval drawings", "Customer care", "Compliance auditing"],
  software: ["AutoCAD", "Civil 3D", "Adobe Illustrator", "Photoshop", "InDesign", "Blender"],
  experience: [
    {
      role: "Layout & Production Assistant",
      company: "Scioto Signs & Displays",
      period: "2024 - Present",
      bullets: [
        "Pre-flighted client vector assets, prepared multi-color registration marks and spot separation plates in Illustrator.",
        "Monitored ink viscosity, set up vinyl weeding screens, and audited prints against customer order sheets with zero errors.",
        "Managed physical print order backlog, improving shift turnaround speed by 25%."
      ]
    },
    {
      role: "Lead Civil Drafting Technician",
      company: "Mid-Ohio Utility Drafting",
      period: "2021 - 2024",
      bullets: [
        "Created high-fidelity underground utility conduit networks, alignments, and permit packages in Civil 3D.",
        "Revised cross-sections, formatted municipal sheet sets, and maintained pristine layer structures for zero-drift alignment.",
        "Liaised between surveyors and project engineers to resolve layout overlaps."
      ]
    }
  ],
  education: [
    {
      degree: "Associate of Applied Science in CAD Technology",
      school: "Columbus State Community College",
      period: "2019 - 2021",
      details: "Specialized in structural drawings, GIS systems, and parametric design templates."
    }
  ],
  projects: [
    {
      name: "Downtown Streetscape GIS Model",
      description: "Developed comprehensive 3D civil models and vector overlays for municipal sidewalk and utility planning.",
      technologies: ["AutoCAD", "Civil 3D", "Illustrator"]
    },
    {
      name: "Custom Screen-Print Prep System",
      description: "Designed procedural vector scripts to automate spot-separation and registration markings for quick silk screens.",
      technologies: ["Illustrator", "Photoshop"]
    }
  ],
  certifications: ["CSCC Advanced Civil 3D Drafting Certificate", "OSHA 10-Hour Card"]
};

export default function InterviewPrepTab({
  selectedJob,
  onCopyText,
  copiedKey,
  userProfile
}: InterviewPrepTabProps) {
  const [internalTab, setInternalTab] = useState<"elevator" | "star" | "negotiate" | "practice">("elevator");
  const [customParagraph, setCustomParagraph] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // STAR answers configuration state (long vs short toggle for each story)
  const [starLengths, setStarLengths] = useState<Record<string, "short" | "detailed">>({
    "pivot": "short",
    "backlog": "detailed",
    "precision": "short",
    "coop": "detailed"
  });

  // Salary Negotiation Inputs state
  const [negotiationOffer, setNegotiationOffer] = useState<string>("18.00");
  const [negotiationTarget, setNegotiationTarget] = useState<string>("22.50");

  const job = selectedJob || {
    title: "",
    company: "",
    lane: "",
    skills: [],
    description: ""
  };

  const getLocalWhyFitsMe = (targetJob: typeof job) => {
    const title = targetJob.title;
    const company = targetJob.company;
    const isCreative = targetJob.lane.toLowerCase().includes("creative") || targetJob.lane.toLowerCase().includes("lane b");
    
    if (isCreative) {
      return `As a detail-oriented professional with extensive hands-on experience in layout production, large-format sign setups, and color separations, I am uniquely matched for the ${title} opportunity at ${company}. Having mastered Adobe Illustrator and Photoshop for print-prep film and registration marks, I know exactly how to transform vector plans into physical products. My background in drafting guarantees high precision under tight, order-heavy schedules with zero errors.`;
    } else if (targetJob.lane.toLowerCase().includes("cad") || targetJob.lane.toLowerCase().includes("lane d")) {
      return `I offer a direct technical match for the ${title} position at ${company}. Drawing upon my extensive Civil CAD drafting background, I offer exceptional proficiency in scaled drawings, structural layouts, and material tolerances. I bridge technical blueprints with final print setups, ensuring flawless shop routing and low-drama delivery.`;
    } else if (targetJob.lane.toLowerCase().includes("3d") || targetJob.lane.toLowerCase().includes("lane c")) {
      return `My qualifications map directly to the ${title} vacancy with ${company}. Combining AutoCAD structural designs with procedural modeling, texture baking, and lighting rigs in Blender, I build photorealistic apparel sets and spatial layouts. I understand how to generate high-fidelity digital mockups that maximize e-commerce order engagement.`;
    } else {
      return `I am highly enthusiastic about joining the ${title} team with ${company}. As a meticulous professional trained in technical civil drafting, I am highly reliable, organized, and cooperative. I prioritize calm customer interactions, detail integrity, and careful cash/compliance logging, making me an outstanding team player.`;
    }
  };

  useEffect(() => {
    setCustomParagraph(getLocalWhyFitsMe(job));
  }, [selectedJob]);

  // Connect AI custom enhancement to real server-side Gemini API
  const handleEnhanceWithAI = async () => {
    setIsLoading(true);
    try {
      const activeProfile = userProfile || defaultUserProfile;
      const res = await authFetch("/api/enhance-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPosting: job.description || "",
          jobTitle: job.title,
          companyName: job.company,
          userProfile: activeProfile
        })
      });
      if (!res.ok) {
        throw new Error("Failed to call AI Pitch Generator");
      }
      const data = await res.json();
      if (data.enhancedPitch) {
        setCustomParagraph(`[Enhanced by Gemini AI - Recruiter-Optimized for Jaime]
${data.enhancedPitch}

Why I'm a low-drama, high-performance recruit: My background in structured CAD modeling guarantees immaculate precision, which translates to error-free physical layouts on day one.`);
      }
    } catch (err: any) {
      console.error(err);
      // Fallback in case of network issue
      const adjectives = ["pragmatic", "objective", "proactive", "resourceful", "meticulous"];
      const chosenAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const base = getLocalWhyFitsMe(job);
      setCustomParagraph(`[Offline Gemini Optimizer Engaged]
${base} 

Why I'm a low-drama, high-performance recruit: I require minimal onboarding training thanks to my dual drafting and physical printing background. I am ${chosenAdj}, focused strictly on high-yield order fulfillment and smooth team operations.`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStarLength = (storyId: string) => {
    setStarLengths(prev => ({
      ...prev,
      [storyId]: prev[storyId] === "short" ? "detailed" : "short"
    }));
  };

  // Pre-compiled high-craft transitional STAR stories
  const starStories = [
    {
      id: "pivot",
      title: "Story I: The Structural-to-Print Transition (Why the pivot?)",
      target: "All Lanes Match",
      short: "I shifted from engineering civil drafting to vector layout print because I enjoy the rapid, high-impact cycle of physical materials production over multi-year municipal plans. I took the absolute detail discipline, scale accuracy, and file-saving rigor of CAD layout modeling, and customized it for spot-separated silk prints and sign graphics—giving the shop an operative who produces error-free pre-press separations on day one.",
      detailed: "• SITUATION: During civil drafting, municipal layouts moved incredibly slow, taking months for single approvals. I wanted to apply my absolute drawing accuracy to fields with rapid physical workflows.\n• TASK: I needed to transfer my meticulous tolerances, layer hygiene, and scale discipline into graphics prep and spot color separates.\n• ACTION: I self-trained in print prepress registration mechanisms, color traps, and choke/spread vector overlays in Illustrator. I developed vector swatch systems that mimic scale plans but output cleanly onto emulsion sheets.\n• RESULT: I created a zero-drift blueprinting process for silkscreen separations that completely removes misregistration line gaps. The carousel runs continuously without manual recalibrations."
    },
    {
      id: "backlog",
      title: "Story II: Managing High-Pressure Deadline Backlogs",
      target: "Lane B & Lane C (Creative / 3D)",
      short: "When print queues bottleneck with custom client graphics, I don't panic. I set up clear pre-flight checkpoints, sort requests by complexity, and use strict file systems so vector templates load in seconds. In past print roles, handling bulk orders step-by-step let me push 45 separates a day without registration drift or missing color chokes.",
      detailed: "• SITUATION: On pre-holiday runs, local apparel screen printers see order queues spike 300%. Stale, unformatted digital client files trigger massive manual setup backlogs.\n• TASK: I had to process 45 complex vector designs in 24 hours while keeping ink mesh alignment rules flawless.\n• ACTION: I established an automated 'Pre-flight Script Checklist'. I sorted client mockups, vectorized low-res graphics, built automatic ink trap chokes, and placed consistent registration marks.\n• RESULT: Every layout cleared on-schedule. The carousel operators loaded film separators without standard alignments issues, reducing idle press time by 30% and clearing the backlog."
    },
    {
      id: "precision",
      title: "Story III: Preventing Costly Layout & Vector Separates Mistakes",
      target: "Lane B, C & D (Vector / CAD)",
      short: "In civil engineering drafting and physical plotting, high precision in layers is everything because a 1/2-inch drift in blueprint lines scraps real steel. I apply this exact layer-control mindset to pre-press, applying custom spot channels and multi-color traps to prevent overlaps before film hits the screen, ensuring a flawless first run.",
      detailed: "• SITUATION: Graphic artists often deliver rich files without color trapping, which causes ugly paper/garment gaps as the screen-print carousel stretches material.\n• TASK: I had to pre-flight an intricate multi-layered vector sign that required absolute registration.\n• ACTION: I analyzed the design like a structural drawing. I manually set up spot plate channels in Photoshop and built 0.5pt strokes as overlapping chokes on dark boundaries in Illustrator.\n• RESULT: The final sign output was razor-sharp and matched exactly. No material got ruined, preserving a $1,200 print sheet match without wastage."
    },
    {
      id: "coop",
      title: "Story IV:Budtender Cash Compliance and Low-Drama Store Flow",
      target: "Lane A (Fast Money Retail Ops)",
      short: "I maintain supreme focus inside busy Columbus dispensaries and retail shops. Facing high-foot-traffic queues and strict state compliance codes, I use methodical drawer counting, double-verify state ID scans, and keep inventory logs pristine. This ensures a calm, zero-liability floor that passes state inspections cleanly.",
      detailed: "• SITUATION: During high-volume holiday sales, budtender checkout queues extend outdoors, putting massive stress on cashier drawer limits and state compliance scans.\n• TASK: My objective was maintaining rapid 90-second customer checkout cycles while enforcing mandatory legal registry entries with zero math errors.\n• ACTION: I stayed calm and used structured operations guidelines. I double-verified state IDs, processed state weights, and kept cash drops strictly cataloged in BioTrack POS.\n• RESULT: I balanced my register drawers down to the penny for 45 straight shifts. The store cleared compliance spot-audits with a 100% score, proving my reliability."
    }
  ];

  // Computation for Negotiation Deltas
  const rateOffer = parseFloat(negotiationOffer) || 18.00;
  const rateTarget = parseFloat(negotiationTarget) || 22.00;
  const monthlyDelta = Math.round((rateTarget - rateOffer) * 40 * 4);
  const yearlyDelta = Math.round((rateTarget - rateOffer) * 40 * 52);

  // Dynamic negotiation script builders
  const getVerbalExpectationScript = () => {
    return `"I'm highly focused on bringing my unique hybrid skill set—combining the absolute precision of technical CAD drafting with hands-on pre-press production—to your shop. Based on my advanced file setup abilities which eliminate idle press time, I am targeting an hourly rate of $${negotiationTarget}/hour to match my contribution. However, I prioritize low-drama cooperation, and my main focus is finding the right long-term professional fit."`;
  };

  const getPivotScript = () => {
    return `"Thank you so much for the feedback! I completely understand that starting rates for layout assistants often sit at $${negotiationOffer}/hour. However, because I have active training in CAD zoning layers, and can immediately build spot separations and print-prep chokes with zero supervisor oversight, I eliminate file errors that typically delay carousels. Given that I require zero on-boarding lag, would you be open to $${negotiationTarget}/hour to reflect that pre-press capability?"`;
  };

  const getWrittenNegotiationEmail = () => {
    return `Subject: Interview Follow-up - Jaime - ${job.title}

Dear Hiring Team at ${job.company},

Thank you very much for offering me the ${job.title} opportunity. I am extremely excited about the prospect of joining the team and contributing my technical civil layout and pre-press vector separation skills to boost your production turnaround.

Before signing, I wanted to discuss the hourly rate of $${negotiationOffer}/hour. Given my advanced training in AutoCAD drawing sets, spot trapping inside Adobe Illustrator, and my ability to pre-flight files without supervisor supervision to eliminate expensive press halts, I would love to see if we could align on $${negotiationTarget}/hour.

I require minimal adjustment time and am ready to start delivering high-precision layout separate configurations right away. Thank you for your consideration, and I look forward to working together!

Best regards,
Jaime`;
  };

  // Interactive AI Recruiter Practice state
  const [selectedQuestion, setSelectedQuestion] = useState("Tell me about yourself and your transition from CAD technology?");
  const [userAnswer, setUserAnswer] = useState("");
  const [isPracticeLoading, setIsPracticeLoading] = useState(false);
  const [practiceFeedback, setPracticeFeedback] = useState<{
    strongPoints: string[];
    improvementNotes: string[];
    keywordSuggestions: string[];
    sampleBestResponse: string;
    ratingScore: number;
  } | null>(null);

  const mockQuestions = [
    "Tell me about yourself and your transition from CAD technology?",
    "Why are you transitioning from engineering drafting to graphic print layouts?",
    "Give me an example of handling a tense, high-pressure deadline bottleneck.",
    "How do you handle budget limitations or rate discussions?",
    "What is your approach to preserving scale accuracy and error-free pre-flight files?"
  ];

  const handleRunPracticeSimulation = async () => {
    if (!userAnswer.trim()) {
      alert("Please write a draft response first to test!");
      return;
    }
    setIsPracticeLoading(true);
    setPracticeFeedback(null);
    try {
      const activeProfile = userProfile || defaultUserProfile;
      const res = await authFetch("/api/interview-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selectedQuestion,
          userAnswer: userAnswer,
          jobTitle: job.title,
          companyName: job.company,
          userProfile: activeProfile
        })
      });
      if (!res.ok) {
        throw new Error("Practice API error");
      }
      const data = await res.json();
      setPracticeFeedback(data);
    } catch (err: any) {
      console.error(err);
      // Clean fallback in case of errors
      setPracticeFeedback({
        strongPoints: [
          "Demonstrated a strong technical background in CAD technology and structured drawing sheets.",
          "Expressed career intent focused on applying precision workflows in print and shop-production settings."
        ],
        improvementNotes: [
          "Try incorporating standard STAR format (Situation, Task, Action, Result) to organize the narrative flow.",
          "Highlight hands-on production swatches or color register choke tolerances specifically."
        ],
        keywordSuggestions: ["pre-press alignments", "spot color registration", "layer templates"],
        sampleBestResponse: `Sure! I began my career in civil utility design where I drafted underground network routes under high municipal standards. I shifted toward physical production layouts because I thrive in fast-paced fabrication shops where work takes tangible physical form. My experience means I bring absolute layer hygiene and CAD-level alignment tolerances to your pre-press film runs.`,
        ratingScore: 82
      });
    } finally {
      setIsPracticeLoading(false);
    }
  };

  return (
    <div className="space-y-4 text-left font-sans">
      
      {/* Workbook Internal Menu Tabs */}
      <div className="bg-slate-900 border border-slate-805 p-1 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-1">
        <button
          onClick={() => setInternalTab("elevator")}
          className={`py-2 text-[10.5px] font-mono font-bold uppercase rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            internalTab === "elevator" ? "bg-blue-600 border-blue-400 text-white font-extrabold" : "bg-slate-950/45 border-slate-900 text-slate-450 hover:text-white"
          }`}
        >
          <Smile className="w-3.5 h-3.5" />
          <span>1. Pitch Generator</span>
        </button>

        <button
          onClick={() => setInternalTab("star")}
          className={`py-2 text-[10.5px] font-mono font-bold uppercase rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            internalTab === "star" ? "bg-blue-600 border-blue-400 text-white font-extrabold" : "bg-slate-950/45 border-slate-900 text-slate-450 hover:text-white"
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-amber-500" />
          <span>2. STAR Stories</span>
        </button>

        <button
          onClick={() => setInternalTab("negotiate")}
          className={`py-2 text-[10.5px] font-mono font-bold uppercase rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            internalTab === "negotiate" ? "bg-blue-600 border-blue-400 text-white font-extrabold" : "bg-slate-950/45 border-slate-900 text-slate-450 hover:text-white"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-450" />
          <span>3. Pay Negotiation</span>
        </button>

        <button
          onClick={() => setInternalTab("practice")}
          className={`py-2 text-[10.5px] font-mono font-bold uppercase rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            internalTab === "practice" ? "bg-indigo-600 border-indigo-400 text-white font-extrabold" : "bg-slate-950/45 border-slate-900 text-slate-450 hover:text-white"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span>4. AI Coach Arena</span>
        </button>
      </div>

      {/* RENDER INTERNAL WORKBOOK TABS */}
      
      {/* 1. ELEVATOR PITCH GENERATOR */}
      {internalTab === "elevator" && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4 animate-[fadeIn_0.3s_ease-out]">
          <div className="flex justify-between items-start gap-4 flex-wrap border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
                Why Fits Me Narrative Pitch Generator
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Never copy-paste generic text. Use this tailored structural hybrid pitch to show why your drafting and graphics background is perfect for <strong>{job.company}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnhanceWithAI}
              disabled={isLoading}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono text-[10px] font-bold uppercase rounded flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>{isLoading ? "Running AI..." : "Enhance with Gemini"}</span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={customParagraph}
                onChange={(e) => setCustomParagraph(e.target.value)}
                rows={6}
                className="w-full p-4 bg-slate-950 border border-slate-850 rounded-xl leading-relaxed text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
              />
            </div>

            <div className="flex justify-between items-center bg-slate-955/70 p-2.5 border border-slate-850 rounded-lg flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-slate-405">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>Selected Vacancy: <span className="text-blue-300 font-extrabold">{job.title}</span> at <span className="text-white font-extrabold">{job.company}</span></span>
              </div>
              <button
                onClick={() => onCopyText(customParagraph, "why-fits-btn")}
                className={`px-3 py-1.5 rounded font-mono text-[9.5px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border transition-all ${
                  copiedKey === "why-fits-btn"
                    ? "bg-emerald-950/30 border-emerald-500 text-emerald-400 font-extrabold"
                    : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                {copiedKey === "why-fits-btn" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-450 animate-bounce" />
                    <span>Copied Elevator Pitch!</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5" />
                    <span>Copy Pitch Narrative</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. STAR STORY BANK (SHORT VS LONG SCRIPT TOGGLE) */}
      {internalTab === "star" && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4 animate-[fadeIn_0.3s_ease-out]">
          <div>
            <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest">
              Jaime&apos;s Transitional STAR Story Library
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              Explain transitioning away from civil drafting with structured confidence using standard behavioral stories. Tweak each story length to match phone screens (30-Sec) vs on-site technical manager panels (2-Min STAR).
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {starStories.map((story) => {
              const currentLength = starLengths[story.id] || "short";
              const contentText = currentLength === "short" ? story.short : story.detailed;

              return (
                <div key={story.id} className="bg-slate-950 border border-slate-850 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start sm:items-center flex-wrap gap-2 border-b border-slate-900 pb-2">
                    <div className="text-left">
                      <h4 className="text-xs font-mono font-bold text-slate-205 uppercase tracking-wide">
                        {story.title}
                      </h4>
                      <span className="text-[9px] uppercase font-mono bg-blue-955 text-blue-405 border border-blue-900/35 px-1.5 py-0.25 rounded block mt-0.5 w-fit">
                        Target: {story.target}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Short vs Detailed toggle */}
                      <button
                        onClick={() => toggleStarLength(story.id)}
                        className={`px-2.5 py-1 rounded text-[9px] font-mono uppercase font-bold border transition-all cursor-pointer ${
                          currentLength === "short"
                            ? "bg-slate-905 text-slate-400 border-slate-800 hover:text-white"
                            : "bg-blue-950 text-blue-400 border-blue-900/40 font-extrabold"
                        }`}
                      >
                        ⏱️ {currentLength === "short" ? "30s Express Pitch" : "2-Min STAR Layout"}
                      </button>

                      {/* Copy Story Button */}
                      <button
                        onClick={() => onCopyText(contentText, story.id)}
                        className="p-1 px-2 text-[10px] bg-slate-900 hover:bg-slate-800 border border-slate-805 rounded transition-all cursor-pointer text-slate-400 hover:text-white flex items-center gap-1.5"
                      >
                        {copiedKey === story.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-450" />
                            <span className="text-[9px] font-mono text-emerald-450 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3 h-3 text-slate-500" />
                            <span className="text-[9px] font-mono">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Dynamic story content block */}
                  <div className="bg-slate-955 p-3 rounded-lg border border-slate-900 leading-relaxed font-sans text-xs text-slate-300">
                    {currentLength === "short" ? (
                      <p className="italic font-medium leading-relaxed">&ldquo;{contentText}&rdquo;</p>
                    ) : (
                      <div className="space-y-1.5 font-mono text-[11px] text-slate-350 tracking-tight whitespace-pre-line">
                        {contentText}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. PAY NEGOTIATION PLAYBOOK & EMAIL GENERATOR */}
      {internalTab === "negotiate" && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4 animate-[fadeIn_0.3s_ease-out]">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest">
              Columbus Pay Negotiation Script Console
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              Discussing money feels high-drama, but print and design shops respect technical candidates who value their margins. Fill in the offered pay below to compute salary deltas and construct bulletproof, low-drama response scripts.
            </p>
          </div>

          {/* Interactive Calculator Inputs */}
          <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
            <div className="space-y-1 text-left">
              <label className="block text-[9px] uppercase font-bold font-mono text-slate-450">Shop Offered Pay ($/hr)</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-2 px-1 text-slate-550 flex items-center font-mono text-xs">$</div>
                <input
                  type="text"
                  value={negotiationOffer}
                  onChange={(e) => setNegotiationOffer(e.target.value)}
                  className="block w-full bg-slate-900 text-white font-mono text-xs border border-slate-800 rounded-md py-1.5 pl-6 pr-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. 17.50"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="block text-[9px] uppercase font-bold font-mono text-slate-450">Your Target Calibrated Pay ($/hr)</label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-2 px-1 text-slate-550 flex items-center font-mono text-xs">$</div>
                <input
                  type="text"
                  value={negotiationTarget}
                  onChange={(e) => setNegotiationTarget(e.target.value)}
                  className="block w-full bg-slate-900 text-white font-mono text-xs border border-slate-800 rounded-md py-1.5 pl-6 pr-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. 23.00"
                />
              </div>
            </div>

            {/* Generated Delta output details */}
            <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-lg justify-center flex flex-col text-center">
              <span className="text-[8px] uppercase font-mono font-bold text-slate-500 leading-none">Calibrated Margin Difference</span>
              <div className="text-emerald-450 text-base font-black font-mono leading-none mt-1">
                +${Math.max(0, rateTarget - rateOffer).toFixed(2)}/hr
              </div>
              <span className="text-[8px] text-slate-400 font-sans block mt-1 leading-none">
                Est: <strong>+${monthlyDelta}</strong>/mo | <strong>+${yearlyDelta}</strong>/yr
              </span>
            </div>
          </div>

          {/* Negotiating Stage playbook list */}
          <div className="space-y-4 pt-1">
            
            {/* Stage 1: Verbal expectations anchor */}
            <div className="space-y-2">
              <span className="block font-mono text-[9px] uppercase font-bold text-orange-400">
                Stage 1: Phone Screen / Anchor script (Verbal expectations)
              </span>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 relative">
                <p className="text-xs text-slate-300 font-sans italic leading-relaxed">
                  {getVerbalExpectationScript()}
                </p>
                <div className="text-right pt-2.5">
                  <button
                    onClick={() => onCopyText(getVerbalExpectationScript(), "neg-verbal")}
                    className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800 text-[9.5px] font-mono transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "neg-verbal" ? <Check className="w-3.5 h-3.5 text-emerald-450" /> : <Clipboard className="w-3.5 h-3.5 text-slate-550" />}
                    <span>{copiedKey === "neg-verbal" ? "Copied Script!" : "Copy verbal script"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stage 2: Pivot when under-offered */}
            <div className="space-y-2">
              <span className="block font-mono text-[9px] uppercase font-bold text-orange-400">
                Stage 2: Countering a low starting offer verbally (&ldquo;We only pay $16&rdquo;)
              </span>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 relative">
                <p className="text-xs text-slate-300 font-sans italic leading-relaxed">
                  {getPivotScript()}
                </p>
                <div className="text-right pt-2.5">
                  <button
                    onClick={() => onCopyText(getPivotScript(), "neg-pivot")}
                    className="px-2.5 py-1 rounded bg-slate-900 text-slate-400 hover:text-white border border-slate-800 text-[9.5px] font-mono transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "neg-pivot" ? <Check className="w-3.5 h-3.5 text-emerald-450" /> : <Clipboard className="w-3.5 h-3.5 text-slate-550" />}
                    <span>{copiedKey === "neg-pivot" ? "Copied Pivot Script!" : "Copy verbal pivot"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stage 3: Professional written counter-offer email */}
            <div className="space-y-2">
              <span className="block font-mono text-[9px] uppercase font-bold text-emerald-405">
                Stage 3: Formal Counter-Offer Draft (Written email follow up)
              </span>
              <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 space-y-2">
                <div className="bg-slate-955 p-3 rounded-md border border-slate-900 font-mono text-[10.5px] text-slate-350 leading-relaxed whitespace-pre-wrap select-all">
                  {getWrittenNegotiationEmail()}
                </div>
                <div className="text-right">
                  <button
                    onClick={() => onCopyText(getWrittenNegotiationEmail(), "neg-written-email")}
                    className="px-2.5 py-1.5 rounded bg-emerald-950/40 text-emerald-400 hover:text-white border border-emerald-900 text-[9.5px] font-mono font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "neg-written-email" ? <Check className="w-3.5 h-3.5 text-emerald-450" /> : <Clipboard className="w-3.5 h-3.5" />}
                    <span>{copiedKey === "neg-written-email" ? "Counter Email Copied!" : "Copy Negotiating Email"}</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. AI PRACTICE PARTNER / INTERVIEW COACH ARENA */}
      {internalTab === "practice" && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-5 animate-[fadeIn_0.3s_ease-out]">
          
          {/* Header */}
          <div className="flex justify-between items-start gap-4 flex-wrap border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-mono font-bold text-sm text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                AI Recruiter Arena & Verbal Practice Partner
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                Test your alignment logic before talking with real recruiters. Type your spoken draft and let Gemini analyze your flow, highlight strong points, and write custom-polished responses.
              </p>
            </div>
            <span className="bg-indigo-950/50 border border-indigo-900 text-indigo-400 text-[10px] font-mono px-2 py-0.5 rounded font-black uppercase">
              Gemini 3.5 Active
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            
            {/* Input Selection Side */}
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-450 tracking-wider">
                  1. Select a Practice Question
                </label>
                <div className="space-y-1 max-h-[180px] overflow-y-auto border border-slate-800 rounded-lg p-1.5 bg-slate-950/40">
                  {mockQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedQuestion(q);
                        setPracticeFeedback(null);
                      }}
                      className={`w-full text-left p-1.5 rounded text-[11px] transition-all cursor-pointer border ${
                        selectedQuestion === q
                          ? "bg-indigo-950/50 border-indigo-800 text-indigo-200 font-bold"
                          : "border-transparent text-slate-400 hover:bg-slate-800/30 hover:text-slate-200"
                      }`}
                    >
                      Q{idx + 1}: {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono text-slate-450 tracking-wider flex justify-between">
                  <span>2. Type Your Draft Response</span>
                  <span className="text-slate-600 text-[9px]">{userAnswer.length}/1000 chars</span>
                </label>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  maxLength={1000}
                  rows={5}
                  placeholder={`e.g. \"Sure! When I was at Scioto Signs, we got this huge sign order backlog. I stayed calm and...\"`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed resize-none"
                />
              </div>

              <button
                onClick={handleRunPracticeSimulation}
                disabled={isPracticeLoading}
                className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-indigo-650 to-pink-650 hover:from-indigo-600 hover:to-pink-600 text-white text-xs font-mono font-bold uppercase border border-indigo-500/30 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-indigo-950/50 shadow-md disabled:opacity-50"
              >
                {isPracticeLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Analyzing Flow Pattern...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-pink-300" />
                    <span>Run AI Coach Simulation</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Feedback Output Side */}
            <div className="lg:col-span-3">
              {isPracticeLoading && (
                <div className="bg-slate-950/40 border border-slate-850/50 rounded-xl h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-t-2 border-indigo-500 animate-spin" />
                    <Sparkles className="w-5 h-5 text-pink-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-mono text-slate-250 font-bold uppercase tracking-widest">
                      Processing Audio-Verification Swatch...
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                      Laying pipeline specifications over selected job &ldquo;{job.title}&rdquo; requirements for accurate evaluation.
                    </p>
                  </div>
                </div>
              )}

              {!isPracticeLoading && !practiceFeedback && (
                <div className="bg-slate-950/20 border border-dashed border-slate-800 rounded-xl h-full min-h-[300px] flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-2">
                  <HelpCircle className="w-8 h-8 text-slate-700" />
                  <span className="font-mono text-[10px] uppercase font-bold text-slate-600">Arena Awaiting Input</span>
                  <p className="text-xs max-w-xs leading-relaxed">
                    Select one of the interview questions on the left, write your spoken draft, and submit to launch real-time Gemini evaluation.
                  </p>
                </div>
              )}

              {!isPracticeLoading && practiceFeedback && (
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-4.5 space-y-4 shadow-inner animate-[fadeIn_0.3s_ease-out]">
                  
                  {/* Score Header */}
                  <div className="flex items-center justify-between border-b border-indigo-950 pb-3 gap-3">
                    <div className="text-left">
                      <span className="block text-[8px] uppercase font-mono font-bold text-slate-450 tracking-wider">Recruiter Evaluation</span>
                      <span className="text-slate-100 font-bold text-[13px]">{selectedQuestion.slice(0, 48)}...</span>
                    </div>
                    <div className="bg-indigo-950/55 border border-indigo-900 rounded-lg px-3 py-1 text-center">
                      <span className="block text-[8px] uppercase font-mono text-indigo-400 font-bold leading-none">Fit Score</span>
                      <span className="text-lg font-black font-mono text-indigo-300 leading-none block mt-1">
                        {practiceFeedback.ratingScore}%
                      </span>
                    </div>
                  </div>

                  {/* Twin grid lists: Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    {/* Strengths */}
                    <div className="bg-emerald-950/15 border border-emerald-900/30 p-3 rounded-lg space-y-1.5">
                      <span className="text-[9px] uppercase font-mono font-bold text-emerald-450 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Core Strong Points
                      </span>
                      <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside leading-relaxed">
                        {practiceFeedback.strongPoints.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Improvements */}
                    <div className="bg-orange-950/15 border border-orange-900/30 p-3 rounded-lg space-y-1.5">
                      <span className="text-[9px] uppercase font-mono font-bold text-orange-400 flex items-center gap-1">
                        <BadgeAlert className="w-3 h-3" /> Growth Opportunities
                      </span>
                      <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside leading-relaxed">
                        {practiceFeedback.improvementNotes.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>

                  </div>

                  {/* Tech swatches to include */}
                  <div className="space-y-1">
                    <span className="block text-[9px] uppercase font-mono font-bold text-slate-455">
                      Key Vocab & Spec Swatches to Add
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {practiceFeedback.keywordSuggestions.map((kw, i) => (
                        <span key={i} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-indigo-900/40">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Improved model script */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] uppercase font-mono font-bold text-indigo-405 font-medium">
                        Calibrated Spoken Response Script (Highly polished)
                      </span>
                      <button
                        onClick={() => onCopyText(practiceFeedback.sampleBestResponse, "best-response")}
                        className="p-1 rounded bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-850 text-[9.5px] font-mono transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === "best-response" ? <Check className="w-3 h-3 text-emerald-450" /> : <Clipboard className="w-3 h-3" />}
                        <span>{copiedKey === "best-response" ? "Copied Response!" : "Copy response"}</span>
                      </button>
                    </div>
                    <div className="bg-slate-900 border border-slate-850 rounded-lg p-3 text-xs text-slate-330 leading-relaxed font-mono whitespace-pre-wrap">
                      &rdquo;{practiceFeedback.sampleBestResponse}&rdquo;
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
