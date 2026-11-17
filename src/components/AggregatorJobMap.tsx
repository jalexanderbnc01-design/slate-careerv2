import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { JobFixture } from "../types";
import { authFetch } from "../firebase/client";
import { MapPin, Plus, Settings, Check, AlertCircle } from "lucide-react";

interface AggregatorJobMapProps {
  apiKey: string;
  apiKeyLoading?: boolean;
  jobs: JobFixture[];
  targetLocation: string;
  selectedJob: JobFixture | null;
  onSelectJob: (job: JobFixture) => void;
  onImportJob: (job: JobFixture) => void;
  onOpenSettings?: () => void;
}

interface LatLngPoint {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

const NON_MAPPABLE_TERMS = new Set([
  "",
  "remote",
  "anywhere",
  "worldwide",
  "global",
  "everywhere",
  "work from home",
  "wfh",
  "unspecified",
  "see listing",
  "n/a",
  "na",
  "none",
  "unknown",
  "united states",
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "north america",
  "europe",
  "emea",
  "apac",
  "latam",
  "canada",
  "uk",
  "united kingdom",
  "usa timezones",
  "us timezones",
]);

function cleanLocationQuery(raw?: string | null): string {
  if (!raw) return "";
  let text = raw.trim();
  if (!text) return "";

  // Handle "Remote (Austin, TX)" vs "Remote (USA)" / "Remote (Worldwide)"
  const remoteParenMatch = text.match(/^remote\s*\(([^)]+)\)$/i);
  if (remoteParenMatch) {
    text = remoteParenMatch[1].trim();
  }

