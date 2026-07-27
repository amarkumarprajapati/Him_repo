"use client";

import { useState, useRef, useCallback, type SyntheticEvent } from "react";
import { ArrowLeft, X, Globe, RefreshCw, ChevronLeft, ChevronRight, Square } from "lucide-react";
import type { MapNode } from "@/types";
import { EmbeddedBrowser, type EmbeddedBrowserHandle } from "@/components/ui/embedded-browser";

interface MapAnalyticsOverlayProps {
  node: MapNode;
  onBack: () => void;
  onClose: () => void;
  theme: string;
}

function normalizeBrowseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "about:blank";

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function MapAnalyticsOverlay({ node, onBack, onClose, theme }: MapAnalyticsOverlayProps) {
  const isDark = theme === "dark";

  const defaultUrl = node.url || (node.ip_address && node.port ? `http://${node.ip_address}:${node.port}` : "about:blank");
  const [editableUrl, setEditableUrl] = useState(defaultUrl);
  const [committedUrl, setCommittedUrl] = useState(defaultUrl);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const isEditingUrlRef = useRef(false);
  const browserRef = useRef<EmbeddedBrowserHandle>(null);
  const label = node.node_id || node.device_id;

  const commitNavigation = useCallback((url: string) => {
    const normalized = normalizeBrowseUrl(url);
    setEditableUrl(normalized);
    setCommittedUrl(normalized);
    // Explicitly call navigate to ensure proper loading state
    browserRef.current?.navigate(normalized);
  }, []);

  const handleRefresh = () => {
    browserRef.current?.reload();
  };

  const stopMapInteraction = (e: SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`absolute inset-0 z-8000 flex h-full w-full flex-col overflow-hidden ${isDark ? "bg-[#0f172a]" : "bg-slate-100"
        }`}
      onMouseDown={stopMapInteraction}
      onClick={stopMapInteraction}
      onKeyDown={stopMapInteraction}
    >
      {/* Address bar */}
      <div
        className={`relative z-20 flex shrink-0 items-center gap-2 border-b px-3 ${isDark ? "border-white/10 bg-[#0f172a]" : "border-slate-200 bg-white"
          }`}
        style={{ height: 40 }}
      >
        <button
          title="Back"
          onClick={() => browserRef.current?.back()}
          className={`shrink-0 rounded p-1 transition-colors ${isDark
            ? "text-slate-400 hover:bg-white/5 hover:text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <button
          title="Forward"
          onClick={() => browserRef.current?.forward()}
          className={`shrink-0 rounded p-1 transition-colors ${isDark
            ? "text-slate-400 hover:bg-white/5 hover:text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        <button
          title="Refresh"
          onClick={handleRefresh}
          className={`shrink-0 rounded p-1 transition-colors ${isDark
            ? "text-slate-400 hover:bg-white/5 hover:text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>

        <button
          title="Stop"
          onClick={() => browserRef.current?.stop()}
          className={`shrink-0 rounded p-1 transition-colors ${isDark
            ? "text-slate-400 hover:bg-white/5 hover:text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          onClick={onBack}
          className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${isDark
            ? "text-slate-300 hover:bg-white/5 hover:text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Go back to map
        </button>

        <Globe
          className={`h-3.5 w-3.5 shrink-0 cursor-pointer ${isDark ? "text-blue-400" : "text-blue-600"}`}
          onClick={() => urlInputRef.current?.focus()}
        />

        <input
          ref={urlInputRef}
          type="text"
          value={editableUrl}
          onFocus={() => {
            isEditingUrlRef.current = true;
          }}
          onChange={(e) => setEditableUrl(e.target.value)}
          onBlur={(e) => {
            isEditingUrlRef.current = false;
            const typed = e.currentTarget.value.trim();
            if (!typed || typed === committedUrl) return;
            commitNavigation(typed);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commitNavigation(e.currentTarget.value);
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditableUrl(committedUrl);
              e.currentTarget.blur();
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className={`min-w-0 flex-1 rounded border px-2 py-1 font-mono text-[11px] outline-none transition-all ${isDark
            ? "border-white/10 bg-[#020617] text-slate-200 placeholder-slate-500 focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/40"
            : "border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
            }`}
          title={committedUrl}
        />



        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${isDark
            ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
            : "border-blue-200 bg-blue-50 text-blue-600"
            }`}
        >
          {label}
        </span>

        <button
          title="Close"
          onClick={onClose}
          className={`shrink-0 rounded p-1 transition-colors ${isDark
            ? "text-slate-400 hover:bg-white/5 hover:text-red-300"
            : "text-slate-500 hover:bg-slate-100 hover:text-red-500"
            }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Full-size embedded browser */}
      <div className={`relative min-h-0 flex-1 ${isDark ? "bg-[#020617]" : "bg-white"}`}>
        <EmbeddedBrowser
          ref={browserRef}
          url={committedUrl}
          className="h-full w-full border-0 bg-white"
          title={`Browser – ${label}`}
          onUrlChange={(nextUrl) => {
            if (!isEditingUrlRef.current) {
              setEditableUrl(nextUrl);
            }
            setCommittedUrl(nextUrl);
          }}
        />
      </div>
    </div>
  );
}