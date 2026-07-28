"use client";

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Search } from "lucide-react";
import {
  MapContainer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useUi } from "@/components/layout/ui-context";
import type { MapNode } from "@/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setMapType as setMapTypeAction } from "@/store/slices/mapSlice";
import { fetchDevices } from "@/store/slices/devicesSlice";
import { LegendPanel } from "./telemetry-map/legend-panel";
import { MapControls } from "./telemetry-map/map-controls";
import { ContextMenu } from "./telemetry-map/context-menu";
import { CoordinateTracker } from "./telemetry-map/coordinate-tracker";
import { MapStateSync } from "./telemetry-map/map-state-sync";
import { VisibleNodes } from "./telemetry-map/visible-nodes";
import { DynamicTileLayer } from "./telemetry-map/dynamic-tile-layer";
import { NodeDetailsCard } from "./telemetry-map/node-details-card";
import { MapAnalyticsOverlay } from "./telemetry-map/map-analytics-overlay";
import { mapendpoint } from "@/baseurl";

type NodeType = "drone" | "active_cellular" | "passive_cellular" | "satellite" | "rf";

function getNodeId(node: MapNode) {
  return node.node_id || node.device_id;
}

function getNodeType(deviceType: string): NodeType {
  const type = deviceType.toLowerCase();
  if (type === "drone") return "drone";
  if (type === "active_cell" || type === "active_cellular") return "active_cellular";
  if (type === "passive_cell" || type === "passive_cellular") return "passive_cellular";
  if (type === "satellite") return "satellite";
  return "rf";
}

function getNodeColor(node: MapNode) {
  return node.network_status === "ONLINE" && node.heartbeat_status === "ACTIVE" ? "#22c55e" : "#ef4444";
}

function getNodeSvg(type: NodeType, color: string) {
  const common = `stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;

  if (type === "drone") {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10 7 7" ${common}/>
      <path d="m10 14-3 3" ${common}/>
      <path d="m14 10 3-3" ${common}/>
      <path d="m14 14 3 3" ${common}/>
      <path d="M14.205 4.139a4 4 0 1 1 5.439 5.863" ${common}/>
      <path d="M19.637 14a4 4 0 1 1-5.432 5.868" ${common}/>
      <path d="M4.367 10a4 4 0 1 1 5.438-5.862" ${common}/>
      <path d="M9.795 19.862a4 4 0 1 1-5.429-5.873" ${common}/>
      <rect x="10" y="8" width="4" height="8" rx="1" ${common}/>
    </svg>`;
  }

  if (type === "active_cellular") {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12 7 2" ${common}/>
      <path d="m7 12 5-10" ${common}/>
      <path d="m12 12 5-10" ${common}/>
      <path d="m17 12 5-10" ${common}/>
      <path d="M4.5 7h15" ${common}/>
      <path d="M12 16v6" ${common}/>
    </svg>`;
  }

  if (type === "passive_cellular") {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" ${common}/>
      <path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" ${common}/>
      <circle cx="12" cy="9" r="2" ${common}/>
      <path d="M16.2 4.8c2 2 2.26 5.11.8 7.47" ${common}/>
      <path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1" ${common}/>
      <path d="M9.5 18h5" ${common}/>
      <path d="m8 22 4-11 4 11" ${common}/>
    </svg>`;
  }

  if (type === "satellite") {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.341 6.484A10 10 0 0 1 10.266 21.85" ${common}/>
      <path d="M3.659 17.516A10 10 0 0 1 13.74 2.152" ${common}/>
      <circle cx="12" cy="12" r="3" ${common}/>
      <circle cx="19" cy="5" r="2" ${common}/>
      <circle cx="5" cy="19" r="2" ${common}/>
    </svg>`;
  }

  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5" ${common}/>
    <path d="M16.5 7.5 19 5" ${common}/>
    <path d="m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5" ${common}/>
    <path d="M9 21a6 6 0 0 0-6-6" ${common}/>
    <path d="M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z" ${common}/>
  </svg>`;
}

