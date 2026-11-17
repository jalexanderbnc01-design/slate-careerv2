import React, { useState } from "react";
import { authFetch } from "../firebase/client";
import { JobFixture, TrackerRow, UserProfile } from "../types";
import { Send, Copy, Check, MessageSquare, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";

interface MessagesTabProps {
  selectedJob: JobFixture | null;
  trackerRows: TrackerRow[];
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

export default function MessagesTab({
  selectedJob,
  trackerRows,
  onCopyText,
  copiedKey,
  userProfile
}: MessagesTabProps) {
  const [localContactName, setLocalContactName] = useState("");
  const [optimizedMessages, setOptimizedMessages] = useState<Record<string, { subject?: string; body: string }>>({});
  const [optimizingTypes, setOptimizingTypes] = useState<Record<string, boolean>>({});

  const job = selectedJob || {
    title: "",
    company: "",
    lane: "",
    skills: []
  };

  // Find related contact person, if saved in trackerRows
  const row = trackerRows.find(
    (r) => r.jobTitle.toLowerCase() === job.title.toLowerCase() && r.companyName.toLowerCase() === job.company.toLowerCase()
  );
  const contactNameVal = localContactName || row?.contactName || "Hiring Manager";
  const portfolioPieceVal = row?.portfolioPiece || "Screen-Print & Apparel Prep Deck";

  const getMessageText = (type: "outreach" | "followup" | "thc_policy") => {
    switch (type) {
      case "outreach":
        return `Subject: Application & Craft Portfolio: ${job.title} - Jaime Hernandez

Dear ${contactNameVal},

I recently applied for the ${job.title} position at ${job.company}. My professional background combines dual experience in precise CAD drafting and hands-on printing production setups (large-format vinyl, screen meshes, and pre-press prep layers).

To prove my capabilities, I've prepared my specialized "${portfolioPieceVal}" featuring registered vector separators and spot film specs, which aligns directly with your shop's operations. 

I operate with high detail accuracy and value reliable, low-drama output. I would love to connect to discuss how I can help produce high-fidelity results for your client's orders.

Sincerely,
Jaime Hernandez
(614) 255-0182 | jaime.h.columbus@gmail.com
Columbus, OH`;

      case "followup":
        return `Dear ${contactNameVal},

Hope your week is going well. I wanted to briefly follow up on my application for the ${job.title} opportunity with ${job.company}. 

I remain extremely enthusiastic about contributing my pre-press vector alignments or scale CAD sheets to your team. I appreciate how ${job.company} prioritizes high-quality workmanship in Columbus, and I'd love to assist with print runs, file audits, or customer care.

Please let me know if you would like me to resend my portfolio sheets or schedule an initial chat.

Thank you for your time,
Jaime Hernandez
(614) 255-0182 | jaime.h.columbus@gmail.com`;

      case "thc_policy":
        return `Subject: Professional Operations Inquiry: Screen Guidelines

Hello,

My name is Jaime Hernandez, and I am a detail-oriented layout specialist evaluating operational vacancies near Columbus. I am highly interested in the graphics/assembly work handled by your firm.

Prior to advancing in the process, I wanted to respectfully inquire about your pre-employment protocols or safety screenings. Does this position involve federal oversight structures or safety-sensitive protocols that exclude candidate off-duty personal cannabis wellness? 

I maintain high professional reliability and look forward to hearing from you.

Thank you,
Jaime Hernandez`;
      default:
        return "";
    }
  };

  const handleOptimizeWithAI = async (type: "outreach" | "followup" | "thc_policy") => {
    setOptimizingTypes(prev => ({ ...prev, [type]: true }));
    try {
      const activeProfile = userProfile || defaultUserProfile;
      const res = await authFetch("/api/enhance-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType: type,
          jobTitle: job.title,
          companyName: job.company,
          contactName: contactNameVal,
          portfolioPiece: portfolioPieceVal,
          userProfile: activeProfile
        })
      });
      if (!res.ok) {
        throw new Error("API error");
      }
      const data = await res.json();
      setOptimizedMessages(prev => ({
        ...prev,
        [type]: {
          subject: data.subject,
          body: data.body
        }
      }));
    } catch (err) {
      console.error(err);
      // fallback to local tag addition
      const base = getMessageText(type);
      setOptimizedMessages(prev => ({
        ...prev,
        [type]: {
          body: `[Offline Refined - Tone Optimized]
${base}

Why I require zero ramp-up time: I perform pre-flights immediately inside standard graphic layers, keeping screen tension uniform.`
        }
      }));
    } finally {
      setOptimizingTypes(prev => ({ ...prev, [type]: false }));
    }
  };

  const scripts = [
    {
      id: "recruit-out",
      type: "outreach" as const,
      badge: "1. Pitch",
      title: "Recruiter warm outreach email",
      desc: "Send this immediately after applying. It targets Jaime's CAD and printing hybrid strengths, and points directly to his tailored portfolio piece.",
    },
    {
      id: "recruit-fol",
      type: "followup" as const,
      badge: "2. Follow-Up",
      title: "Friendly application check-in",
      desc: "Send on Friday morning, 4 days after applying, to keep Jaime's profile active on the hiring coordinator's radar.",
    },
    {
      id: "recruit-thc",
      type: "thc_policy" as const,
      badge: "3. Safe Check",
      title: "Discreet Screening Policy Inquiry",
      desc: "Send anonymously, or via direct messaging, to verify if the company enforces safety-sensitive random testing protocols before committing to interviews.",
    }
  ];

  return (
    <div className="space-y-4 text-left">
      {/* Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-[fadeIn_0.3s_ease-out]">
        <div>
          <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
            Hired Mode outreach scripts
          </h3>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            These formulas replace nervous self-doubt with humble, direct, technical authority. They are dynamically populated with your active lead's details (<strong>{job.company}</strong>).
          </p>
        </div>

        {/* Dynamic Context Override */}
        <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex items-center gap-3 w-full md:w-auto">
          <div className="space-y-1">
            <span className="block text-[8px] uppercase font-bold font-mono text-slate-500">Recruiter Contact Name</span>
            <input
              type="text"
              placeholder="e.g. Marcus Clay"
              value={localContactName}
              onChange={(e) => setLocalContactName(e.target.value)}
              className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none w-44 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Grid of templates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {scripts.map((script) => {
          const bodyText = getMessageText(script.type);
          const isOptimized = !!optimizedMessages[script.type];
          const isOptimizing = !!optimizingTypes[script.type];
          
          const displayBody = isOptimized
            ? (optimizedMessages[script.type].subject
                ? `Subject: ${optimizedMessages[script.type].subject}\n\n${optimizedMessages[script.type].body}`
                : optimizedMessages[script.type].body)
            : bodyText;

          return (
            <div key={script.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-900">
                    {script.badge}
                  </span>
                  <button
                    onClick={() => handleOptimizeWithAI(script.type)}
                    disabled={isOptimizing}
                    className="text-[9.5px] font-mono font-bold text-amber-400 hover:text-amber-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isOptimizing ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-pink-400" />
                    )}
                    <span>{isOptimized ? "RE-OPTIMIZE" : "TAILOR FLOW"}</span>
                  </button>
                </div>
                <h4 className="text-xs font-bold text-slate-100 uppercase font-mono">{script.title}</h4>
                <p className="text-[10px] text-slate-400 leading-normal italic">{script.desc}</p>
                
                {/* Text render block */}
                <pre className="p-3 bg-slate-955 border border-slate-855 rounded-lg text-[10px] text-slate-300 font-mono text-left select-text max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {displayBody}
                </pre>
              </div>

              <button
                type="button"
                onClick={() => onCopyText(displayBody, script.id)}
                className={`w-full py-1.5 text-[10px] font-mono font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                  copiedKey === script.id
                    ? "bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-sm"
                    : "bg-slate-950 hover:bg-slate-850 border-slate-800 text-white"
                }`}
              >
                {copiedKey === script.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-450 animate-pulse" />
                    <span>OUTREACH COPIED!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>COPY DRAFT TEMPLATE</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
