"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { openBrowserUrlInNewTab } from "@/lib/open-browser-url";
import { X, Maximize2, Minimize2, ExternalLink, Globe, LayoutGrid, XCircle, Radio } from "lucide-react";
import { useUi } from "@/components/layout/ui-context";
import { EmbeddedBrowser } from "@/components/ui/embedded-browser";
import type { MapNode } from "@/types";
import {
  type PanelState,
  type PanelsMap,
  getLayout,
  clampPosition,
  topZ,
  loadPanels,
  savePanels,
  defaultPosition,
  clampAll,
} from "../../../utils/panel-utils";

const HEADER_H = 32;
const GAP = 4;
const PADDING = 8;

export function RightPanel() {
  const { rightPanelNode, isSidebarOpen } = useUi();
  const [panels, setPanels] = useState<PanelsMap>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPanels(loadPanels());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) savePanels(panels);
  }, [panels, mounted]);


  const didMountReposition = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    const reposition = () => setPanels((prev) => clampAll(prev));
    window.addEventListener("resize", reposition);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (didMountReposition.current) {
      t = setTimeout(reposition, 160);
    } else {
      didMountReposition.current = true;
    }
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("resize", reposition);
    };
  }, [isSidebarOpen, mounted]);

  useEffect(() => {
    if (!rightPanelNode) return;
    const station = rightPanelNode.station_name || "Unknown";
    const key = rightPanelNode.node_id || rightPanelNode.device_id;
    setPanels((prev) => {
      const existing = prev[station];
      const items = { ...(existing?.items ?? {}), [key]: rightPanelNode };
      const count = Object.keys(items).length;
      const layout = getLayout(count);
      const pos = existing
        ? clampPosition(existing.x, existing.y, layout.w, layout.h)
        : defaultPosition(prev, layout.w, layout.h);
      return {
        ...prev,
        [station]: {
          station,
          items,
          ...pos,
          w: layout.w,
          h: layout.h,
          fullscreen: existing?.fullscreen ?? false,
          z: topZ(prev) + 1,
        },
      };
    });
  }, [rightPanelNode]);

  if (!mounted) return null;

  const stations = Object.keys(panels);
  if (stations.length === 0) return null;

  const closeItem = (station: string, key: string) => {
    setPanels((prev) => {
      const p = prev[station];
      if (!p) return prev;
      const items = { ...p.items };
      delete items[key];
      const next = { ...prev };
      if (Object.keys(items).length === 0) {
        delete next[station];
        return next;
      }
      const count = Object.keys(items).length;
      const layout = getLayout(count);
      const pos = clampPosition(p.x, p.y, layout.w, layout.h);
      next[station] = { ...p, items, ...pos, w: layout.w, h: layout.h };
      return next;
    });
  };

  const closeStation = (station: string) => {
    setPanels((prev) => {
      const next = { ...prev };
      delete next[station];
      return next;
    });
  };

  const toggleFullscreen = (station: string) => {
    setPanels((prev) => {
      const p = prev[station];
      if (!p) return prev;
      return { ...prev, [station]: { ...p, fullscreen: !p.fullscreen } };
    });
  };

  const movePanel = (station: string, x: number, y: number) => {
    setPanels((prev) => {
      const p = prev[station];
      if (!p) return prev;
      return { ...prev, [station]: { ...p, x, y } };
    });
  };

  const resizePanel = (station: string, x: number, y: number, w: number, h: number) => {
    setPanels((prev) => {
      const p = prev[station];
      if (!p) return prev;
      return { ...prev, [station]: { ...p, x, y, w, h } };
    });
  };

  const bringToFront = (station: string) => {
    setPanels((prev) => {
      const p = prev[station];
      if (!p) return prev;
      const max = topZ(prev);
      if (p.z === max) return prev;
      return { ...prev, [station]: { ...p, z: max + 1 } };
    });
  };

  return createPortal(
    <>
      {stations.map((station) => (
        <StationPanel
          key={station}
          panel={panels[station]}
          onCloseItem={(k) => closeItem(station, k)}
          onCloseStation={() => closeStation(station)}
          onToggleFullscreen={() => toggleFullscreen(station)}
          onMove={(x, y) => movePanel(station, x, y)}
          onResize={(x, y, w, h) => resizePanel(station, x, y, w, h)}
          onFocus={() => bringToFront(station)}
        />
      ))}
    </>,
    document.body,
  );
}

