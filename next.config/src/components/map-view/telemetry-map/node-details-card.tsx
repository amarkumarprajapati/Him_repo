"use client";

import { useRef, useEffect, useLayoutEffect, useState } from "react";
import type { MapNode } from "@/types";
import {
  RadioIcon,
  ServerIcon,
  WifiIcon,
  ActivityIcon,
  MapPinIcon,
  ClockIcon,
  CloseIcon,
} from "./node-card-icons";

interface NodeDetailsCardProps {
  node: MapNode;
  position: { x: number; y: number };
  onClose: () => void;
  theme: string;
  mapInstance?: any;
}

const CARD_WIDTH = 288;
const ARROW_HEIGHT = 8;
const ICON_RADIUS = 36;

export function NodeDetailsCard({ node, position, onClose, theme, mapInstance }: NodeDetailsCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [cardHeight, setCardHeight] = useState(0);

  const isDark = theme === "dark";

  useLayoutEffect(() => {
    if (innerRef.current) {
      setCardHeight(innerRef.current.offsetHeight);
      setReady(true);
    }
  }, []);


  useEffect(() => {
    if (!mapInstance || !cardRef.current || cardHeight === 0) return;

    const updatePosition = () => {
      const point = mapInstance.latLngToContainerPoint([node.latitude, node.longitude]);
      const topOffset = point.y - cardHeight - ARROW_HEIGHT - ICON_RADIUS;

      if (cardRef.current) {
        cardRef.current.style.left = `${point.x - CARD_WIDTH / 2}px`;
        cardRef.current.style.top = `${topOffset}px`;
      }
    };


    updatePosition();

    mapInstance.on("move", updatePosition);
    mapInstance.on("zoom", updatePosition);

    return () => {
      mapInstance.off("move", updatePosition);
      mapInstance.off("zoom", updatePosition);
    };
  }, [mapInstance, node.latitude, node.longitude, cardHeight]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const topOffset = position.y - cardHeight - ARROW_HEIGHT - ICON_RADIUS;

  return (
    <div
      ref={cardRef}
      style={{
        left: `${position.x - CARD_WIDTH / 2}px`,
        top: `${topOffset}px`,
      }}
      className="absolute z-[5000]"
    >
      <div
        ref={innerRef}
        style={{
          width: `${CARD_WIDTH}px`,
          opacity: ready ? 1 : 0,
          animation: ready ? "nodeCardIn 0.2s cubic-bezier(0.34,1.4,0.64,1) forwards" : "none",
          transformOrigin: "bottom center",
        }}
        className="rounded-2xl overflow-hidden"
      >
        {/* ── Header ── */}
        <div className={`${isDark ? "bg-[#0d1e38] border-white/[0.07]" : "bg-white border-slate-200"} px-4 pt-4 pb-3 border-b`}>
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${isDark ? "bg-sky-500/15 border-sky-500/25" : "bg-sky-50 border-sky-200"} border flex items-center justify-center`}>
              <RadioIcon className={`w-5 h-5 ${isDark ? "text-sky-400" : "text-sky-600"}`} />
            </div>

            {/* Name + ID */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className={`${isDark ? "text-white" : "text-slate-900"} font-bold text-sm leading-tight truncate`}>
                {node.node_name || node.node_id || node.device_id}
              </p>
              <p className={`${isDark ? "text-slate-500" : "text-slate-500"} text-[11px] font-mono mt-0.5`}>
                {node.node_id ?? node.device_id}
              </p>
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              className={`flex-shrink-0 p-1.5 rounded-lg ${isDark ? "bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"} transition-colors`}
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${node.network_status === "ONLINE"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-red-500/20 text-red-300 border border-red-500/30"
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${node.network_status === "ONLINE"
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-red-400"
                  }`}
              />
              {node.network_status}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${node.heartbeat_status === "ACTIVE"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "bg-slate-600/30 text-slate-400 border border-slate-600/40"
                }`}
            >
              {node.heartbeat_status}
            </span>
            {node.operating_status && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/25">
                {node.operating_status}
              </span>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className={`${isDark ? "bg-[#0b1829]" : "bg-slate-50"} px-4 py-3 space-y-2`}>
          {/* Device Type */}
          <div className={`flex items-center gap-3 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-slate-200"} rounded-xl px-3 py-2.5 border`}>
            <ServerIcon className={`w-4 h-4 ${isDark ? "text-violet-400" : "text-violet-600"} flex-shrink-0`} />
            <div className="min-w-0">
              <p className={`text-[9px] uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-500"} font-semibold leading-none`}>
                Device Type
              </p>
              <p className={`text-[12px] ${isDark ? "text-slate-200" : "text-slate-700"} font-semibold mt-1`}>
                {node?.device_type.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {/* IP Address */}
          <div className={`flex items-center gap-3 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-slate-200"} rounded-xl px-3 py-2.5 border`}>
            <WifiIcon className={`w-4 h-4 ${isDark ? "text-sky-400" : "text-sky-600"} flex-shrink-0`} />
            <div className="min-w-0">
              <p className={`text-[9px] uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-500"} font-semibold leading-none`}>
                IP Address
              </p>
              <p className={`text-[12px] ${isDark ? "text-slate-200" : "text-slate-700"} font-semibold font-mono mt-1`}>
                {node?.ip_address}
              </p>
            </div>
          </div>

          {/* Port */}
          <div className={`flex items-center gap-3 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-slate-200"} rounded-xl px-3 py-2.5 border`}>
            <ActivityIcon className={`w-4 h-4 ${isDark ? "text-sky-400" : "text-sky-600"} flex-shrink-0`} />
            <div className="min-w-0 flex-1">
              <p className={`text-[9px] uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-500"} font-semibold leading-none`}>
                Port
              </p>
              <p className={`text-[12px] ${isDark ? "text-slate-200" : "text-slate-700"} font-semibold font-mono mt-1`}>
                {node.port ?? "—"}
              </p>
            </div>
          </div>

          {/* Location */}
          <div className={`flex items-start gap-3 ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-white border-slate-200"} rounded-xl px-3 py-2.5 border`}>
            <MapPinIcon className={`w-4 h-4 ${isDark ? "text-emerald-400" : "text-emerald-600"} flex-shrink-0 mt-0.5`} />
            <div className="min-w-0">
              <p className={`text-[9px] uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-500"} font-semibold leading-none`}>
                {node?.station_name}
              </p>
              <p className={`text-[12px] ${isDark ? "text-slate-200" : "text-slate-700"} font-mono mt-1`}>
                {node.latitude != null && node.longitude != null
                  ? `${node.latitude}, ${node.longitude}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className={`${isDark ? "bg-[#091526] border-white/[0.05]" : "bg-slate-100 border-slate-200"} flex items-center gap-2 px-4 py-2.5 border-t`}>
          <ClockIcon className={`w-3 h-3 ${isDark ? "text-slate-600" : "text-slate-500"} flex-shrink-0`} />
          <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-600"} truncate`}>
            Last seen:&nbsp;
            <span className={`${isDark ? "text-slate-300" : "text-slate-700"} font-medium`}>
              {new Date(node?.telemetry_timestamp).toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      {/* ── Down arrow ── */}
      <div className="flex justify-center" style={{ marginTop: "-1px" }}>
        <div className={`w-4 h-4 rotate-45 -mt-2 ${isDark ? "bg-[#091526] border-white/[0.05]" : "bg-slate-100 border-slate-200"} border-r border-b`} />
      </div>
    </div>
  );
}
