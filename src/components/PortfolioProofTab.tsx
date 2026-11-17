import React, { useMemo, useRef, useState } from "react";
import { FileText, Download, Copy, Check, Info, UploadCloud, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getUserStoreValue,
  setUserStoreValue,
  useUserStoreReady,
} from "../utils/userStore";
import {
  deletePortfolioAsset,
  uploadPortfolioFile,
  type PortfolioAsset,
} from "../utils/portfolioStorage";

interface PortfolioProofTabProps {
  onCopyText: (text: string, key: string) => void;
  copiedKey: string | null;
  builtPortfolioFiles: string[];
  onTogglePortfolioBuilt: (filename: string) => void;
}

const PORTFOLIO_ASSETS_KEY = "portfolio_assets_v1";

function readStoredAssets(): PortfolioAsset[] {
  const raw = getUserStoreValue(PORTFOLIO_ASSETS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { assets?: PortfolioAsset[] };
    return Array.isArray(parsed.assets) ? parsed.assets : [];
  } catch {
    return [];
  }
}

export default function PortfolioProofTab({
  onCopyText,
  copiedKey,
  builtPortfolioFiles,
  onTogglePortfolioBuilt
}: PortfolioProofTabProps) {
  const { user } = useAuth();
  const storeReady = useUserStoreReady();
  const [assets, setAssets] = useState<PortfolioAsset[]>(readStoredAssets);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFilenameRef = useRef<string | null>(null);

  const assetsForFile = useMemo(() => {
    const map = new Map<string, PortfolioAsset[]>();
    for (const asset of assets) {
      const list = map.get(asset.filename) || [];
      list.push(asset);
      map.set(asset.filename, list);
    }
    return map;
  }, [assets]);

  const persistAssets = (next: PortfolioAsset[]) => {
    setAssets(next);
    setUserStoreValue(PORTFOLIO_ASSETS_KEY, JSON.stringify({ assets: next }));
  };

  const handleUploadClick = (filename: string) => {
    setUploadError(null);
    pendingFilenameRef.current = filename;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (file: File | null) => {
    const filename = pendingFilenameRef.current;
    if (!file || !filename || !user) return;
    setUploadingFor(filename);
    setUploadError(null);
    try {
      const asset = await uploadPortfolioFile(user.uid, file);
      const namedAsset: PortfolioAsset = {
        ...asset,
        filename,
      };
      persistAssets([...readStoredAssets(), namedAsset]);
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : "Upload to Cloud Storage failed."
      );
    } finally {
      setUploadingFor(null);
      pendingFilenameRef.current = null;
    }
  };

  const handleDeleteAsset = async (asset: PortfolioAsset) => {
    try {
      await deletePortfolioAsset(asset);
    } catch {
      // Keep the metadata cleanup going even if the blob is already gone
    }
    persistAssets(readStoredAssets().filter((a) => a.id !== asset.id));
  };

  const handleDownload = (filename: string) => {
    const list = assetsForFile.get(filename) || [];
    if (list.length === 0) return;
    const asset = list[list.length - 1];
    window.open(asset.downloadUrl, "_blank", "noopener,noreferrer");
  };

  const portfolios = [
    {
      lane: "Lane B — Creative Production",
      title: "Screen-Print & Apparel Prep Deck",
      filename: "jaime_apparel_vector_kit.pdf",
      description: "Separated vector layers layout, registration traps, color channels mapping, and direct plastisol cure specs.",
      useCase: "Apparel shops, sign production companies, screens fabrication workshops.",
      content: `[PORTFOLIO PREP DECK SUMMARY - FOR LANE B CREATIVE PRODUCTION]
Target File: jaime_apparel_vector_kit.pdf
Author: Jaime Hernandez

COMPONENTS OVERVIEW:
1. CUSTOM APPAREL DESIGN: Vector mockups of direct-to-garment (DTG) tees & screen carousels.
2. LAYER COLOR SEPARATIONS: Fully registered vector films on separate layers for high-contrast color meshes.
3. CHANNELS MAPPING: Plastisol ink weights, screen tensions (150-230 mesh counts), flash dry temps, and alignment marks.
4. PACKAGING SYSTEM: Die-cut sticker decals, branded neck label plates, and shipping catalogs.`
    },
    {
      lane: "Lane C — Creative Tech / 3D / AI",
      title: "3D Product Visualization Render Set",
      filename: "osiris_garment_simulation_3d.zip",
      description: "Procedural realistic texture maps, clothes wrinkles physics simulations, and Raytrace studio lighting scenes in Blender.",
      useCase: "Virtual streetwear studios, ecommerce digital mockup agencies.",
      content: `[3D VISUALIZATION MODEL DECK - FOR LANE C CREATIVE TECH]
Target File: osiris_garment_simulation_3d.zip
Author: Jaime Hernandez

COMPONENTS OVERVIEW:
1. BLENDER MESHES (.obj / .blend): High-density low-poly shirts and apparel models with realistic wrinkle physics.
2. SHADING & TEXTURING: Procedural cotton meshes, metallic screen print normal maps, and displacement modifiers.
3. STUDIO LIGHTING RIGS: Cyclic multi-point light configurations, environmental softboxes, and camera focal targets.
4. RENDERS: Beautiful photorealisticRaytrace images simulating virtual retail clothing lines.`
    },
    {
      lane: "Lane D — CAD-Adjacent Layouts",
      title: "3D CAD Exhibit Floorplans Blueprint",
      filename: "columbus_spatial_render_v4.dwg",
      description: "Architectural 1/4-inch scaled spatial mockups, interlocking trade-booth structural extrusion tolerances, and material schedule ledger.",
      useCase: "Exhibition planners, trade booths builders, modular staging, millwork fabricators.",
      content: `[3D ARCHITECTURAL / EXHIBIT BLUEPRINT DECK - FOR LANE D CAD ADJACENT]
Target File: columbus_spatial_render_v4.dwg
Author: Jaime Hernandez

COMPONENTS OVERVIEW:
1. 2D ASSEMBLY BLUEPRINTS: AutoCAD elevation models, custom woodworking millwork profiles, and scale dimensions.
2. 3D STRUCTURAL ASSEMBLIES: Modular interlocking extrusion panels, structural hardware constraints, and safety exits calculations.
3. MATERIALS SCHEDULE: Structural aluminum extrusions ledger, laminate finishes, graphic substrates sheets, and vinyl counts.
4. CNC PRE-PROCESSOR SHAPEFILES: Perfect vectors toolpaths with clean curves for router routing.`
    },
    {
      lane: "Lane A — Fast Money / Retail",
      title: "Low-Drama Operations Handbook",
      filename: "jaime_customer_experience_manifesto.pdf",
      description: "Curated customer inventory flows, POS cash-reconciliation audit sheets, and safe compliance storage guidelines.",
      useCase: "Licensed dispensaries, boutique retail storefronts, customer support teams.",
      content: `[CUSTOMER OPERATIONS SYLLABUS - FOR LANE A FAST SURVIVAL]
Target File: jaime_customer_experience_manifesto.pdf
Author: Jaime Hernandez

COMPONENTS OVERVIEW:
1. RETAIL INTAKE REGISTRATIONS: Dynamic flow patterns for state compliance credential checks.
2. STOREFRONT SCHEMATICS: Safe queue management layouts and inventory storage setups.
3. REAL-TIME AUDITING: Simple, highly reliable cash register checklists and drawer reconciliation logs.
4. SERVICE SOFT SKILLS: Problem-resolution dialogues prioritizing calm, objective client care.`
    }
  ];

  return (
    <div className="space-y-4 text-left font-sans">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
      />

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h3 className="font-mono font-bold text-sm text-slate-100 uppercase tracking-widest flex items-center gap-2">
            Portfolio Proof Match Engine
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl mt-1">
            Jaime's professional survival secret: never send a generic resume alone. Send a tailored, highly specific, concrete mockup sample sheet that matches the target vacancy's lane.
          </p>
        </div>
        <div className="bg-slate-950 p-2.5 rounded border border-slate-850 text-[11px] max-w-xs font-mono shrink-0">
          <span className="text-amber-500 font-extrabold block">HARD GATE VERIFICATION RULE:</span>
          <span className="text-slate-400 mt-1 block">Incomplete / Draft files trigger automatic application blockers. They bypass the &quot;Apply Today&quot; list into the &quot;Build First&quot; project locker.</span>
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-2 text-xs text-red-200 flex items-center gap-2">
          <Info className="w-4 h-4 text-red-400 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {portfolios.map((p, idx) => {
          const isBuilt = builtPortfolioFiles.includes(p.filename);
          const fileAssets = assetsForFile.get(p.filename) || [];

          return (
            <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 transition-all ${
              isBuilt
                ? "bg-slate-900 border-slate-800"
                : "bg-slate-950/60 border-amber-900/40 relative overflow-hidden"
            }`}>

              {/* Highlight incomplete status background pattern */}
              {!isBuilt && (
                <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-900">
                    {p.lane}
                  </span>

                  {isBuilt ? (
                    <span className="text-[9px] uppercase font-mono text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-900/60 flex items-center gap-1">
                      <span>Ready & Active</span>
                    </span>
                  ) : (
                    <span className="text-[9px] uppercase font-mono text-amber-500 font-bold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-900/60 flex items-center gap-1">
                      <span>Build Pending</span>
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-extrabold text-white mt-1 uppercase font-mono tracking-wide">{p.title}</h4>
                <p className="text-[11px] text-slate-400 leading-normal">{p.description}</p>

                <div className="space-y-1.5 pt-2 font-sans text-xs">
                  <div className="flex items-start gap-1 text-slate-350">
                    <span className="font-bold text-slate-400 uppercase text-[9px] font-mono shrink-0 pt-0.5">Best For:</span>
                    <span className="text-slate-350">{p.useCase}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-850">

                {/* Interactive Built / Incompleted toggle block */}
                <div className="flex items-center justify-between bg-slate-950 p-2.5 border border-slate-850 rounded">
                  <div className="font-mono text-xs max-w-[170px] truncate">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase">Asset FILENAME</span>
                    <span className="text-blue-300 font-bold text-[10.5px]">{p.filename}</span>
                  </div>

                  <button
                    onClick={() => onTogglePortfolioBuilt(p.filename)}
                    type="button"
                    className={`px-3 py-1 text-[10px] font-mono font-bold uppercase rounded cursor-pointer transition-all border ${
                      isBuilt
                        ? "bg-emerald-950/40 hover:bg-emerald-900/20 text-emerald-400 border-emerald-900/40"
                        : "bg-amber-900/20 hover:bg-amber-900/40 text-amber-500 border-amber-800/40 animate-pulse"
                    }`}
                  >
                    {isBuilt ? "Live" : "Build Asset"}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 border border-slate-850 rounded">
                  <div className="font-mono text-[10px] text-slate-400 min-w-0">
                    <span className="block text-[8px] text-slate-500 font-bold uppercase">Cloud Storage ({storeReady ? fileAssets.length : 0})</span>
                    <span className="text-slate-300 truncate block">
                      {fileAssets.length > 0
                        ? fileAssets.map((a) => a.filename).join(", ")
                        : "No files uploaded yet"}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={uploadingFor === p.filename}
                    onClick={() => handleUploadClick(p.filename)}
                    className="px-3 py-1 text-[10px] font-mono font-bold uppercase rounded cursor-pointer bg-blue-950/40 hover:bg-blue-900/40 text-blue-300 border border-blue-900/50 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {uploadingFor === p.filename ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>Upload</span>
                  </button>
                </div>

                {fileAssets.length > 0 && (
                  <div className="space-y-1">
                    {fileAssets.map((asset) => (
                      <div key={asset.id} className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-850 rounded px-2.5 py-1.5">
                        <span className="text-[10px] font-mono text-slate-400 truncate min-w-0">
                          {new Date(asset.uploadedAt).toLocaleString()} · {(asset.size / 1024).toFixed(0)} KB
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownload(asset.filename)}
                            className="text-[10px] font-mono text-blue-300 hover:text-blue-200 cursor-pointer flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Open</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAsset(asset)}
                            className="text-[10px] font-mono text-red-400 hover:text-red-300 cursor-pointer flex items-center gap-1"
                            aria-label={`Delete ${asset.filename}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!isBuilt}
                    onClick={() => onCopyText(p.content, `p-deck-${idx}`)}
                    className={`flex-1 py-1.5 text-[10px] font-mono font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer border transition-all ${
                      !isBuilt
                        ? "opacity-40 cursor-not-allowed bg-slate-950 border-slate-900 text-slate-650"
                        : copiedKey === `p-deck-${idx}`
                        ? "bg-emerald-950/40 border-emerald-500 text-emerald-400"
                        : "bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-300"
                    }`}
                  >
                    {copiedKey === `p-deck-${idx}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied Payload!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Spec Sheets</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={!isBuilt || fileAssets.length === 0}
                    onClick={() => handleDownload(p.filename)}
                    title={
                      fileAssets.length === 0
                        ? "Upload the real asset file first, then download it from Cloud Storage."
                        : `Download ${p.filename} from Cloud Storage`
                    }
                    className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded cursor-pointer flex items-center gap-1 border transition-all ${
                      !isBuilt || fileAssets.length === 0
                        ? "opacity-40 cursor-not-allowed bg-slate-955 border-slate-900 text-slate-650"
                        : "bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-300"
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 flex items-start gap-2 text-[11px] text-slate-400">
        <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <span>
          Uploaded proof assets (PDF, images, .dwg, .zip) are stored in Firebase Cloud Storage under your
          private <code className="text-slate-300 font-mono">users/&lt;uid&gt;/portfolio/...</code> prefix and survive
          across devices. The old simulated download alert has been retired.
        </span>
      </div>
    </div>
  );
}
