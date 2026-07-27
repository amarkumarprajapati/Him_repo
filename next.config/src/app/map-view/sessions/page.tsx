"use client";

import { useState, useRef, useEffect } from "react";
import {
  MonitorPlay,
  Filter,
  Square,
  Eye,
  Search,
  FileDown,
  RefreshCw,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ViewSessionModal } from "@/components/modal/view-session-modal";
import { ConfirmDialog } from "@/components/modal/confirm-dialog";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchSessions,
  stopActiveSession,
} from "@/store/slices/sessionSlice";
import { fetchNotifications } from "@/store/slices/notificationSlice";
import { showToast } from "@/utils/toast";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { exportCsv, downloadFile } from "@/api/export";

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message || fallback);
  }
  return fallback;
}

export default function SessionsPage() {
  const dispatch = useAppDispatch();
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const loading = useAppSelector((state) => state.sessions.loading);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "RUNNING" | "STOPPED"
  >("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewSessionId, setViewSessionId] = useState<string | null>(null);
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
  const [stopSessionId, setStopSessionId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);

  const handleExport = async (sessionId: string) => {
    try {
      setIsExporting(sessionId);
      const res = await exportCsv(sessionId);
      if (res.status === "SUCCESS" && res.data?.download_url) {
        downloadFile(
          res.data.download_url,
          res.data.csv_file_name || res.data.csv_file || `session-${sessionId}.csv`,
        );
        showToast.success("Export started.");
      } else {
        showToast.error("Export failed.");
      }
    } catch {
      showToast.error("Export failed.");
    } finally {
      setIsExporting(null);
    }
  };


  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    dispatch(
      fetchSessions({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: debouncedSearch || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: pageSize,
      }),
    );
  }, [dispatch, statusFilter, debouncedSearch, pageSize]);

  useEffect(() => {
    if (dateTo) {
      dispatch(
        fetchSessions({
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          limit: pageSize,
        }),
      );
    }
  }, [dispatch, dateTo, pageSize]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const rawSessions = Array.isArray(sessions) ? sessions : [];
  const sessionItems = rawSessions?.map((s) => ({
    id: s.session_id || s.id || "",
    name: s.session_name || s.name || "",
    masterId: s.masterId || s.master_id || "MASTER_001",
    nodes: s.nodes || 0,
    startedBy: s.startedBy || s.started_by || s.session_type || "admin",
    startTime: s.start_time || s.startTime || s.created_at || "",
    status: (s.status === "ACTIVE" ||
    s.status === "RUNNING" ||
    s.status === "CREATED"
      ? "RUNNING"
      : "STOPPED") as "RUNNING" | "STOPPED",
  }));


  const promptStop = (sessionId: string) => {
    setStopSessionId(sessionId);
    setIsStopConfirmOpen(true);
  };

  const confirmStop = async () => {
    if (!stopSessionId) return;
    try {
      await dispatch(
        stopActiveSession({
          session_id: stopSessionId,
          stop_reason: "User stopped",
        }),
      ).unwrap();
      showToast.success("Session stopped.");
      dispatch(
        fetchSessions({
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          limit: pageSize,
        }),
      );
      dispatch(fetchNotifications());
    } catch (err: unknown) {
      showToast.error(getErrorMessage(err, "Failed to stop session."));
    } finally {
      setIsStopConfirmOpen(false);
      setStopSessionId(null);
    }
  };

  const columns: Column<(typeof sessionItems)[number]>[] = [
    { key: "id", header: "Session ID", width: "200px" },
    { key: "name", header: "Session Name", width: "180px" },
    { key: "masterId", header: "Master ID", width: "120px" },
    { key: "nodes", header: "Nodes", width: "80px" },
    { key: "startedBy", header: "Started By", width: "120px" },
    { key: "startTime", header: "Start Time", width: "180px" },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (s) => (
        <span
          className={`px-2 py-0.5 rounded border flex items-center gap-1.5 w-fit ${
            s.status === "RUNNING"
              ? "border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10"
              : "border-red-500 text-red-500 bg-red-500/10"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${s.status === "RUNNING" ? "bg-[#4ade80] animate-pulse" : "bg-red-500"}`}
          />
          {s.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: "220px",
      render: (s) => (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setViewSessionId(s.id);
              setIsViewOpen(true);
            }}
            className="p-1 text-slate-400 hover:text-[#38bdf8] transition-colors cursor-pointer"
            title="View"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleExport(s.id)}
            disabled={isExporting === s.id}
            className={`p-1 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer ${isExporting === s.id ? "animate-pulse" : ""}`}
            title="Export CSV"
          >
            <FileDown className="h-4 w-4" />
          </button>
          {s.status === "RUNNING" && (
            <button
              onClick={() => promptStop(s.id)}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full pb-10"
    >
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Sessions
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage and monitor telemetry sessions
          </p>
        </div>
      </div>

      <ViewSessionModal
        open={isViewOpen}
        sessionId={viewSessionId}
        onClose={() => {
          setIsViewOpen(false);
          setViewSessionId(null);
        }}
      />

      <ConfirmDialog
        open={isStopConfirmOpen}
        title="Stop Session"
        message={`Are you sure you want to stop session ${stopSessionId || ""}? This action cannot be undone.`}
        confirmLabel="Stop"
        cancelLabel="Cancel"
        onConfirm={confirmStop}
        onCancel={() => {
          setIsStopConfirmOpen(false);
          setStopSessionId(null);
        }}
      />

      <DataTable
        data={sessionItems}
        columns={columns}
        pageSize={pageSize}
        loading={loading}
        title="ALL SESSIONS"
        titleIcon={<MonitorPlay className="h-4 w-4 text-[#4ade80]" />}
        rowKey={(s) => s.id}
        className="h-[calc(100vh-220px)] flex-1"
        onPageSizeChange={setPageSize}
        filters={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4ade80]/50 w-48"
              />
            </div>

            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen((v) => !v)}
                className={`inline-flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-md border text-xs focus:outline-none focus:ring-1 focus:ring-[#4ade80]/50 cursor-pointer transition-colors ${
                  statusFilter !== "ALL" || dateFrom || dateTo
                    ? "bg-[#4ade80]/10 border-[#4ade80]/30 text-[#4ade80]"
                    : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-900 dark:text-white"
                }`}
              >
                <Filter
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
                    statusFilter !== "ALL" || dateFrom || dateTo
                      ? "text-[#4ade80]"
                      : "text-slate-400"
                  }`}
                />
                Filter
                {(statusFilter !== "ALL" || dateFrom || dateTo) && " Applied"}
              </button>
              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#0f172a] rounded-lg border border-slate-200 dark:border-white/10 shadow-xl py-3 px-4 z-50 flex flex-col gap-5 origin-top-right"
                  >
                    {/* Status Filter */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </label>
                      <div className="flex gap-1 bg-slate-100 dark:bg-[#1e293b] p-1 rounded-md">
                        {(["ALL", "RUNNING", "STOPPED"] as const).map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setStatusFilter(val)}
                            className={`flex-1 px-2 py-1.5 text-[10px] rounded font-medium transition-all cursor-pointer ${
                              statusFilter === val
                                ? "bg-white dark:bg-[#0f172a] shadow text-slate-900 dark:text-white"
                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                    <DateRangePicker
                      label="Date Range"
                      dateFrom={dateFrom}
                      dateTo={dateTo}
                      onApply={(from, to) => {
                        setDateFrom(from);
                        setDateTo(to);
                        setIsFilterOpen(false);
                      }}
                      onClear={() => {
                        setDateFrom("");
                        setDateTo("");
                      }}
                    />

                    {(statusFilter !== "ALL" ||
                      dateFrom ||
                      dateTo ||
                      search) && (
                      <button
                        onClick={() => {
                          setStatusFilter("ALL");
                          setDateFrom("");
                          setDateTo("");
                          setSearch("");
                          setDebouncedSearch("");
                        }}
                        className="text-[11px] text-slate-500 hover:text-red-500 text-right transition-colors cursor-pointer font-medium"
                      >
                        Clear Filters
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        }
      />
    </motion.div>
  );
}
