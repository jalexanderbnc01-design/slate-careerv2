// Source: Google Maps Platform Code Assist
import React, { useState } from "react";
import { APIProvider, Map as GoogleMap, AdvancedMarker, Pin, InfoWindow } from "@vis.gl/react-google-maps";
import { JobFixture } from "../types";
import { MapPin, Navigation, Building2, DollarSign, ExternalLink, Layers, CheckCircle2, Copy } from "lucide-react";

export interface WalkInRouteStop {
  id: string;
  company: string;
  address: string;
  hours: string;
  target: string;
  spec: string;
  script: string;
  advice: string;
  latitude: number;
  longitude: number;
}

interface ColumbusGoogleMapProps {
  apiKey: string;
  jobs: JobFixture[];
  selectedJob: JobFixture | null;
  onSelectJob: (job: JobFixture) => void;
  onOpenJobHub?: (job: JobFixture) => void;
  routeStops?: WalkInRouteStop[];
  mode?: "jobs" | "route";
  selectedStopId?: string | null;
  onSelectStop?: (stop: WalkInRouteStop) => void;
  onSwitchToFallbackGrid?: () => void;
}

export default function ColumbusGoogleMap({
  apiKey,
  jobs,
  selectedJob,
  onSelectJob,
  onOpenJobHub,
  routeStops = [],
  mode = "jobs",
  selectedStopId,
  onSelectStop,
  onSwitchToFallbackGrid,
}: ColumbusGoogleMapProps) {
  const [activeJobInfo, setActiveJobInfo] = useState<JobFixture | null>(selectedJob);
  const [activeStopInfo, setActiveStopInfo] = useState<WalkInRouteStop | null>(null);
  const [activeLaneFilter, setActiveLaneFilter] = useState<string>("all");
  const [copiedPitch, setCopiedPitch] = useState(false);

  // Filter jobs by lane if set
  const visibleJobs = jobs.filter((j) => {
    if (activeLaneFilter === "all") return true;
    if (activeLaneFilter === "laneA") return j.lane?.includes("Lane A");
    if (activeLaneFilter === "laneB") return j.lane?.includes("Lane B");
    if (activeLaneFilter === "laneC") return j.lane?.includes("Lane C");
    if (activeLaneFilter === "laneD") return j.lane?.includes("Lane D");
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  // If no API key is set, render the setup guide with clear instructions for the Maps Demo Key
  if (!apiKey) {
    return (
      <div className="w-full h-[580px] bg-slate-950 rounded-xl border border-slate-800 p-6 flex flex-col justify-center items-center text-center space-y-4 shadow-inner">
        <div className="w-12 h-12 rounded-full bg-blue-950/60 border border-blue-800/80 flex items-center justify-center text-blue-400">
          <MapPin className="w-6 h-6" />
        </div>
        <div className="max-w-md space-y-2">
          <h4 className="text-base font-bold text-white font-sans">
            Google Maps Platform Integration Ready
          </h4>
          <p className="text-xs text-slate-350 leading-relaxed">
            The interactive Google Map with Advanced Markers, InfoWindows, and Columbus transit routes is fully wired up using modern <code className="text-blue-400">@vis.gl/react-google-maps</code>.
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-left space-y-2 text-[11px] text-slate-300">
            <span className="block font-bold text-blue-400 uppercase tracking-wider text-[10px] font-mono">
              Quickstart with Free Maps Demo Key (No Billing Setup Needed):
            </span>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>
                Open the official{" "}
                <a
                  href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 underline hover:text-blue-300 font-medium"
                >
                  Maps Demo Key Console
                </a>
              </li>
              <li>Sign in with your Google account and click to reveal your Demo Key.</li>
              <li>
                In AI Studio, open Settings &gt; Secrets and add it as:
                <code className="block mt-1 font-mono text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                  VITE_GOOGLE_MAPS_API_KEY
                </code>
              </li>
            </ol>
          </div>
        </div>

        {onSwitchToFallbackGrid && (
          <button
            onClick={onSwitchToFallbackGrid}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-855 text-slate-200 border border-slate-750 rounded-lg text-xs font-medium cursor-pointer transition-colors"
          >
            Explore Using Offline Tactical Columbus GIS Vector Grid →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col space-y-2">
      {/* Top Map Action HUD Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono font-bold text-slate-200">
            Google Maps Platform ({mode === "route" ? `${routeStops.length} Route Stops` : `${visibleJobs.length} Placements Plotted`})
          </span>
        </div>

        {mode === "jobs" && (
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "all", label: "All Lanes" },
              { id: "laneA", label: "Lane A (THC Retail)" },
              { id: "laneB", label: "Lane B (Print)" },
              { id: "laneC", label: "Lane C (3D CAD)" },
              { id: "laneD", label: "Lane D (Civil)" },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveLaneFilter(filter.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                  activeLaneFilter === filter.id
                    ? "bg-blue-600 text-white font-semibold shadow-xs"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {onSwitchToFallbackGrid && (
          <button
            onClick={onSwitchToFallbackGrid}
            className="text-[10px] text-slate-450 hover:text-slate-300 font-mono underline cursor-pointer ml-auto"
          >
            Switch to Offline GIS Grid
          </button>
        )}
      </div>

      {/* Google Map Container with Guaranteed CSS Height */}
      <div
        id="google-map-columbus-container"
        className="w-full h-[580px] rounded-xl overflow-hidden border border-slate-800 relative shadow-inner bg-slate-950"
        style={{ height: "580px", minHeight: "500px", width: "100%" }}
      >
        <APIProvider apiKey={apiKey} version="weekly">
          <GoogleMap
            defaultCenter={{ lat: 39.9612, lng: -82.9988 }}
            defaultZoom={11}
            mapId="DEMO_MAP_ID"
            gestureHandling="cooperative"
            internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
            className="w-full h-full"
            style={{ width: "100%", height: "100%" }}
          >
            {/* 1. Job Placements Markers */}
            {mode === "jobs" &&
              visibleJobs.map((j) => {
                const isSelected = selectedJob?.id === j.id;
                const pinColor = j.lane?.includes("Lane A")
                  ? "#10b981"
                  : j.lane?.includes("Lane B")
                  ? "#06b6d4"
                  : j.lane?.includes("Lane C")
                  ? "#8b5cf6"
                  : "#f59e0b";

                return (
                  <AdvancedMarker
                    key={j.id}
                    position={{ lat: j.latitude ?? 39.9612, lng: j.longitude ?? -82.9988 }}
                    onClick={() => {
                      onSelectJob(j);
                      setActiveJobInfo(j);
                    }}
                    title={`${j.title} at ${j.company}`}
                  >
                    <Pin
                      background={pinColor}
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      scale={isSelected ? 1.3 : 1.0}
                    />
                  </AdvancedMarker>
                );
              })}

            {/* 2. Walk-in Route Stop Markers */}
            {mode === "route" &&
              routeStops.map((stop, index) => {
                const isSelected = selectedStopId === stop.id;
                return (
                  <AdvancedMarker
                    key={stop.id}
                    position={{ lat: stop.latitude, lng: stop.longitude }}
                    onClick={() => {
                      setActiveStopInfo(stop);
                      if (onSelectStop) onSelectStop(stop);
                    }}
                    title={`Stop #${index + 1}: ${stop.company}`}
                  >
                    <Pin
                      background="#ea580c"
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      scale={isSelected ? 1.35 : 1.1}
                    >
                      <span className="text-[10px] font-bold text-white">#{index + 1}</span>
                    </Pin>
                  </AdvancedMarker>
                );
              })}

            {/* InfoWindow for Active Selected Job */}
            {mode === "jobs" && activeJobInfo && activeJobInfo.latitude && activeJobInfo.longitude && (
              <InfoWindow
                position={{ lat: activeJobInfo.latitude, lng: activeJobInfo.longitude }}
                onCloseClick={() => setActiveJobInfo(null)}
                pixelOffset={[0, -38]}
                maxWidth={320}
              >
                <div className="p-1 text-slate-900 font-sans text-left space-y-1.5">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {activeJobInfo.lane?.split(" — ")[0] || "Target"}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      {activeJobInfo.salary}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {activeJobInfo.title}
                    </h4>
                    <p className="text-xs text-slate-700 font-medium">
                      {activeJobInfo.company}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{activeJobInfo.location}</span>
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-600 line-clamp-2">
                    {activeJobInfo.summary}
                  </p>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                    {onOpenJobHub && (
                      <button
                        onClick={() => {
                          onOpenJobHub(activeJobInfo);
                        }}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Inspect in Job Hub
                      </button>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${activeJobInfo.company} ${activeJobInfo.location}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 underline font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Google Maps</span>
                    </a>
                  </div>
                </div>
              </InfoWindow>
            )}

            {/* InfoWindow for Active Route Stop */}
            {mode === "route" && activeStopInfo && (
              <InfoWindow
                position={{ lat: activeStopInfo.latitude, lng: activeStopInfo.longitude }}
                onCloseClick={() => setActiveStopInfo(null)}
                pixelOffset={[0, -38]}
                maxWidth={340}
              >
                <div className="p-1 text-slate-900 font-sans text-left space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">
                      Physical Drop-by Stop
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {activeStopInfo.hours}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">
                      {activeStopInfo.company}
                    </h4>
                    <p className="text-xs text-slate-700 font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{activeStopInfo.address}</span>
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      <strong>Target Person:</strong> {activeStopInfo.target}
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[10.5px] text-slate-800">
                    <span className="font-semibold block text-slate-900 text-[10px] uppercase">
                      In-Person Spoken Script:
                    </span>
                    &ldquo;{activeStopInfo.script}&rdquo;
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleCopy(activeStopInfo.script)}
                      className="px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10.5px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {copiedPitch ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPitch ? "Copied Script!" : "Copy Pitch Script"}</span>
                    </button>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        activeStopInfo.address
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-slate-600 hover:text-slate-900 flex items-center gap-1 underline font-medium"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </APIProvider>
      </div>
    </div>
  );
}
