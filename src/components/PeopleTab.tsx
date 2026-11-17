import React, { useState, useEffect } from "react";
import { getUserStoreValue, setUserStoreValue, useUserStoreReady } from "../utils/userStore";
import { 
  Users, 
  Plus, 
  Trash2, 
  UserPlus, 
  Send, 
  Copy, 
  Check, 
  Coffee, 
  Flame, 
  Linkedin, 
  Instagram, 
  Mail, 
  MapPin, 
  HelpCircle,
  Clock,
  Sparkles,
  Link
} from "lucide-react";

export interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  source: "LinkedIn" | "Walk-in" | "Event" | "Instagram" | "Referral" | "Cold Email";
  lastContact: string; // YYYY-MM-DD
  warmth: "Cold" | "Warm" | "Hot";
  nextAction: string;
  notes: string;
}

interface PeopleTabProps {
  onCopyText: (text: string, key: string) => void;
  copiedKey: string | null;
}

export default function PeopleTab({ onCopyText, copiedKey }: PeopleTabProps) {
  const storeReady = useUserStoreReady();
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    if (!storeReady) return;
    const saved = getUserStoreValue("jaime_contacts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setContacts(parsed);
      } catch {
        // Keep defaults on corrupt payload
      }
    }
  }, [storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_contacts", JSON.stringify(contacts));
  }, [contacts, storeReady]);

  // Form states
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState<Contact["source"]>("LinkedIn");
  const [lastContact, setLastContact] = useState("2026-06-04");
  const [warmth, setWarmth] = useState<Contact["warmth"]>("Warm");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");

  // Direct outreach coach states
  const [selectedContactId, setSelectedContactId] = useState<string>("con-1");
  const [coachingChannel, setCoachingChannel] = useState<"LinkedIn" | "Instagram" | "Inperson" | "Email">("Instagram");
  const [generatedPitch, setGeneratedPitch] = useState("");

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !company) return;

    const newC: Contact = {
      id: "con-" + Date.now(),
      name,
      company,
      role: role || "Manager / Associate",
      source,
      lastContact,
      warmth,
      nextAction: nextAction || "None scheduled",
      notes
    };

    setContacts([newC, ...contacts]);
    setName("");
    setCompany("");
    setRole("");
    setNextAction("");
    setNotes("");
  };

  const handleDeleteContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
  };

  const getSourceIcon = (src: Contact["source"]) => {
    switch (src) {
      case "LinkedIn": return <Linkedin className="w-3.5 h-3.5 text-blue-400" />;
      case "Instagram": return <Instagram className="w-3.5 h-3.5 text-pink-400" />;
      case "Cold Email": return <Mail className="w-3.5 h-3.5 text-red-400" />;
      case "Walk-in": return <MapPin className="w-3.5 h-3.5 text-teal-400" />;
      default: return <Link className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getWarmthBadge = (w: Contact["warmth"]) => {
    switch (w) {
      case "Hot":
        return (
          <span className="bg-red-950/40 text-red-400 border border-red-900/60 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <Flame className="w-3 h-3 text-red-400 animate-pulse" />
            HOT LEAD
          </span>
        );
      case "Warm":
        return (
          <span className="bg-blue-950/40 text-blue-400 border border-blue-900/60 text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <Coffee className="w-3 h-3 text-blue-400" />
            WARM CONTACT
          </span>
        );
      default:
        return (
          <span className="bg-slate-950/60 text-slate-400 border border-slate-850 text-[9px] font-bold px-2 py-0.5 rounded">
            COLD DISCOVERY
          </span>
        );
    }
  };

  // Generate Bespoke Low-Drama Pitch Templates
  const handleGenerateCoachPitch = () => {
    const contact = contacts.find(c => c.id === selectedContactId);
    if (!contact) return;

    let text = "";
    if (coachingChannel === "Instagram") {
      text = `Hey ${contact.name}! Love the custom print shop posts you guys are sharing at ${contact.company}. I'm a Columbus-local pre-press and vector print setup guy (with a technical background in AutoCAD division drawings). I specialize in prepping low-drama screen films and print separated layers in Illustrator so presses run flawlessly. Do you guys ever use freelance support or extra hands during busy order rushes? Would love to drop off my apparel toolkit!`;
    } else if (coachingChannel === "LinkedIn") {
      text = `Hello ${contact.name},\n\nI noticed your pre-press and workspace direction at ${contact.company}. I am a Columbus local focusing on vector graphics prep and sign design layout. My unique edge is transitioning high-status civil engineering drafting accuracy into physical print production sheets (crop marks, trap registrations, Spot color separation). I require near-zero onboarding to assist your creative team. If you are open to it, I would appreciate a brief 5-minute coffee chat or call to learn more about your local pipeline. Thanks for your time!\n\nBest,\nJaime Hernandez`;
    } else if (coachingChannel === "Inperson") {
      text = `(Walk-in intro Script, relaxed stance, portfolio in hand):\n"Hi there! My name is Jaime. I'm a local print graphics technician. I design detailed spot color films, vector alignments and custom decals. I was driving through Franklinton/Dublin and wanted to drop off a sample shirt and high-registration layout guide for the manager to glance at. My file setups require zero cleanup and save sign shops a lot of press-time. Who handles pre-press operations here?"`;
    } else {
      // Email
      text = `Subject: Quick inquiry: Low-drama pre-press and vector support / Jaime Hernandez\n\nDear ${contact.name},\n\nI hope this email finds you well. I am a Columbus-local print production artist and sign designer specializing in high-registration vector pre-flighting.\n\nWith a robust background scaling civil drafting files, I ensure Illustrator spot channels, trapping separations, and complex vector nodes are perfectly registered. My physical setups eliminate shop printing errors before screens even get burned.\n\nI have attached my Screen-Print Apparel Vector Prep Deck for ${contact.company} to review. I am fully drug-screen compliant, local, and available for flexible gig or full-time roles starting immediately.\n\nCould we jump on a 5-minute phone call to see if my custom files can free up your production crew?\n\nSincerely,\nJaime Hernandez\nColumbus, OH | jaime.design`;
    }
    setGeneratedPitch(text);
  };

  useEffect(() => {
    handleGenerateCoachPitch();
  }, [selectedContactId, coachingChannel, contacts]);

  return (
    <div className="space-y-4 text-left font-sans">
      
      {/* Informative Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600/10 p-2 rounded-lg border border-blue-500/20">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest">
              The Human Pipeline & Outreach CRM
            </h3>
            <p className="text-[11px] text-slate-400 font-sans leading-normal">
              Continuous direct outreach is the absolute highest-ROI action in local print design loops. Over 70% of sign shops hire via DMs or physical drops before writing job boards. Use this CRM to manage relationships.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Contact List Column */}
        <div className="md:col-span-2 space-y-3">
          
          {/* Quick Stats bar */}
          <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 font-bold">OUTREACH VELOCITY:</span>
            <div className="flex gap-4">
              <span className="text-red-400 font-bold">Hot Leads: {contacts.filter(c => c.warmth === "Hot").length}</span>
              <span className="text-blue-400 font-bold">Warm Contacts: {contacts.filter(c => c.warmth === "Warm").length}</span>
              <span className="text-slate-500 font-bold">Cold Leads: {contacts.filter(c => c.warmth === "Cold").length}</span>
            </div>
          </div>

          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {contacts.map((c) => (
              <div 
                key={c.id} 
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 bg-slate-900/60 hover:bg-slate-850 ${
                  selectedContactId === c.id ? "border-blue-500 bg-slate-850/80 shadow" : "border-slate-805"
                }`}
                onClick={() => setSelectedContactId(c.id)}
              >
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-extrabold text-slate-100 tracking-wide font-mono uppercase">{c.name}</h4>
                      {getWarmthBadge(c.warmth)}
                    </div>
                    <p className="text-xs text-slate-350">
                      <strong>{c.role}</strong> at <span className="text-blue-300 font-bold font-mono text-[11px]">{c.company}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-slate-950/70 py-1 px-2.5 rounded border border-slate-850 font-mono text-[10px] text-slate-400">
                    {getSourceIcon(c.source)}
                    <span className="uppercase">{c.source}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400 space-y-1 font-sans border-t border-slate-850/50 pt-2 pb-1">
                  {c.notes && <p className="text-slate-450 leading-relaxed"><strong className="text-slate-500 font-mono text-[10px]">NOTES:</strong> “{c.notes}”</p>}
                  <p className="text-[11px] text-amber-500 font-medium font-mono flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Next outreach action: <strong>{c.nextAction}</strong></span>
                  </p>
                </div>

                <div className="flex justify-between items-center border-t border-slate-850/30 pt-2">
                  <span className="text-[9.5px] font-mono text-slate-550">Last Contact: {c.lastContact}</span>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoachingChannel(c.source === "Instagram"? "Instagram" : c.source === "Walk-in" ? "Inperson" : "LinkedIn");
                        setSelectedContactId(c.id);
                      }}
                      className="text-[9.5px] font-mono font-bold bg-blue-950/50 hover:bg-blue-900 border border-blue-900 text-blue-400 px-3 py-1 rounded cursor-pointer"
                    >
                      Draft Pitch
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteContact(c.id);
                      }}
                      className="text-slate-500 hover:text-rose-450 p-1 rounded"
                      title="Delete connection record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {contacts.length === 0 && (
              <div className="p-8 text-center text-slate-500 italic font-mono bg-slate-950/20 border border-slate-850 rounded-xl">
                No local network connections logged yet. Add recruiters or designers using the form on the right!
              </div>
            )}
          </div>
        </div>

        {/* Action Panel Column */}
        <div className="space-y-4">
          
          {/* Quick Pitch Generator */}
          {contacts.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 shadow">
              <h4 className="text-xs uppercase font-mono font-bold text-slate-350 tracking-wider flex items-center gap-1.5 border-b border-slate-805 pb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Transitional Pitch Generator</span>
              </h4>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="block text-[8px] font-semibold font-mono text-slate-500 uppercase">Channel Medium</label>
                  <div className="grid grid-cols-4 gap-1 text-[9.5px] font-mono text-center">
                    {(["Instagram", "LinkedIn", "Inperson", "Email"] as const).map((channel) => (
                      <button
                        key={channel}
                        onClick={() => setCoachingChannel(channel)}
                        className={`py-1.5 rounded border transition-all cursor-pointer ${
                          coachingChannel === channel
                            ? "bg-blue-950 text-blue-400 border-blue-800 font-extrabold"
                            : "bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {channel === "Instagram" && "IG DM"}
                        {channel === "LinkedIn" && "In message"}
                        {channel === "Inperson" && "Drop script"}
                        {channel === "Email" && "Email"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-2 leading-relaxed">
                  <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
                    <span>COACHING CONTEXT:</span>
                    <span className="text-slate-350 text-[10px] font-extrabold">({contacts.find(c => c.id === selectedContactId)?.name})</span>
                  </div>
                  <textarea
                    readOnly
                    value={generatedPitch}
                    rows={8}
                    className="w-full bg-transparent border-0 resize-none text-[10.5px] font-mono text-slate-300 focus:ring-0 leading-relaxed focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => onCopyText(generatedPitch, "pitch-generator-btn")}
                  className={`w-full py-1.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border transition-all ${
                    copiedKey === "pitch-generator-btn"
                      ? "bg-emerald-950/30 border-emerald-500 text-emerald-400"
                      : "bg-blue-600 border-blue-400 text-white hover:bg-blue-500"
                  }`}
                >
                  {copiedKey === "pitch-generator-btn" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Template Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Pitch Template</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Add Connection Form */}
          <form onSubmit={handleAddContact} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-300 tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Add Columbus Connection</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Name *</label>
                <input
                  type="text" required
                  placeholder="e.g. Sarah J."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-955/50 border border-slate-850 rounded text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Company Name *</label>
                <input
                  type="text" required
                  placeholder="e.g. Buckeyes Signs"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-955/50 border border-slate-850 rounded text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Role / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Designer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-955/50 border border-slate-850 rounded text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Outreach Channel</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as Contact["source"])}
                  className="w-full px-2 py-1.5 bg-slate-955/50 border border-slate-850 rounded text-xs text-white font-mono focus:outline-none"
                >
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Instagram">Instagram DM</option>
                  <option value="Walk-in">Walk-in Visit</option>
                  <option value="Cold Email">Cold Email</option>
                  <option value="Event">Event Mixer</option>
                  <option value="Referral">Friend Referral</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Warmth Rank</label>
                <select
                  value={warmth}
                  onChange={(e) => setWarmth(e.target.value as Contact["warmth"])}
                  className="w-full px-2 py-1.5 bg-slate-955/50 border border-slate-850 rounded text-xs text-white font-mono focus:outline-none"
                >
                  <option value="Hot">Hot (Active Response)</option>
                  <option value="Warm">Warm (Friendly/Intro'd)</option>
                  <option value="Cold">Cold (Discovered Only)</option>
                </select>
              </div>

              <div className="space-y-1 font-mono">
                <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Last Encounter</label>
                <input
                  type="date"
                  value={lastContact}
                  onChange={(e) => setLastContact(e.target.value)}
                  className="w-full px-1.5 py-1 bg-slate-955/50 border border-slate-850 rounded text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Next Action</label>
              <input
                type="text"
                placeholder="e.g. DM layout sample file on Friday"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-955/50 border border-slate-850 rounded text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Details / Bio Notes</label>
              <textarea
                placeholder="Met on site. Knows local screen setup. Low drama."
                value={notes}
                rows={2}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-955/50 border border-slate-850 rounded text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold font-mono uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add CRM Connection</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
