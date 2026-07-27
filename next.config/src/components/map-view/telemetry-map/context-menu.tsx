"use client";

import { useRef, useEffect } from "react";
import { X, ExternalLink, FileBarChart, Info, Ban } from "lucide-react";
import type { MapNode } from "@/types";

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
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12h.01" ${common}/><path d="M8 12h8" ${common}/><path d="M12 8v8" ${common}/><circle cx="5" cy="5" r="2.5" ${common}/><circle cx="19" cy="5" r="2.5" ${common}/><circle cx="5" cy="19" r="2.5" ${common}/><circle cx="19" cy="19" r="2.5" ${common}/></svg>`;
  }

  if (type === "active_cellular") {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21V10" ${common}/><path d="M8 21h8" ${common}/><path d="M9.5 15h5" ${common}/><path d="M7 7a7 7 0 0 1 10 0" ${common}/><path d="M4 4a11 11 0 0 1 16 0" ${common}/><circle cx="12" cy="10" r="2" fill="${color}"/></svg>`;
  }

  if (type === "passive_cellular") {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21V10" ${common}/><path d="M8 21h8" ${common}/><path d="M9.5 15h5" ${common}/><path d="M7.5 7.5a6.5 6.5 0 0 0 0 9" ${common}/><path d="M16.5 7.5a6.5 6.5 0 0 1 0 9" ${common}/><circle cx="12" cy="10" r="2" fill="${color}"/></svg>`;
  }

  if (type === "satellite") {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 8l8 8" ${common}/><path d="M16 8l-8 8" ${common}/><rect x="5" y="5" width="4" height="4" rx="1" ${common}/><rect x="15" y="5" width="4" height="4" rx="1" ${common}/><rect x="5" y="15" width="4" height="4" rx="1" ${common}/><rect x="15" y="15" width="4" height="4" rx="1" ${common}/></svg>`;
  }

  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.8 5.2a10 10 0 0 0 0 13.6" ${common}/><path d="M19.2 5.2a10 10 0 0 1 0 13.6" ${common}/><path d="M7.6 8a6 6 0 0 0 0 8" ${common}/><path d="M16.4 8a6 6 0 0 1 0 8" ${common}/><path d="M12 14v5" ${common}/><circle cx="12" cy="12" r="2" fill="${color}"/></svg>`;
}

export function ContextMenu({
  node,
  position,
  onClose,
  onViewAnalytics,
  onViewInfo,
}: {
  node: MapNode;
  position: { x: number; y: number };
  onClose: () => void;
  onViewAnalytics: (node: MapNode) => void;
  onViewInfo: (node: MapNode) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (e.button === 2) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const canOpenAnalytics = Boolean(node.url || (node.ip_address && node.port));

  const actions = [
    {
      label: "Detailed Analytic View",
      icon: FileBarChart,
      hasExternal: true,
      disabled: !canOpenAnalytics,
      onClick: () => onViewAnalytics(node),
    },
    {
      label: "View Node Info",
      icon: Info,
      hasExternal: false,
      disabled: false,
      onClick: () => onViewInfo(node),
    },
  ];

  const bgColor = getNodeColor(node);
  const svgIcon = getNodeSvg(getNodeType(node.device_type), bgColor);

  return (
    <div
      ref={menuRef}
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute z-[5500] min-w-[200px] rounded-lg overflow-hidden shadow-2xl border border-white/10 animate-modal-in"
    >
      <div className="bg-[#0f172a]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: `${bgColor}20`,
                boxShadow: `0 0 10px ${bgColor}40`,
                border: `1px solid ${bgColor}`,
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: svgIcon }} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{getNodeId(node)}</div>
              <div className="text-[10px] text-slate-400 truncate">{node.node_name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 hover:bg-white/5 rounded-md shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col py-0.5">
          {actions?.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                disabled={action.disabled}
                className={`flex items-center gap-2.5 px-3 py-2 text-[12px] transition-all text-left group ${
                  action.disabled
                    ? "text-slate-600 cursor-not-allowed"
                    : "text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                }`}
                onClick={() => {
                  if (action.disabled) return;
                  action.onClick();
                  onClose();
                }}
              >
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 transition-colors ${
                    action.disabled ? "text-slate-600" : "text-slate-400 group-hover:text-white"
                  }`}
                />
                <span className="flex-1">{action.label}</span>
                {action.hasExternal && !action.disabled && (
                  <ExternalLink className="h-3 w-3 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
                )}
              </button>
            );
          })}
          <button
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2 text-[12px] text-slate-400 hover:bg-white/5 hover:text-slate-300 transition-all text-left cursor-pointer border-t border-white/5 group"
          >
            <Ban className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-400 shrink-0 transition-colors" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
