"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
  Plus,
  Minus,
  Map as MapIcon,
  Satellite,
  Crosshair,
  Layers,
  Check,
} from "lucide-react";
import L from "leaflet";
import { useUi } from "@/components/layout/ui-context";

export function MapControls({
  map,
  mapType,
  onMapTypeChange,
}: {
  map: L.Map | null;
  mapType: "map" | "satellite";
  onMapTypeChange: (t: "map" | "satellite") => void;
}) {
  const { theme } = useUi();
  const [showLayers, setShowLayers] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);

  const recenter = useCallback(() => {
    map?.flyTo([22.0, 78.0], 5, { duration: 0.8 });
  }, [map]);

  const isDark = theme === "dark";

  const handleMapTypeChange = (type: "map" | "satellite") => {
    onMapTypeChange(type);
    setShowLayers(false);
  };


  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (layersRef.current && !layersRef.current.contains(e.target as Node)) {
        setShowLayers(false);
      }
    }
    if (showLayers) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showLayers]);

  return (
    <div
      ref={layersRef}
      className="absolute top-20 left-4 z-[5000] flex flex-col items-start"
    >
      {/* Main Controls */}
      <div
        className={`flex flex-col rounded-xl overflow-hidden border backdrop-blur-xl transition-colors ${
          isDark
            ? "border-white/10 bg-[#0f172a]/90"
            : "border-slate-200 bg-white/90"
        }`}
      >
        <button
          type="button"
          onClick={recenter}
          title="Recenter map"
          aria-label="Recenter map"
          className={`w-10 h-10 flex items-center justify-center active:scale-90 transition-transform duration-150 cursor-pointer ${
            isDark
              ? "text-slate-400 hover:text-white hover:bg-white/10"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Crosshair className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>

        <div className={`h-px ${isDark ? "bg-white/8" : "bg-slate-100"}`} />

        <button
          type="button"
          onClick={() => map?.zoomIn()}
          title="Zoom in"
          aria-label="Zoom in"
          className={`w-10 h-10 flex items-center justify-center active:scale-90 transition-transform duration-150 cursor-pointer ${
            isDark
              ? "text-slate-400 hover:text-white hover:bg-white/10"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>

        <div className={`h-px ${isDark ? "bg-white/8" : "bg-slate-100"}`} />

        <button
          type="button"
          onClick={() => map?.zoomOut()}
          title="Zoom out"
          aria-label="Zoom out"
          className={`w-10 h-10 flex items-center justify-center active:scale-90 transition-transform duration-150 cursor-pointer ${
            isDark
              ? "text-slate-400 hover:text-white hover:bg-white/10"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Minus className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>

        <div className={`h-px ${isDark ? "bg-white/8" : "bg-slate-100"}`} />

        <button
          type="button"
          onClick={() => setShowLayers((v) => !v)}
          title="Layers"
          aria-label="Layers"
          className={`w-10 h-10 flex items-center justify-center active:scale-90 transition-transform duration-150 cursor-pointer ${
            showLayers
              ? isDark
                ? "bg-white/15 text-white"
                : "bg-slate-200 text-slate-900"
              : isDark
                ? "text-slate-400 hover:text-white hover:bg-white/10"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Layers className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>
      </div>

      {/* Layers Panel — absolute, no layout impact when closed */}
      <div className="relative w-full">
        <div
          className={`absolute top-1 left-0 origin-top-left transition-all duration-150 ease-out ${
            showLayers
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 -translate-y-1 pointer-events-none"
          }`}
        >
          <div
            className={`w-44 rounded-lg border shadow-xl backdrop-blur-xl p-1 ${
              isDark
                ? "border-white/10 bg-[#0f172a]/95"
                : "border-slate-200 bg-white/95"
            }`}
          >
          {/* Base Layers */}
          <div className="px-2.5 py-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Base Map
            </span>
          </div>

          <button
            onClick={() => handleMapTypeChange("map")}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors duration-150 group ${
              mapType === "map"
                ? isDark
                  ? "bg-white/10 text-white"
                  : "bg-slate-100 text-slate-900"
                : isDark
                  ? "hover:bg-white/5 text-slate-300"
                  : "hover:bg-slate-50 text-slate-600"
            }`}
          >
            <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${mapType === "map" ? (isDark ? "bg-white/10" : "bg-white border border-slate-200") : (isDark ? "bg-white/5" : "bg-slate-100 border border-slate-200")}`}>
              <MapIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            </div>
            <div className="text-[11px] font-medium leading-tight">Map</div>
            {mapType === "map" && (
              <Check className="h-3 w-3 text-emerald-400 shrink-0 ml-auto" strokeWidth={2.5} />
            )}
          </button>

          <button
            onClick={() => handleMapTypeChange("satellite")}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors duration-150 group ${
              mapType === "satellite"
                ? isDark
                  ? "bg-white/10 text-white"
                  : "bg-slate-100 text-slate-900"
                : isDark
                  ? "hover:bg-white/5 text-slate-300"
                  : "hover:bg-slate-50 text-slate-600"
            }`}
          >
            <div className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${mapType === "satellite" ? (isDark ? "bg-white/10" : "bg-white border border-slate-200") : (isDark ? "bg-white/5" : "bg-slate-100 border border-slate-200")}`}>
              <Satellite className="h-3.5 w-3.5" strokeWidth={1.5} />
            </div>
            <div className="text-[11px] font-medium leading-tight">Satellite</div>
            {mapType === "satellite" && (
              <Check className="h-3 w-3 text-emerald-400 shrink-0 ml-auto" strokeWidth={2.5} />
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}