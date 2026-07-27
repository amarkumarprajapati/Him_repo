"use client";

import { useState } from "react";
import { Antenna, Drone, Orbit, RadioTower, Satellite } from "lucide-react";
import { useUi } from "@/components/layout/ui-context";

const LEGEND_ITEMS = [
  {
    label: "RF Surveillance / Node ID Detector",
    icon: Satellite,
    color: "#38bdf8",
  },
  {
    label: "Drone Detector",
    icon: Drone,
    color: "#f59e0b",
  },
  {
    label: "Active Cellular",
    icon: Antenna,
    color: "#22c55e",
  },
  {
    label: "Passive Cellular",
    icon: RadioTower,
    color: "#ef4444",
  },
  {
    label: "Satellite",
    icon: Orbit,
    color: "#a855f7",
  },
];

export function LegendPanel({ theme }: { theme: string }) {
  const isDark = theme === "dark";
  const { isSidebarOpen } = useUi();
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className={`absolute bottom-4 z-500 transition-transform duration-150 ease-out ${
        isSidebarOpen ? "left-[200px] right-4" : "left-4 right-4"
      }`}
    >
      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setIsVisible((v) => !v)}
          className={`h-10 shrink-0 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-wider shadow-2xl backdrop-blur-xl transition-colors duration-150 cursor-pointer ${
            isDark
              ? "border-cyan-400/15 bg-[#0f172a]/88 text-slate-300 hover:bg-[#172235]"
              : "border-slate-200 bg-white/90 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {isVisible ? "Hide" : "Legend"}
        </button>

        <div
          className={`flex-1 min-w-0 rounded-lg border shadow-2xl backdrop-blur-xl transition-[clip-path,opacity] duration-300 ease-out ${
            isDark
              ? "border-cyan-400/15 bg-[#0f172a]/88"
              : "border-slate-200 bg-white/90"
          }`}
          style={{
            clipPath: isVisible ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? "auto" : "none",
          }}
        >
          <div className="overflow-hidden">
            <div className="flex items-center justify-around gap-4 px-5 py-3">
              {LEGEND_ITEMS?.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: `${item.color}70`,
                        backgroundColor: `${item.color}18`,
                        boxShadow: `0 0 18px ${item.color}25`,
                      }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{ color: item.color }}
                        strokeWidth={1.8}
                      />
                    </div>
                    <span
                      className={`max-w-[150px] text-[12px] font-medium leading-5 ${
                        isDark ? "text-slate-200" : "text-slate-700"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
