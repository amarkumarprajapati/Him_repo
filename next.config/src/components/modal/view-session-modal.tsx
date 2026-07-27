"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Eye, Activity, Clock, Globe, Server, FileText, RefreshCw, Calendar,
  MapPin, Type, AlertCircle, User, CheckCircle2, Navigation, Radio, Wifi,
  Smartphone, Satellite, Cpu, Shield, Zap, HardDrive
} from "lucide-react";
import type { SessionDetail } from "@/api/sessions";
import { getSessionStatus } from "@/api/sessions";
import { showToast } from "@/utils/toast";

interface ViewSessionModalProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
}

export function ViewSessionModal({ sessionId, open, onClose }: ViewSessionModalProps) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open && sessionId) {
      setLoading(true);
      getSessionStatus(sessionId)
        .then((data) => setDetail(data))
        .catch((err) => {
          showToast.error(err?.message || "Failed to fetch session details.");
        })
        .finally(() => setLoading(false));
    } else {
      setDetail(null);
    }
  }, [open, sessionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const fmt = (v: string | null | undefined) => (v && v.trim() ? v : "—");

  const ipFields: { label: string; value: string | null | undefined; icon: typeof Globe }[] = detail
    ? [
        { label: "Drone Detector", value: detail.drone_detector_ip, icon: Navigation },
        { label: "Cellular Active", value: detail.cellular_active_ip, icon: Smartphone },
        { label: "Cellular Passive", value: detail.cellular_passive_ip, icon: Wifi },
        { label: "Satellite", value: detail.satellite_interception_ip, icon: Satellite },
        { label: "DF System", value: detail.df_system_ip, icon: Radio },
        { label: "Monitoring", value: detail.monitoring_system_ip, icon: Shield },
        { label: "Cognizant", value: detail.cognizant_ip, icon: Zap },
        { label: "Cyronics", value: detail.cyronics_ip, icon: Globe },
      ].filter((f) => f.value && f.value.trim())
    : [];

  const fields = detail
    ? [
        { label: "Session Name", value: detail.session_name, icon: FileText },
        { label: "Session ID", value: detail.session_id, icon: Eye },
        { label: "Status", value: detail.status, icon: Activity },
        { label: "Operation Mode", value: detail.operation_mode || "—", icon: Server },
        { label: "Session Type", value: detail.session_type || "—", icon: Type },
        { label: "Node ID", value: detail.node_id || "—", icon: Cpu },
        { label: "Node Lat / Long", value: detail.node_lat != null && detail.node_long != null ? `${detail.node_lat}, ${detail.node_long}` : "—", icon: MapPin },
        { label: "Polling Interval", value: detail.polling_interval != null ? `${detail.polling_interval}s` : "—", icon: RefreshCw },
        { label: "Start Time", value: formatDate(detail.start_time), icon: Calendar },
        { label: "Stop Time", value: formatDate(detail.stop_time ?? null), icon: Clock },
        { label: "Last Sync", value: formatDate(detail.last_sync_time), icon: CheckCircle2 },
        { label: "Export Status", value: detail.export_status || "—", icon: HardDrive },
        { label: "Stop Reason", value: detail.stop_reason || "—", icon: AlertCircle },
        { label: "Remarks", value: detail.remarks || "—", icon: FileText },
        { label: "Created By", value: detail.created_by || "—", icon: User },
        ...ipFields,
      ]
    : [];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-2000 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto custom-scrollbar"
          >
            <div className="sticky top-0 bg-white dark:bg-[#0f172a] rounded-t-2xl border-b border-slate-200 dark:border-white/5 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                  <Eye className="h-4 w-4 text-sky-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Session Details</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {detail?.session_name || sessionId || "Loading..."}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-slate-200 dark:bg-white/10 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="h-2.5 w-16 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
                        <div className="h-3.5 w-40 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : detail ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fields.map((f) => (
                    <div
                      key={f.label}
                      className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5"
                    >
                      <div className="h-6 w-6 rounded-md bg-slate-200/50 dark:bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                        <f.icon className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{f.label}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {f.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
                  No session details available.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