function createNodeIcon(type: NodeType, color: string, networkStatus?: string) {
  const svgColor = networkStatus === 'ONLINE' ? '#22c55e' : networkStatus === 'OFFLINE' ? '#ef4444' : color;
  const svg = getNodeSvg(type, svgColor);
  let borderColor = color;
  let background = 'rgba(15,23,42,0.92)';

  if (networkStatus === 'ONLINE') {
    borderColor = '#22c55e';
    background = 'rgba(34,197,94,0.18)';
  } else if (networkStatus === 'OFFLINE') {
    borderColor = '#ef4444';
    background = 'rgba(239,68,68,0.18)';
  }

  return L.divIcon({
    className: "node-marker",
    html: `<div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;pointer-events:none;">
      <div style="position:absolute;width:38px;height:38px;border-radius:9999px;background:${background};border:2px solid ${borderColor};display:flex;align-items:center;justify-content:center;">${svg}</div>
    </div>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    popupAnchor: [0, -28],
  });
}

function createLabelIcon(id: string) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context) {
    context.font = '700 11px monospace';
    context.letterSpacing = '0.3px';
    const metrics = context.measureText(id);
    const textWidth = Math.max(80, Math.ceil(metrics.width) + 16);
    return L.divIcon({
      className: "leaflet-label-icon",
      html: `<div style="background:rgba(15,23,42,0.92);padding:3px 8px;border-radius:4px;border:1px solid rgba(148,163,184,0.3);color:#f8fafc;font-size:11px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;font-family:monospace; 8px 20px rgba(0,0,0,0.35);">${id}</div>`,
      iconSize: [textWidth, 22],
      iconAnchor: [textWidth / 2, -30],
    });
  }
  return L.divIcon({
    className: "leaflet-label-icon",
    html: `<div style="background:rgba(15,23,42,0.92);padding:3px 8px;border-radius:4px;border:1px solid rgba(148,163,184,0.3);color:#f8fafc;font-size:11px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;font-family:monospace; 8px 20px rgba(0,0,0,0.35);">${id}</div>`,
    iconSize: [80, 22],
    iconAnchor: [40, -30],
  });
}

function MapInstanceCapture({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

function MapFilterBar({
  theme,
  searchQuery,
  onSearchChange,
  mapInstance,
  displayNodes,
}: {
  theme: string;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  mapInstance: L.Map | null;
  displayNodes: MapNode[];
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDark = theme === "dark";
  const inputBg = isDark ? "bg-[#0f172a]/95" : "bg-white/95";
  const border = isDark ? "border-white/10" : "border-slate-200";
  const text = isDark ? "text-slate-100" : "text-slate-900";
  const placeholder = isDark ? "placeholder:text-slate-500" : "placeholder:text-slate-400";
  const iconColor = isDark ? "text-slate-400" : "text-slate-500";
  const dropdownBg = isDark ? "bg-[#0f172a]" : "bg-white";
  const dropdownBorder = isDark ? "border-white/10" : "border-slate-200";
  const itemHover = isDark ? "hover:bg-white/5" : "hover:bg-slate-50";
  const itemText = isDark ? "text-slate-200" : "text-slate-700";
  const subText = isDark ? "text-slate-500" : "text-slate-500";

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase().trim();
    return displayNodes
      .filter((node) => Boolean(node.network_status?.trim()))
      .filter(
        (node) =>
          (node.node_id?.toLowerCase().includes(lowerQuery) ?? false) ||
          (node.device_id?.toLowerCase().includes(lowerQuery) ?? false) ||
          (node.device_type?.toLowerCase().replace(/_/g, " ").includes(lowerQuery) ?? false) ||
          (node.node_name?.toLowerCase().includes(lowerQuery) ?? false) ||
          (node.station_name?.toLowerCase().includes(lowerQuery) ?? false)
      )
      .slice(0, 8);
  }, [searchQuery, displayNodes]);

  const handleSearch = useCallback((query: string) => {
    onSearchChange(query);
    setShowDropdown(query.trim().length > 0);
  }, [onSearchChange]);

  const handleNodeSelect = useCallback((node: MapNode) => {
    onSearchChange(getNodeId(node));
    setShowDropdown(false);
    if (mapInstance) {
      mapInstance.flyTo([node.latitude, node.longitude], 12, { duration: 1.5 });
    }
  }, [mapInstance, onSearchChange]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showDropdown]);

  return (
    <div className="absolute top-4 left-4 z-[6000]">
      <div ref={dropdownRef} className="relative">
        <div
          className={`flex h-11 w-72 items-center gap-2.5 rounded-xl border px-3.5 backdrop-blur-xl ${inputBg} ${border}`}
        >
          <Search className={`h-4 w-4 ${iconColor} flex-shrink-0`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by Node ID, Device ID, or Type"
            className={`w-full bg-transparent text-sm ${text} ${placeholder} outline-none placeholder:font-normal`}
            onFocus={() => setShowDropdown(searchQuery.trim().length > 0)}
          />
        </div>

        {showDropdown && filteredNodes.length > 0 && (
          <div
            className={`absolute top-full left-0 right-0 mt-2 rounded-xl border overflow-hidden max-h-80 overflow-y-auto shadow-xl z-[6000] ${dropdownBg} ${dropdownBorder}`}
          >
            {filteredNodes.map((node, index) => (
              <button
                key={`${getNodeId(node)}-${node.device_id}-${index}`}
                onClick={() => handleNodeSelect(node)}
                className={`w-full px-4 py-3 text-left border-b last:border-b-0 ${itemHover} ${isDark ? "border-white/5" : "border-slate-100"} transition-colors`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${itemText}`}>
                      {node.node_name || getNodeId(node)}
                    </p>
                    <p className={`text-xs font-mono mt-0.5 ${subText}`}>
                      {getNodeId(node)}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      node.network_status === "ONLINE"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}
                  >
                    {node.network_status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                  <span className={subText}>{node.device_type?.replace(/_/g, " ") ?? "—"}</span>
                  {node.station_name && (
                    <>
                      <span className={subText}>•</span>
                      <span className={subText}>{node.station_name}</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TelemetryMap() {
  const { theme, isEventsOpen } = useUi();
  const dispatch = useAppDispatch();
  const { center: savedCenter, zoom: savedZoom, mapType } = useAppSelector((s) => s.map);
  const setMapType = useCallback(
    (t: "map" | "satellite") => dispatch(setMapTypeAction(t)),
    [dispatch],
  );
  const [contextMenu, setContextMenu] = useState<{
    node: MapNode;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedNode, setSelectedNode] = useState<{
    node: MapNode;
    position: { x: number; y: number };
  } | null>(null);
  const [analyticsNode, setAnalyticsNode] = useState<MapNode | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ lat: 22.3039, lng: 70.8022 });
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!mapInstance) return;
    const start = performance.now();
    const duration = 400;
    let rafId: number;
    const tick = () => {
      mapInstance.invalidateSize({ animate: false });
      if (performance.now() - start < duration) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isEventsOpen, mapInstance]);

  const displayNodes = useAppSelector((s) => s.devices.items);

  useEffect(() => {
    dispatch(fetchDevices());
  }, [dispatch]);

  const hasNodes = displayNodes.length > 0;

  useEffect(() => {
    if (!mapInstance) return;
    const handleFocusNode = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string }>;
      const node = displayNodes.find((n) => getNodeId(n) === customEvent.detail.nodeId);
      if (node) {
        mapInstance.flyTo([node.latitude, node.longitude], 9, { duration: 1.5 });
      }
    };
    window.addEventListener("focus-node", handleFocusNode);
    return () => window.removeEventListener("focus-node", handleFocusNode);
  }, [mapInstance, displayNodes]);

  const tileUrl = useMemo(() => {
    if (mapType === "satellite") {
      return mapendpoint.satellite;
    }
    if (theme === "dark") {
      return mapendpoint.dark;
    }
    return mapendpoint.light;
  }, [mapType, theme]);

  const attribution = useMemo(() => {
    if (mapType === "satellite") return "&copy; Esri";
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';
  }, [mapType]);

  const nodeIcons = useMemo(
    () =>
      displayNodes.reduce(
        (acc, node) => {
          acc[getNodeId(node)] = createNodeIcon(getNodeType(node.device_type), getNodeColor(node), node.network_status);
          return acc;
        },
        {} as Record<string, L.DivIcon>,
      ),
    [displayNodes],
  );
  const labelIcons = useMemo(
    () =>
      displayNodes.reduce(
        (acc, node) => {
          acc[getNodeId(node)] = createLabelIcon(getNodeId(node));
          return acc;
        },
        {} as Record<string, L.DivIcon>,
      ),
    [displayNodes],
  );

  const getMapRelativePosition = useCallback((clientX: number, clientY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }, []);

  const showNodeDetails = useCallback(
    (node: MapNode, clientX?: number, clientY?: number) => {
      if (mapInstance && clientX === undefined) {
        const point = mapInstance.latLngToContainerPoint([node.latitude, node.longitude]);
        setSelectedNode({ node, position: { x: point.x, y: point.y } });
        return;
      }
      const position =
        clientX !== undefined && clientY !== undefined
          ? getMapRelativePosition(clientX, clientY)
          : mapInstance
            ? (() => {
                const point = mapInstance.latLngToContainerPoint([node.latitude, node.longitude]);
                return { x: point.x, y: point.y };
              })()
            : { x: 0, y: 0 };
      setSelectedNode({ node, position });
    },
    [getMapRelativePosition, mapInstance],
  );

  const openAnalytics = useCallback((node: MapNode) => {
    setAnalyticsNode(node);
    setSelectedNode(null);
    setContextMenu(null);
  }, []);

  const handleNodeRightClick = useCallback(
    (node: MapNode, e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      e.originalEvent.stopPropagation();
      setSelectedNode(null);
      setAnalyticsNode(null);
      setContextMenu({
        node,
        position: getMapRelativePosition(e.originalEvent.clientX, e.originalEvent.clientY),
      });
    },
    [getMapRelativePosition],
  );

  const handleMapClick = useCallback(() => {
    setContextMenu(null);
    setSelectedNode(null);
  }, []);


  const handleAnalyticsBack = useCallback(() => {
    setAnalyticsNode(null);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full h-full" onContextMenu={(e) => e.preventDefault()}>
      <div className="w-full h-full relative">
        <MapContainer
          center={savedCenter}
          zoom={savedZoom}
          preferCanvas
          style={{
            width: "100%",
            height: "100%",
            background: theme === "dark" ? "#0a1628" : "#e8ecf1",
          }}
          zoomControl={false}
          attributionControl={false}
          minZoom={4}
          maxZoom={18}
        >
          <DynamicTileLayer
            url={tileUrl}
            attribution={attribution}
            theme={theme}
          />
          <MapInstanceCapture onMap={setMapInstance} />
          <CoordinateTracker
            onCoordChange={(lat, lng) => setCoords({ lat, lng })}
          />
          <MapStateSync />
          <MapClickHandler onClick={handleMapClick} />
          <VisibleNodes
            nodes={displayNodes}
            nodeIcons={nodeIcons}
            labelIcons={labelIcons}
            onRightClick={handleNodeRightClick}
            onClick={(node, e) => {
              setAnalyticsNode(null);
              setContextMenu(null);
              showNodeDetails(node, e.originalEvent.clientX, e.originalEvent.clientY);
            }}
          />
        </MapContainer>

        {analyticsNode && (
          <MapAnalyticsOverlay
            node={analyticsNode}
            onBack={handleAnalyticsBack}
            onClose={() => setAnalyticsNode(null)}
            theme={theme}
          />
        )}
        {!analyticsNode && (
          <>
            <MapFilterBar
              theme={theme}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              mapInstance={mapInstance}
              displayNodes={displayNodes}
            />
            <MapControls
              map={mapInstance}
              mapType={mapType}
              onMapTypeChange={setMapType}
            />
            <LegendPanel theme={theme} />
            <div
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 backdrop-blur-lg rounded-lg px-4 py-2 z-400 flex items-center gap-4 text-[11px] font-mono ${theme === "dark" ? "bg-[#0f172a]/95 border border-white/10 text-slate-300" : "bg-white/95 border border-slate-200 text-slate-600"}`}
            >
              <span className="flex items-center gap-1.5">
                <svg
                  className="h-3 w-3 text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Lat: {coords.lat.toFixed(4)}° N
              </span>
              <span
                className={`${theme === "dark" ? "text-slate-600" : "text-slate-300"}`}
              >
                |
              </span>
              <span>Long: {coords.lng.toFixed(4)}° E</span>
            </div>
          </>
        )}

        {contextMenu && (
          <ContextMenu
            node={contextMenu.node}
            position={contextMenu.position}
            onClose={() => setContextMenu(null)}
            onViewAnalytics={openAnalytics}
            onViewInfo={(node) => showNodeDetails(node, contextMenu.position.x, contextMenu.position.y)}
          />
        )}
        {selectedNode && !analyticsNode && (
          <NodeDetailsCard
            node={selectedNode.node}
            position={selectedNode.position}
            onClose={() => setSelectedNode(null)}
            theme={theme}
            mapInstance={mapInstance ?? undefined}
          />
        )}
      </div>

      <style>{`
        @keyframes nodeCardIn {
          from { opacity: 0; transform: scale(0.88) translateY(8px); }
          to   { opacity: 1; transform: scale(1)   translateY(0);    }
        }
      `}</style>
    </div>
  );
}

function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({
    click: onClick,
    contextmenu(e) {
      e.originalEvent.preventDefault();
    },
  });
  return null;
}