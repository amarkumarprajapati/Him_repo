"use client";

import { Shield, RadioTower } from "lucide-react";
import { motion } from "framer-motion";
import { WorldMapSvg } from "../svg/world-map-svg";

export function HimshravanBranding() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative flex h-[560px] w-full max-w-[420px] flex-col overflow-hidden px-2 xl:h-[550px] xl:max-w-[460px]"
    >
      {/* ── TOP: branding content ── */}
      <div className="relative z-20 flex flex-col items-center text-center">
        <div className="relative mb-3 flex items-center justify-center xl:mb-4">
          <div className="absolute inset-0 bg-[#4ade80] opacity-10 blur-2xl rounded-full h-32 w-32" />
          <Shield
            className="relative h-16 w-16 text-[#4ade80] drop-shadow-[0_0_15px_rgba(74,222,128,0.3)] xl:h-20 xl:w-20"
            strokeWidth={1.5}
          />
          <RadioTower
            className="absolute h-7 w-7 text-[#4ade80] drop-shadow-md xl:h-8 xl:w-8"
            strokeWidth={2}
          />
        </div>

        <h1 className="mb-3 text-4xl font-black leading-none tracking-[0.16em] text-white drop-shadow-lg xl:text-5xl">
          HIMSHRAVAN
        </h1>

        <div className="mb-5 flex flex-col gap-1 xl:mb-6 xl:gap-1.5">
          <p className="text-[10px] font-bold leading-relaxed tracking-[0.22em] text-[#4ade80] drop-shadow-md xl:text-xs xl:tracking-[0.3em]">
            EW Command Post Surveillance system
          </p>
          <p className="text-[10px] font-bold leading-relaxed tracking-[0.22em] text-[#4ade80] drop-shadow-md xl:text-xs xl:tracking-[0.3em]">
            ( EWCPS )
          </p>
        </div>

        <div className="w-[260px] xl:w-[280px]">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#4dd0e1]/40 to-transparent mb-4" />
          <p className="text-[10px] font-bold tracking-[0.25em] text-slate-400">
            SECURE. RELIABLE. SYNCHRONIZED.
          </p>
        </div>
      </div>

      {/* ── BOTTOM: map fills remaining space ── */}
      <div className="pointer-events-none relative flex-1 w-full opacity-80">
        <WorldMapSvg />
      </div>
    </motion.div>
  );
}