  // Strip work-mode suffixes like "(Hybrid)", "(Remote)", "(On-site)"
  text = text
    .replace(/\s*\((hybrid|remote|on-site|onsite|in-person|flexible)\)\s*/gi, " ")
    .replace(/^(remote|hybrid)\s*[-–/:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const lower = text.toLowerCase();
  if (NON_MAPPABLE_TERMS.has(lower)) return "";
  if (lower.includes("timezone")) return "";

  // Reject pure multi-country/region lists like "USA, Canada" or "US / Canada"
  const parts = lower
    .split(/[,/|]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 0 && parts.every((p) => NON_MAPPABLE_TERMS.has(p))) {
    return "";
  }

  return text;
}

function getTargetCenterQuery(targetLocation: string): string {
  const cleaned = cleanLocationQuery(targetLocation);
  return cleaned || "Columbus, OH";
}

function getPinColor(job: JobFixture): string {
  if (job.lane?.includes("Lane A")) return "#10b981";
  if (job.lane?.includes("Lane B")) return "#06b6d4";
  if (job.lane?.includes("Lane C")) return "#8b5cf6";
  if (job.lane?.includes("Lane D")) return "#f59e0b";
  return "#3b82f6";
}

function MapCenterController({ center }: { center: LatLngPoint | null }) {
  const map = useMap();
  const lastAppliedRef = useRef<string>("");

  useEffect(() => {
    if (!map || !center) return;
    const sig = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    if (lastAppliedRef.current === sig) return;
    lastAppliedRef.current = sig;
    map.panTo({ lat: center.lat, lng: center.lng });
  }, [map, center]);

  return null;
}

interface JobMarkerItemProps {
  job: JobFixture;
  position: { lat: number; lng: number };
  isSelected: boolean;
  isInfoOpen: boolean;
  isImported: boolean;
  onMarkerClick: () => void;
  onCloseInfo: () => void;
  onImportTarget: () => void;
}

function JobMarkerItem({
  job,
  position,
  isSelected,
  isInfoOpen,
  isImported,
  onMarkerClick,
  onCloseInfo,
  onImportTarget,
}: JobMarkerItemProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        onClick={onMarkerClick}
        title={`${job.title} — ${job.company}`}
      >
        <Pin
          background={getPinColor(job)}
          borderColor={isSelected ? "#f97316" : "#ffffff"}
          glyphColor="#ffffff"
          scale={isSelected ? 1.25 : 1.0}
        />
      </AdvancedMarker>

      {isInfoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={onCloseInfo} maxWidth={280}>
          <div className="p-1 text-slate-900 font-sans text-left space-y-2 min-w-[200px]">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-blue-700 leading-tight">
                {job.company}
              </p>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">
                {job.title}
              </h4>
            </div>

            <div className="space-y-1 text-xs border-t border-slate-200 pt-1.5">
              <div className="font-semibold text-emerald-700 font-mono">
                {job.salary || "Compensation listed on source"}
              </div>
              {job.location && (
                <div className="text-[11px] text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{job.location}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onImportTarget}
              className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isImported ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isImported ? "Imported Target" : "Import Target"}</span>
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export default function AggregatorJobMap({
  apiKey,
  apiKeyLoading = false,
  jobs,
  targetLocation,
  selectedJob,
  onSelectJob,
  onImportJob,
  onOpenSettings,
}: AggregatorJobMapProps) {
  const [coordsByAddress, setCoordsByAddress] = useState<Record<string, LatLngPoint | null>>({});
  const [debouncedCenterQuery, setDebouncedCenterQuery] = useState<string>(() =>
    getTargetCenterQuery(targetLocation)
  );
  const [activeInfoJobId, setActiveInfoJobId] = useState<string | null>(null);
  const [recentlyImportedId, setRecentlyImportedId] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [showAllUnmapped, setShowAllUnmapped] = useState(false);

  // Debounce Target Settings "Coordinates / Location" edits so typing doesn't spam geocoding
  useEffect(() => {
    const nextQuery = getTargetCenterQuery(targetLocation);
    const timer = window.setTimeout(() => {
      setDebouncedCenterQuery(nextQuery);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [targetLocation]);

  // Identify candidate geocode queries for jobs that don't already have coordinates
  const jobLocationInfo = useMemo(() => {
    return jobs.map((job) => {
      const hasRawCoords =
        typeof job.latitude === "number" &&
        Number.isFinite(job.latitude) &&
        typeof job.longitude === "number" &&
        Number.isFinite(job.longitude);
      const query = hasRawCoords ? "" : cleanLocationQuery(job.location);
      return { job, hasRawCoords, query };
    });
  }, [jobs]);

  // Fetch geocoded coordinates from server proxy for uncached center & job addresses
  useEffect(() => {
    if (!apiKey) return;

    const pendingSet: Record<string, true> = {};
    if (debouncedCenterQuery && !(debouncedCenterQuery in coordsByAddress)) {
      pendingSet[debouncedCenterQuery] = true;
    }
    for (const item of jobLocationInfo) {
      if (!item.hasRawCoords && item.query && !(item.query in coordsByAddress)) {
        pendingSet[item.query] = true;
      }
    }

    const addresses = Object.keys(pendingSet);
    if (addresses.length === 0) return;

    let cancelled = false;

    const runGeocode = async () => {
      try {
        const res = await authFetch("/api/maps/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addresses }),
        });

        const payload = (await res.json().catch(() => ({}))) as any;

        if (res.status === 429 || payload?.error?.status === "RESOURCE_EXHAUSTED") {
          window.dispatchEvent(new CustomEvent("gmp-quota-exceeded"));
          if (!cancelled) {
            setGeocodeError("Google Maps geocoding quota reached.");
          }
          return;
        }

        if (!res.ok) {
          if (!cancelled) {
            setGeocodeError(payload?.error || "Unable to geocode locations.");
          }
          return;
        }

        if (!cancelled && payload?.results && typeof payload.results === "object") {
          setGeocodeError(null);
          setCoordsByAddress((prev) => ({
            ...prev,
            ...payload.results,
          }));
        }
      } catch {
        if (!cancelled) {
          setGeocodeError("Unable to look up map coordinates right now.");
        }
      }
    };

    runGeocode();

    return () => {
      cancelled = true;
    };
  }, [apiKey, debouncedCenterQuery, jobLocationInfo, coordsByAddress]);

  const mapCenter: LatLngPoint | null = useMemo(() => {
    const resolved = coordsByAddress[debouncedCenterQuery];
    if (resolved) return resolved;
    return null;
  }, [coordsByAddress, debouncedCenterQuery]);

  // Partition jobs into mappable points vs. "Not on map."
  const { mappedJobs, unmappedJobs } = useMemo(() => {
    const mapped: Array<{ job: JobFixture; position: { lat: number; lng: number } }> = [];
    const unmapped: JobFixture[] = [];
    const coordCounts: Record<string, number> = {};

    for (const item of jobLocationInfo) {
      const { job, hasRawCoords, query } = item;

      let baseLat: number | null = null;
      let baseLng: number | null = null;

      if (hasRawCoords && typeof job.latitude === "number" && typeof job.longitude === "number") {
        baseLat = job.latitude;
        baseLng = job.longitude;
      } else if (query) {
        const geocoded = coordsByAddress[query];
        if (geocoded) {
          baseLat = geocoded.lat;
          baseLng = geocoded.lng;
        } else if (query in coordsByAddress && geocoded === null) {
          // Geocoding returned zero results for this string
          unmapped.push(job);
          continue;
        } else {
          // Still awaiting geocode result; avoid placing in "Not on map" prematurely
          continue;
        }
      } else {
        unmapped.push(job);
        continue;
      }

      if (baseLat !== null && baseLng !== null) {
        // Slightly spread markers that share identical city-level coordinates so every job pin is visible and clickable
        const bucketKey = `${baseLat.toFixed(4)},${baseLng.toFixed(4)}`;
        const count = coordCounts[bucketKey] || 0;
        coordCounts[bucketKey] = count + 1;

        let lat = baseLat;
        let lng = baseLng;
        if (count > 0) {
          const angle = count * 2.39996; // Golden angle spread
          const radius = 0.0022 * Math.sqrt(count);
          lat = baseLat + Math.sin(angle) * radius;
          lng = baseLng + Math.cos(angle) * radius;
        }

        mapped.push({ job, position: { lat, lng } });
      }
    }

    return { mappedJobs: mapped, unmappedJobs: unmapped };
  }, [jobLocationInfo, coordsByAddress]);

  // Close InfoWindow if the active job is removed from the current jobs list
  useEffect(() => {
    if (activeInfoJobId && !jobs.some((j) => j.id === activeInfoJobId)) {
      setActiveInfoJobId(null);
    }
  }, [jobs, activeInfoJobId]);

  const displayedUnmapped = showAllUnmapped ? unmappedJobs : unmappedJobs.slice(0, 6);

  return (
    <section
      aria-label="Job Locations Map"
      className="w-full min-w-0 space-y-3"
    >
      {/* Top Map Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-md w-full min-w-0">
        {/* Compact Map Bar */}
        <div className="px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-100 truncate">
              Job Locations Map
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              · Centered on {debouncedCenterQuery}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0">
            <span className="text-emerald-400 font-semibold">{mappedJobs.length} on map</span>
            <span>·</span>
            <span>{unmappedJobs.length} not on map</span>
          </div>
        </div>

        {/* Map Canvas with Guaranteed Height */}
        {apiKeyLoading ? (
          <div className="w-full h-[300px] sm:h-[360px] lg:h-[400px] bg-slate-950 flex items-center justify-center text-xs text-slate-400">
            Loading Google Maps configuration...
          </div>
        ) : !apiKey ? (
          <div className="w-full h-[260px] sm:h-[300px] bg-slate-950 p-6 flex flex-col items-center justify-center text-center gap-3">
            <MapPin className="w-6 h-6 text-blue-400" />
            <div className="max-w-md space-y-1.5">
              <h3 className="text-sm font-semibold text-white">
                Google Maps API Key Required
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Add a Google Maps Platform key in Settings or via environment variables (<code className="text-blue-400 font-mono">GOOGLE_MAPS_PLATFORM_KEY</code> / <code className="text-blue-400 font-mono">VITE_GOOGLE_MAPS_API_KEY</code>) to display job pins.
              </p>
            </div>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Open Settings</span>
              </button>
            )}
          </div>
        ) : (
          <div
            className="w-full h-[300px] sm:h-[360px] lg:h-[400px] relative bg-slate-950"
            style={{ width: "100%", minHeight: "280px" }}
          >
            <APIProvider apiKey={apiKey} libraries={["marker"]} language="en" region="US">
              <GoogleMap
                defaultCenter={{ lat: 39.9612, lng: -82.9988 }}
                defaultZoom={10}
                mapId="DEMO_MAP_ID"
                gestureHandling="cooperative"
                internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                className="w-full h-full"
                style={{ width: "100%", height: "100%" }}
              >
                <MapCenterController center={mapCenter} />

                {mappedJobs.map(({ job, position }) => (
                  <JobMarkerItem
                    key={job.id}
                    job={job}
                    position={position}
                    isSelected={selectedJob?.id === job.id}
                    isInfoOpen={activeInfoJobId === job.id}
                    isImported={recentlyImportedId === job.id}
                    onMarkerClick={() => {
                      onSelectJob(job);
                      setActiveInfoJobId(job.id);
                    }}
                    onCloseInfo={() => setActiveInfoJobId(null)}
                    onImportTarget={() => {
                      onImportJob(job);
                      setRecentlyImportedId(job.id);
                      window.setTimeout(() => {
                        setRecentlyImportedId((cur) => (cur === job.id ? null : cur));
                      }, 1800);
                    }}
                  />
                ))}
              </GoogleMap>
            </APIProvider>
          </div>
        )}

        {geocodeError && (
          <div className="px-3.5 py-2 bg-amber-950/30 border-t border-amber-800/40 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{geocodeError}</span>
          </div>
        )}
      </div>

      {/* Short Section Below Map: "Not on map." */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5 w-full min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-slate-200 tracking-wide">
            Not on map.
            <span className="ml-2 font-mono font-normal text-slate-400">
              ({unmappedJobs.length})
            </span>
          </h3>
          {unmappedJobs.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllUnmapped((v) => !v)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
            >
              {showAllUnmapped ? "Show fewer" : `Show all (${unmappedJobs.length})`}
            </button>
          )}
        </div>

        {unmappedJobs.length === 0 ? (
          <p className="text-xs text-slate-400">
            {jobs.length === 0
              ? "No jobs loaded in the Live Job Search Aggregator yet."
              : "All current jobs have a mappable location."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {displayedUnmapped.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => onSelectJob(job)}
                  className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer min-w-0 ${
                    isSelected
                      ? "bg-slate-800 border-blue-500/70 text-white"
                      : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {job.title}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {job.company} · {job.location || "No location"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
