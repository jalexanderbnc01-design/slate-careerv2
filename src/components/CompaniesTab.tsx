import React, { useState } from "react";
import { TargetCompany } from "./ColumbusJobFinder";
import { Building2, Plus, PhoneCall, Trash2, Check, Landmark, Layers } from "lucide-react";

interface CompaniesTabProps {
  companyTargets: TargetCompany[];
  onAddCompany: (co: Omit<TargetCompany, "id">) => void;
  onUpdateCompanyStatus: (id: string, status: TargetCompany["status"]) => void;
  onDeleteCompany: (id: string) => void;
}

export default function CompaniesTab({
  companyTargets,
  onAddCompany,
  onUpdateCompanyStatus,
  onDeleteCompany
}: CompaniesTabProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TargetCompany["category"]>("Print Shop");
  const [location, setLocation] = useState("Columbus, OH");
  const [contactPerson, setContactPerson] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onAddCompany({
      name,
      category,
      location,
      status: "Targeted",
      contactPerson,
      notes
    });
    setName("");
    setContactPerson("");
    setNotes("");
  };

  return (
    <div className="space-y-4 text-left">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
          Columbus company target portfolio
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          Track Columbus screen print shops, apparel printers, sign studios, 3D/VR teams, and pre-employment cannabis safe retail stores. Pitch your services directly even if they do not have active online vacancy boards listed.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Target directory column (span 2) */}
        <div className="md:col-span-2 space-y-3">
          {companyTargets.map((comp) => (
            <div key={comp.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-100 uppercase font-mono">{comp.name}</h4>
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-850">
                    {comp.category}
                  </span>
                </div>
                
                <div className="text-[11px] space-y-1 text-slate-400 font-sans">
                  <p><span className="text-slate-600 font-bold font-mono text-[9px] uppercase">Location:</span> {comp.location}</p>
                  {comp.contactPerson && <p><span className="text-slate-600 font-bold font-mono text-[9px] uppercase">Contact:</span> <span className="text-slate-305 font-mono">{comp.contactPerson}</span></p>}
                  {comp.notes && <p className="italic text-slate-500 font-sans">“{comp.notes}”</p>}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[9px] font-mono text-slate-550 font-bold uppercase">Status:</span>
                  <select
                    value={comp.status}
                    onChange={(e) => onUpdateCompanyStatus(comp.id, e.target.value as TargetCompany["status"])}
                    className="bg-slate-950 border border-slate-850 text-slate-300 rounded text-[10px] px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="Targeted">Targeted</option>
                    <option value="Contacted">Warm Outreach Complete</option>
                    <option value="App Applied">Portfolio Sent</option>
                    <option value="Interview Scheduled">Interview Slotted</option>
                    <option value="Offered">OFFERED!</option>
                    <option value="Passed">Passed</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => onDeleteCompany(comp.id)}
                className="p-1 px-2 text-slate-500 hover:text-rose-400 font-mono text-[9px] bg-slate-950 border border-slate-850 hover:border-slate-805 rounded uppercase"
                title="Remove targeted company"
              >
                Delete
              </button>
            </div>
          ))}

          {companyTargets.length === 0 && (
            <div className="p-8 text-center text-slate-500 italic font-mono bg-slate-900 border border-slate-800 rounded-xl">
              Target directory is empty. Add shops using the dashboard on the right!
            </div>
          )}
        </div>

        {/* Adding targeted company manually */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3.5">
            <h4 className="text-xs uppercase font-mono font-bold text-slate-300 tracking-wider flex items-center gap-2">
              Target Custom Shop
            </h4>
            
            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Shop / Studio Name *</label>
              <input
                type="text" required
                placeholder="e.g. Columbus Screen Works"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Specialty Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TargetCompany["category"])}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded text-xs text-white focus:outline-none font-mono"
              >
                <option value="Print Shop">Print Shop (Viny/Large)</option>
                <option value="Sign Shop">Sign Shop</option>
                <option value="Screen Printing">Screen Printing Shop</option>
                <option value="Dispensary">Dispensary (Low Drug Test)</option>
                <option value="3D Studio">3D Studio / Apparel VR</option>
                <option value="CAD Group">CAD Group drafting</option>
                <option value="Other">Other / Creative Operations</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Location *</label>
              <input
                type="text" required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Contact Name / Manager</label>
              <input
                type="text"
                placeholder="e.g. Sarah Jenkins (Lead Pre-press)"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-850 rounded text-xs text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[8px] font-bold font-mono text-slate-550 uppercase">Private notes / Shop Rig Specs</label>
              <textarea
                placeholder="e.g. Prints shirts on a M&R automatic carousel. Low drama team."
                value={notes}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded text-xs text-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold font-mono uppercase tracking-wider text-[10px] flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Target Shop</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
