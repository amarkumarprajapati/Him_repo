import type { MapNode } from "@/types";

const STORAGE_KEY = "himshravan-analytics-v5";

const HEADER_H = 32;
const CARD_W = 280;
const CARD_H = 180;
const GAP = 4;
const PADDING = 8;
const Z_BASE = 10000;

export type PanelState = {
  station: string;
  items: Record<string, MapNode>;
  x: number;
  y: number;
  w: number;
  h: number;
  fullscreen: boolean;
  z: number;
};

export type PanelsMap = Record<string, PanelState>;

export function getLayout(count: number) {
  const cols = count <= 1 ? 1 : 2;
  const rows = count <= 2 ? 1 : 2;
  const w = cols * CARD_W + (cols - 1) * GAP + PADDING * 2;
  const h = HEADER_H + rows * CARD_H + (rows - 1) * GAP + PADDING * 2;
  return { cols, rows, w, h };
}

export function clampPosition(x: number, y: number, w: number, h: number) {
  if (typeof window === "undefined") return { x, y };
  const maxX = Math.max(16, window.innerWidth - w - 16);
  const maxY = Math.max(16, window.innerHeight - h - 16);
  return {
    x: Math.max(16, Math.min(maxX, x)),
    y: Math.max(16, Math.min(maxY, y)),
  };
}

export function topZ(panels: PanelsMap): number {
  const values = Object.values(panels).map((p) => p.z ?? Z_BASE);
  return values.length ? Math.max(...values) : Z_BASE - 1;
}

export function loadPanels(): PanelsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PanelsMap;
    const out: PanelsMap = {};
    let z = Z_BASE;
    for (const [station, p] of Object.entries(parsed)) {
      const count = Object.keys(p.items ?? {}).length;
      if (!count) continue;
      const layout = getLayout(count);
      const pos = clampPosition(p.x, p.y, layout.w, layout.h);
      out[station] = { ...p, ...pos, w: layout.w, h: layout.h, z: z++ };
    }
    return out;
  } catch {
    return {};
  }
}

export function savePanels(panels: PanelsMap) {
  try {
    if (!panels || Object.keys(panels).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
    }
  } catch {}
}

export function defaultPosition(panels: PanelsMap, w: number, h: number) {
  if (typeof window === "undefined") return { x: 24, y: 80 };
  const margin = 24;
  const gap = 12;
  const topY = 80;
  const entries = Object.values(panels);
  let x = window.innerWidth - w - margin;
  if (entries.length === 0) return clampPosition(x, topY, w, h);
  const maxBottom = Math.max(...entries.map((p) => p.y + p.h));
  let y = maxBottom + gap;
  if (y + h > window.innerHeight - 16) {
    // No vertical room: cascade slightly at bottom-right so they remain reachable.
    x = Math.max(16, window.innerWidth - w - margin - (entries.length % 5) * 20);
    y = topY + (entries.length % 5) * 20;
  }
  return clampPosition(x, y, w, h);
}

export function clampAll(panels: PanelsMap): PanelsMap {
  if (typeof window === "undefined") return panels;
  const out: PanelsMap = {};
  for (const [station, p] of Object.entries(panels)) {
    const pos = clampPosition(p.x, p.y, p.w, p.h);
    out[station] = { ...p, ...pos };
  }
  return out;
}