function StationPanel({
  panel,
  onCloseItem,
  onCloseStation,
  onToggleFullscreen,
  onMove,
  onResize,
  onFocus,
}: {
  panel: PanelState;
  onCloseItem: (key: string) => void;
  onCloseStation: () => void;
  onToggleFullscreen: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (x: number, y: number, w: number, h: number) => void;
  onFocus: () => void;
}) {
  const { theme } = useUi();
  const entries = Object.entries(panel.items);
  const count = entries.length;
  const layout = getLayout(count);
  const dragHandleClass = `drag-handle-${panel.station.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const isDark = theme === "dark";

  const header = (
    <div
      className={`${dragHandleClass} flex shrink-0 items-center gap-2 ${isDark ? "bg-[#0f172a] border-white/10" : "bg-white border-slate-200"} border-b px-2 cursor-grab active:cursor-grabbing select-none`}
      style={{ height: HEADER_H }}
    >
      <Radio className={`h-3 w-3 shrink-0 ${isDark ? "text-blue-400" : "text-blue-600"} pointer-events-none`} />
      <span className={`pointer-events-none text-[10px] font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{panel.station}</span>
      <span className={`pointer-events-none text-[9px] ${isDark ? "text-slate-500" : "text-slate-500"}`}>
        · {count} {count === 1 ? "device" : "devices"}
      </span>
      <div className="flex-1" />
      <button
        title="Close station"
        onClick={onCloseStation}
        className={`shrink-0 cursor-pointer rounded p-0.5 ${isDark ? "text-slate-400 hover:bg-white/5 hover:text-red-400" : "text-slate-500 hover:bg-slate-100 hover:text-red-500"} transition-colors`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <XCircle className="h-3 w-3" />
      </button>
      <button
        title={panel.fullscreen ? "Restore" : "Full screen"}
        onClick={onToggleFullscreen}
        className={`shrink-0 cursor-pointer rounded p-0.5 ${isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"} transition-colors`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {panel.fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
      </button>
    </div>
  );

  const grid = (
    <IframeGrid entries={entries} cols={layout.cols} rows={layout.rows} onCloseItem={onCloseItem} />
  );

  if (panel.fullscreen) {
    return (
      <div className={`fixed inset-0 z-[10000] flex flex-col ${isDark ? "bg-[#0f172a]" : "bg-slate-100"}`}>
        {header}
        {grid}
      </div>
    );
  }

  return (
    <Rnd
      position={{ x: panel.x, y: panel.y }}
      size={{ width: panel.w, height: panel.h }}
      onDragStart={onFocus}
      onDragStop={(_, d) => onMove(d.x, d.y)}
      onResizeStart={onFocus}
      onResizeStop={(_, __, ref, ___, pos) =>
        onResize(pos.x, pos.y, ref.offsetWidth, ref.offsetHeight)
      }
      dragHandleClassName={dragHandleClass}
      bounds="window"
      minWidth={300}
      minHeight={200}
      style={{ zIndex: panel.z }}
      className={`flex flex-col overflow-hidden rounded-xl border ${isDark ? "border-white/10 bg-[#0f172a]" : "border-slate-200 bg-white shadow-lg"} shadow-2xl`}
    >
      <div className="flex h-full w-full flex-col" onMouseDown={onFocus}>
        {header}
        {grid}
      </div>
    </Rnd>
  );
}

function IframeGrid({
  entries,
  cols,
  rows,
  onCloseItem,
}: {
  entries: [string, MapNode][];
  cols: number;
  rows: number;
  onCloseItem: (key: string) => void;
}) {
  const { theme } = useUi();
  const isDark = theme === "dark";

  return (
    <div
      className={`grid min-h-0 flex-1 ${isDark ? "bg-[#020617]" : "bg-slate-200"}`}
      style={{
        padding: PADDING,
        gap: GAP,
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {entries.map(([key, node]) => {
        const url = node.url || `http://${node.ip_address}:${node.port}`;
        const label = node.node_id || node.device_id;
        return (
          <div
            key={key}
            className={`flex min-h-0 flex-col overflow-hidden rounded-md border ${isDark ? "border-white/10 bg-[#0f172a]" : "border-slate-200 bg-white"}`}
          >
            <div className={`flex h-6 shrink-0 items-center gap-1 border-b ${isDark ? "border-white/10 bg-[#0b1426]" : "border-slate-200 bg-slate-50"} px-1.5`}>
              <Globe className={`h-3 w-3 shrink-0 ${isDark ? "text-blue-400" : "text-blue-600"}`} />
              <span className={`flex-1 truncate font-mono text-[10px] ${isDark ? "text-slate-300" : "text-slate-600"}`} title={url}>
                {url}
              </span>
              <span className={`shrink-0 rounded border ${isDark ? "border-blue-400/20 bg-blue-400/10 text-blue-300" : "border-blue-200 bg-blue-50 text-blue-600"} px-1.5 py-0.5 text-[9px] font-bold`}>
                {label}
              </span>
              <button
                title="Open in new tab"
                onClick={() => openBrowserUrlInNewTab(url, label)}
                className={`shrink-0 cursor-pointer rounded p-0.5 ${isDark ? "text-slate-400 hover:bg-white/5 hover:text-blue-300" : "text-slate-500 hover:bg-slate-100 hover:text-blue-600"} transition-colors`}
              >
                <ExternalLink className="h-3 w-3" />
              </button>
              <button
                title="Close"
                onClick={() => onCloseItem(key)}
                className={`shrink-0 cursor-pointer rounded p-0.5 ${isDark ? "text-slate-400 hover:bg-white/5 hover:text-red-300" : "text-slate-500 hover:bg-slate-100 hover:text-red-500"} transition-colors`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-white">
              <EmbeddedBrowser
                url={url}
                className="h-full w-full border-0"
                title={`Analytics – ${label}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
