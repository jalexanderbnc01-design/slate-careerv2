import React, { useState, useEffect } from "react";
import { getUserStoreValue, setUserStoreValue, useUserStoreReady } from "../utils/userStore";
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  LineChart, 
  AlertCircle, 
  CheckCircle2, 
  ArrowUpRight, 
  Coins, 
  Zap, 
  MousePointerClick,
  Clock
} from "lucide-react";

export interface SideGig {
  id: string;
  source: string; // Fiverr, Upwork, TaskRabbit, Local, Referral, etc.
  client: string;
  projectName: string;
  amount: number;
  status: "In progress" | "Pending" | "Completed" | "Paid";
  payoutDate?: string;
}

interface BridgeIncomeTabProps {
  onCopyText: (text: string, key: string) => void;
  copiedKey: string | null;
}

export default function BridgeIncomeTab({ onCopyText, copiedKey }: BridgeIncomeTabProps) {
  const storeReady = useUserStoreReady();
  const [weeklyTarget, setWeeklyTarget] = useState<number>(400); // Default $400/week for survival

  const [gigs, setGigs] = useState<SideGig[]>([
      {
        id: "gig-1",
        source: "Fiverr",
        client: "Stacey L. (Clothing brand)",
        projectName: "Logo conversion & Vector separation",
        amount: 180,
        status: "In progress"
      },
      {
        id: "gig-2",
        source: "TaskRabbit",
        client: "David K. (Grandview Hts)",
        projectName: "Local delivery & Print pickup",
        amount: 140,
        status: "In progress"
      },
      {
        id: "gig-3",
        source: "Upwork",
        client: "Vince M. (Sign Maker)",
        projectName: "Shop flyer design mockups",
        amount: 75,
        status: "Pending"
      },
      {
        id: "gig-4",
        source: "Referral",
        client: "Aunt Sarah's Bakery",
        projectName: "Bakery menu illustration prep",
        amount: 200,
        status: "Pending"
      }
    ]
  );

  useEffect(() => {
    if (!storeReady) return;
    const savedTarget = getUserStoreValue("jaime_bridge_target");
    if (savedTarget) {
      const parsed = parseInt(savedTarget, 10);
      if (!Number.isNaN(parsed)) setWeeklyTarget(parsed);
    }
    const savedGigs = getUserStoreValue("jaime_bridge_gigs");
    if (savedGigs) {
      try {
        const parsed = JSON.parse(savedGigs);
        if (Array.isArray(parsed) && parsed.length > 0) setGigs(parsed);
      } catch {
        // Keep defaults on corrupt payload
      }
    }
  }, [storeReady]);

  // Save states
  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_bridge_target", weeklyTarget.toString());
  }, [weeklyTarget, storeReady]);

  useEffect(() => {
    if (!storeReady) return;
    setUserStoreValue("jaime_bridge_gigs", JSON.stringify(gigs));
  }, [gigs, storeReady]);

  // Form states
  const [source, setSource] = useState("Fiverr");
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState<number>(100);
  const [status, setStatus] = useState<SideGig["status"]>("In progress");

  const handleAddGig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName || !client || !amount) return;

    const newG: SideGig = {
      id: "gig-" + Date.now(),
      source,
      client,
      projectName,
      amount,
      status
    };

    setGigs([newG, ...gigs]);
    setProjectName("");
    setClient("");
    setAmount(100);
  };

  const handleDeleteGig = (id: string) => {
    setGigs(gigs.filter(g => g.id !== id));
  };

  const handleUpdateStatus = (id: string, newSt: SideGig["status"]) => {
    setGigs(gigs.map(g => g.id === id ? { ...g, status: newSt } : g));
  };

  // Pace calculations: Only sum "In progress", "Paid" or "Completed" that we expect to receive this active week
  const earnedCurrent = gigs
    .filter(g => g.status === "In progress" || g.status === "Completed" || g.status === "Paid")
    .reduce((sum, g) => sum + g.amount, 0);

  const pendingCurrent = gigs
    .filter(g => g.status === "Pending")
    .reduce((sum, g) => sum + g.amount, 0);

  const gapValue = weeklyTarget - earnedCurrent;
  const isGoalMet = earnedCurrent >= weeklyTarget;

  // Recommended Best Usage suggestions based on active open work
  const getDailySuggestion = () => {
    if (gigs.filter(g => g.status === "In progress").length > 0) {
      const bestGig = gigs.find(g => g.status === "In progress" && g.source === "Fiverr") || gigs.find(g => g.status === "In progress");
      return {
        title: `Finish vector separation for: ${bestGig?.client}`,
        text: `You have open fast-payout projects active. Deliver ${bestGig?.projectName} on ${bestGig?.source} which pays an effective $90/hour and secures your immediate survival budget.`,
        action: `Complete ${bestGig?.projectName}`
      };
    }
    return {
      title: "Log prospective flyers on Craigslist/Fiverr",
      text: "No active hourly gigs are running. Send 5 cold vector design templates or checklist messages to Columbus cafes on Instagram for quick menu redraws ($75/each).",
      action: "Initiate menu sales"
    };
  };

  const dailyRec = getDailySuggestion();

  return (
    <div className="space-y-4 text-left font-sans">
      
      {/* Informative Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600/10 p-2 rounded-lg border border-emerald-500/20">
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest">
              Bridge Income & Survival Layer
            </h3>
            <p className="text-[11px] text-slate-400 leading-normal font-sans">
              Finding high-value creative layouts in Columbus takes 4 to 12 weeks. Don&apos;t apply with desperation. Secure your basic food, housing, and cannabis expenses here to remain a strategic, low-stress recruit.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Analytics Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <h4 className="font-mono font-bold text-xs uppercase text-slate-350 tracking-wider flex items-center gap-1">
            <LineChart className="w-3.5 h-3.5 text-blue-400" />
            <span>Weekly Budget Pace</span>
          </h4>

          {/* Target input */}
          <div className="space-y-1">
            <label className="block text-[8px] font-bold font-mono text-slate-500 uppercase">Weekly Target Amount ($)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-[11.5px] font-semibold">$</span>
              <input
                type="number"
                value={weeklyTarget}
                onChange={(e) => setWeeklyTarget(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-850 pl-6 pr-2.5 py-1 text-slate-200 font-mono text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1 font-mono">
            
            {/* Gauge */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between font-mono text-[10.5px]">
                <span className="text-slate-450 uppercase font-bold">Earned + Active:</span>
                <span className="text-white font-extrabold">${earnedCurrent} / ${weeklyTarget}</span>
              </div>
              <div className="w-full bg-slate-950 h-3 rounded-full border border-slate-850 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isGoalMet ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(100, (earnedCurrent / weeklyTarget) * 100)}%` }}
                />
              </div>
            </div>

            {/* Alert */}
            {isGoalMet ? (
              <div className="bg-emerald-950/20 border border-emerald-900/60 p-2.5 rounded text-[11px] leading-relaxed text-emerald-400 font-sans flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Goal Met!</strong> You cleared your ${weeklyTarget} target with ${earnedCurrent}. Rent & coffee is covered. You can reject CDL drug assays and only apply to great jobs!
                </p>
              </div>
            ) : (
              <div className="bg-blue-950/25 border border-blue-900/40 p-2.5 rounded text-[11px] leading-relaxed text-blue-300 font-sans flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 animate-pulse" />
                <p>
                  <strong>Shortfall: ${gapValue}</strong> left to hit your weekly target. Work on your active deliveries or follow up on pending design proposals.
                </p>
              </div>
            )}

            {/* Pipeline list */}
            <div className="pt-2 border-t border-slate-805/40 text-[11px] space-y-1 text-slate-400 font-sans">
              <div className="flex justify-between font-mono text-[9px] uppercase font-bold text-slate-500">
                <span>Income pipeline:</span>
                <span>Sum amount</span>
              </div>
              <div className="flex justify-between">
                <span>Active Hustles / Delivery:</span>
                <span className="text-slate-205 font-mono">${earnedCurrent}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Pending Client Approvals:</span>
                <span className="font-mono">${pendingCurrent}</span>
              </div>
            </div>
          </div>

          {/* Interactive Best Action Widget */}
          <div className="bg-gradient-to-br from-indigo-950/15 to-slate-950/40 border border-indigo-900/50 p-3 rounded-xl space-y-1.5 flex flex-col pt-2 bg-slate-950/30">
            <span className="text-[8px] font-bold font-mono text-indigo-400 uppercase tracking-widest flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400 animate-pulse" />
              Optimal hour allocation suggestions
            </span>
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-slate-200 uppercase leading-snug">{dailyRec.title}</h5>
              <p className="text-[10px] text-slate-450 leading-relaxed leading-normal font-sans">
                {dailyRec.text}
              </p>
            </div>
            
            <div className="text-[9px] font-mono text-slate-500 flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              <span>Yield suggestion: Prioritize immediate payouts</span>
            </div>
          </div>
        </div>

        {/* Gig Tracker Column */}
        <div className="md:col-span-2 space-y-3">
          
          <div className="flex justify-between items-center border-b border-slate-805 pb-1">
            <h4 className="font-mono font-bold text-xs uppercase text-slate-350 tracking-wider">
              Active Hustle Inventory ({gigs.length})
            </h4>
            <span className="text-[9.5px] font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-850 text-slate-400">
              Total pipeline value: ${earnedCurrent + pendingCurrent}
            </span>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {gigs.map((g) => (
              <div key={g.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-xs font-black text-slate-200 uppercase">{g.projectName}</span>
                    <span className="bg-slate-950 text-slate-450 border border-slate-850 text-[9px] px-1.5 py-0.5 rounded uppercase font-extrabold shrink-0">
                      {g.source}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-none">
                    Client: <span className="text-blue-300 font-mono">{g.client}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3.5 shrink-0 select-none">
                  {/* Status update widget */}
                  <div className="text-right">
                    <span className="block text-[7px] font-mono text-slate-500 font-bold uppercase mb-0.5">Project State</span>
                    <select
                      value={g.status}
                      onChange={(e) => handleUpdateStatus(g.id, e.target.value as SideGig["status"])}
                      className="bg-slate-955 border border-slate-855 text-slate-300 rounded text-[9.5px] px-1.5 py-0.5 font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="In progress">In Progress</option>
                      <option value="Pending">Proposal Pending</option>
                      <option value="Paid">Fully Paid</option>
                    </select>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 py-1.5 px-3 rounded font-mono text-center min-w-[65px]">
                    <span className="block text-[7px] text-slate-500 font-bold uppercase leading-none mb-0.5">PAYOUT</span>
                    <span className="text-xs font-bold text-emerald-400">${g.amount}</span>
                  </div>

                  <button
                    onClick={() => handleDeleteGig(g.id)}
                    className="p-1 px-1.5 text-slate-550 hover:text-rose-455 transition-colors border border-transparent rounded hover:bg-slate-950/20"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {gigs.length === 0 && (
              <div className="p-8 text-center text-slate-500 italic font-mono bg-slate-955/20 border border-slate-850 rounded-lg text-xs">
                Survival inventory is empty. Add gigs on the dashboard below to track bridge target progress!
              </div>
            )}
          </div>

          {/* Quick Add Form */}
          <form onSubmit={handleAddGig} className="bg-slate-950/40 border border-slate-850 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="space-y-0.5">
              <label className="block text-[7px] font-bold font-mono text-slate-500 uppercase">Platform / Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded font-mono text-[10.5px] text-white focus:outline-none"
              >
                <option value="Fiverr">Fiverr</option>
                <option value="TaskRabbit">TaskRabbit</option>
                <option value="Upwork">Upwork</option>
                <option value="Craigslist">Craigslist</option>
                <option value="Referral">Local Referral</option>
                <option value="Other">Other Gig</option>
              </select>
            </div>

            <div className="space-y-0.5 sm:col-span-1">
              <label className="block text-[7px] font-bold font-mono text-slate-500 uppercase">Gig / Project Name *</label>
              <input
                type="text" required
                placeholder="e.g. Logo Vector separations"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10.5px] text-white focus:outline-none"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-[7px] font-bold font-mono text-slate-500 uppercase">Client Name *</label>
              <input
                type="text" required
                placeholder="e.g. Stacey L."
                value={client}
                onChange={(e) => setClient(e.target.value)}
                className="w-full p-1.5 bg-slate-900 border border-slate-800 rounded text-[10.5px] text-white focus:outline-none"
              />
            </div>

            <div className="space-y-0.5">
              <label className="block text-[7px] font-bold font-mono text-slate-500 uppercase">Amount ($) *</label>
              <div className="flex gap-1.5">
                <input
                  type="number" required
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-2/3 p-1.5 bg-slate-900 border border-slate-800 rounded text-[10.5px] text-white font-mono focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-1/3 bg-blue-650 hover:bg-blue-550 text-white font-mono font-bold uppercase rounded text-[9px] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>

    </div>
  );
}
